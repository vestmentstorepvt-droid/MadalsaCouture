import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';

import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Heart,
  Ruler,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Minus,
  Plus,
  Sparkles,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useGetProductByIdQuery, useGetProductsQuery, type Product } from '../../services/productsApi';
import {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation,
} from '../../services/wishlistApi';
import { useAddToCartApiMutation } from '../../services/cartApi';
import { addToCart } from '../../store/slices/cartSlice';
import { optimizeImage } from '../../utils/imageUtils';
import { ProductCard } from '../../components/ui/ProductCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import {
  findAvailableVariantForSize,
  isSizeUnavailable,
} from '../../utils/productVariants';
import ProductComments from '../../components/features/comments/ProductComments';
import CartSideDrawer from '../../components/features/cart/CartSideDrawer';



const ACCORDION_ITEMS = [
  { key: 'description', label: 'DESCRIPTION' },
  { key: 'details', label: 'PRODUCT DETAILS' },
  { key: 'size-fit', label: 'SIZE & FIT' },
  { key: 'styling', label: 'STYLING TIPS' },
  { key: 'care', label: 'CARE INSTRUCTIONS' },
  { key: 'delivery', label: 'DELIVERY & RETURNS' },
  { key: 'disclaimer', label: 'DISCLAIMER' },
] as const;

const SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL'];

const SIZE_CHART = [
  { size: 'XS', bust: '32"', waist: '26"', hips: '35"', length: '54"' },
  { size: 'S', bust: '34"', waist: '28"', hips: '37"', length: '55"' },
  { size: 'M', bust: '36"', waist: '30"', hips: '39"', length: '56"' },
  { size: 'L', bust: '38"', waist: '32"', hips: '41"', length: '57"' },
  { size: 'XL', bust: '40"', waist: '34"', hips: '43"', length: '58"' },
];

const getDefaultAccordionContent = (key: string, product: Product): React.ReactNode => {
  const renderList = (items: string[] | undefined, fallback: string | null) => {
    if (!items || items.length === 0) return fallback;
    return (
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-accent opacity-80 mt-1.5 text-xs">♦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderKeyValue = (items: { label: string; value: string }[] | undefined, fallback: string | null) => {
    if (!items || items.length === 0) return fallback;
    return (
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-accent opacity-80 mt-1.5 text-xs">♦</span>
            <span>
              <strong className="font-semibold text-stone-800">{item.label}:</strong> {item.value}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  switch (key) {
    case 'description':
      return product.description || null;
    case 'details':
      return renderKeyValue(product.productDetails, product.shortDescription || null);
    case 'size-fit':
      return renderKeyValue(product.sizeFit, product.specifications?.fitNotes || null);
    case 'styling':
      return renderList(product.stylingTips, null);
    case 'care':
      return renderList(product.careInstructions, product.specifications?.washCare || null);
    case 'delivery':
      return renderList(product.deliveryReturns, null);
    case 'disclaimer':
      return product.disclaimer || null;
    default:
      return null;
  }
};

// ─── Lightbox With Magnifier ──────────────────────────────────────────────────
interface LightboxProps {
  imageSet: string[];
  selectedImage: number;
  productName: string;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const MAGNIFIER_SIZE = 180;   // px — diameter of the lens circle
const ZOOM_LEVEL = 3;     // multiplier

const LightboxWithMagnifier: React.FC<LightboxProps> = ({
  imageSet,
  selectedImage,
  productName,
  onClose,
  onNext,
  onPrev,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  // Magnifier state
  const [isMagnifierOn, setIsMagnifierOn] = useState(true);
  const [showLens, setShowLens] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });        // px from top-left of container
  const [bgPos, setBgPos] = useState({ x: 0, y: 0 });        // background-position values

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'ArrowRight') { onNext(); }
      if (e.key === 'ArrowLeft') { onPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNext, onPrev]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clamp so lens stays inside image boundaries
    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));

    // Where to place the lens center (relative to the wrapper div, not img)
    const wrapRect = e.currentTarget.getBoundingClientRect();
    setLensPos({
      x: e.clientX - wrapRect.left,
      y: e.clientY - wrapRect.top,
    });

    // Background position: moves the zoomed image under the lens
    const bgX = -(clampedX * ZOOM_LEVEL - MAGNIFIER_SIZE / 2);
    const bgY = -(clampedY * ZOOM_LEVEL - MAGNIFIER_SIZE / 2);
    setBgPos({ x: bgX, y: bgY });
  }, []);

  const currentSrc = imageSet[selectedImage];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between bg-black/70 backdrop-blur-sm px-5 py-3 shrink-0">
          <span className="text-xs font-semibold tracking-wider uppercase text-white/60">
            {productName}
          </span>
          <div className="flex items-center gap-3">
            {/* Zoom toggle */}
            <button
              type="button"
              onClick={() => setIsMagnifierOn((v) => !v)}
              title={isMagnifierOn ? 'Disable magnifier' : 'Enable magnifier'}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wider transition-all ${isMagnifierOn
                ? 'border-hairline bg-ink/20 text-accent'
                : 'border-white/30 bg-white/10 text-white/60 hover:border-white/60 hover:text-white'
                }`}
            >
              {isMagnifierOn ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
              {isMagnifierOn ? 'Magnifier ON' : 'Magnifier OFF'}
            </button>

            {/* Image counter */}
            {imageSet.length > 1 && (
              <span className="text-xs text-white/50 font-mono">
                {selectedImage + 1} / {imageSet.length}
              </span>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/30 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Image area ── */}
        <div className="relative flex-1 flex items-center justify-center bg-ink min-h-0">

          {/* Image + magnifier wrapper */}
          <div
            className={`relative inline-flex items-center justify-center ${isMagnifierOn ? 'cursor-none' : 'cursor-default'}`}
            onMouseMove={isMagnifierOn ? handleMouseMove : undefined}
            onMouseEnter={isMagnifierOn ? () => setShowLens(true) : undefined}
            onMouseLeave={isMagnifierOn ? () => setShowLens(false) : undefined}
          >
            <img
              ref={imgRef}
              src={optimizeImage(currentSrc, 1200)}
              alt={productName}
              className="max-h-[80vh] max-w-full object-contain select-none"
              draggable={false}
            />

            {/* Magnifier lens */}
            {isMagnifierOn && showLens && imgRef.current && (
              <div
                style={{
                  position: 'absolute',
                  left: lensPos.x - MAGNIFIER_SIZE / 2,
                  top: lensPos.y - MAGNIFIER_SIZE / 2,
                  width: MAGNIFIER_SIZE,
                  height: MAGNIFIER_SIZE,
                  borderRadius: '50%',
                  border: '2px solid #171717',
                  boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.6)',
                  backgroundImage: `url(${optimizeImage(currentSrc, 1200)})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${imgRef.current.getBoundingClientRect().width * ZOOM_LEVEL}px ${imgRef.current.getBoundingClientRect().height * ZOOM_LEVEL}px`,
                  backgroundPosition: `${bgPos.x}px ${bgPos.y}px`,
                  pointerEvents: 'none',
                  zIndex: 10,
                  overflow: 'hidden',
                  // gold inner glow
                  backdropFilter: 'brightness(1.05)',
                }}
              >
                {/* Crosshair */}
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{ width: 1, height: 14, background: 'rgba(212,175,55,0.7)', position: 'absolute' }} />
                  <span style={{ height: 1, width: 14, background: 'rgba(212,175,55,0.7)', position: 'absolute' }} />
                </span>
              </div>
            )}
          </div>

          {/* Prev / Next arrows */}
          {imageSet.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur hover:bg-white/25 transition"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 stroke-[1.5]" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur hover:bg-white/25 transition"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 stroke-[1.5]" />
              </button>
            </>
          )}
        </div>

        {/* ── Thumbnail strip ── */}
        {imageSet.length > 1 && (
          <div className="flex gap-2 justify-center bg-black/70 backdrop-blur-sm px-4 py-3 overflow-x-auto shrink-0">
            {imageSet.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  // Communicate back via onNext/onPrev sequence isn't ideal,
                  // so we just expose a direct jump via a synthetic approach.
                  // Since parent controls selectedImage, we navigate relatively.
                  const diff = idx - selectedImage;
                  if (diff > 0) for (let i = 0; i < diff; i++) onNext();
                  else for (let i = 0; i > diff; i--) onPrev();
                }}
                className={`h-12 w-10 shrink-0 overflow-hidden rounded-lg border transition-all ${idx === selectedImage
                  ? 'border-hairline opacity-100 ring-1 ring-hairline'
                  : 'border-transparent opacity-40 hover:opacity-80'
                  }`}
              >
                <img src={optimizeImage(img, 200)} alt="" className="h-full w-full object-contain bg-black" />
              </button>
            ))}
          </div>
        )}

        {/* ── Hint bar ── */}
        {isMagnifierOn && (
          <div className="flex items-center justify-center gap-2 bg-black/50 py-2 shrink-0">
            <ZoomIn className="h-3 w-3 text-accent" />
            <span className="text-xs tracking-wider text-white/40 uppercase font-medium">
              Hover over image to magnify · {ZOOM_LEVEL}× zoom
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  const { data: product, isLoading, isError } = useGetProductByIdQuery(id ?? '', {
    skip: !id,
  });
  const { data: relatedProductsData } = useGetProductsQuery({ category: 'all' });
  const relatedProductsList = relatedProductsData?.products ?? [];

  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const { data: wishlistData = [] } = useGetWishlistQuery(undefined, { skip: !isAuthenticated || isAdmin });

  const [addToWishlistMutation] = useAddToWishlistMutation();
  const [removeFromWishlistMutation] = useRemoveFromWishlistMutation();
  const [addToCartApi] = useAddToCartApiMutation();

  const isWishlisted = useMemo(() => {
    if (!product || !wishlistData) return false;
    return wishlistData.some(
      (item) => item._id === product._id || item.slug === product.slug
    );
  }, [product, wishlistData]);

  const related = useMemo(() => {
    if (!product) return [];
    return relatedProductsList.filter((item) => item._id !== product._id).slice(0, 4);
  }, [product, relatedProductsList]);

  // Reset the selected size when navigating to another product.
  useEffect(() => {
    setSelectedImage(0);
    setQuantity(1);
    setAddedToCart(false);
    setSelectedSize(null);
  }, [id]);

  // ── Meta Pixel: ViewContent ───────────────────────────────────────────
  // Fires once when a product page fully loads with product data.
  useEffect(() => {
    if (!product) return;
    try {
      const fbq = (window as any).fbq;
      if (typeof fbq === 'function') {
        fbq('track', 'ViewContent', {
          content_ids: [product._id],
          content_name: product.name,
          content_type: 'product',
          content_category: product.category || '',
          value: product.price,
          currency: 'INR',
        }, { eventID: `vc_${product._id}_${Date.now()}` });
      }
    } catch { /* silent */ }
  }, [product?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  // ────────────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name ?? 'Madalsa Atelier',
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback
      }
    }
    await navigator.clipboard.writeText(window.location.href);
    showToast('Product link copied to clipboard!');
  };

  const handleAddToCart = async () => {
    if (!product) return;
    if (!selectedSize) {
      showToast('Please select a size before adding to bag');
      return;
    }

    // Look up the variant matching the selected size so we can include variantId
    // (Shiprocket Checkout requires variant IDs for every cart item)
    const matchedVariant = findAvailableVariantForSize(product.variants, selectedSize);
    if (!matchedVariant) {
      showToast('This size is unavailable. Please choose another size.');
      return;
    }

    const currentImg = (product.images && product.images[selectedImage]) || product.primaryImage || product.images?.[0] || '';
    dispatch(
      addToCart({
        productId: product._id,
        variantId: matchedVariant._id,
        name: product.name,
        image: currentImg,
        price: matchedVariant.price ?? product.price,
        quantity,
        size: selectedSize,
        color: matchedVariant.color,
      })
    );

    // Call backend API if user is authenticated
    try {
      await addToCartApi({
        productId: product._id,
        variantId: matchedVariant._id,
        selectedSize,
        selectedColor: matchedVariant.color,
        quantity,
      }).unwrap();
    } catch {
      // Unauthenticated or offline fallback — local cart is updated
    }

    // ── Meta Pixel: AddToCart ──────────────────────────────────────────
    try {
      const fbq = (window as any).fbq;
      if (typeof fbq === 'function') {
        fbq('track', 'AddToCart', {
          content_ids: [product._id],
          content_name: product.name,
          content_type: 'product',
          value: product.price * quantity,
          currency: 'INR',
        }, { eventID: `atc_${product._id}_${user?.id || 'guest'}` });
      }
    } catch { /* silent */ }
    // ──────────────────────────────────────────────────────────────────

    setAddedToCart(true);
    showToast(`Added ${quantity} × ${product.name} (${selectedSize}) to Bag`);
    setIsCartDrawerOpen(true);
    setTimeout(() => setAddedToCart(false), 2500);
  };


  const handleToggleWishlist = async () => {
    if (!product) return;
    try {
      if (isWishlisted) {
        await removeFromWishlistMutation(product._id).unwrap();
        showToast('Removed from Wishlist');
      } else {
        await addToWishlistMutation(product._id).unwrap();
        showToast('Added to Wishlist');
      }
    } catch (err: any) {
      const errMsg = err?.data?.error?.message || err?.data?.message || 'Please sign in to save items to your wishlist';
      showToast(errMsg);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <div className="animate-pulse grid gap-12 lg:grid-cols-2">
            <div className="aspect-[4/5] bg-stone-200/60" />
            <div className="space-y-6 pt-4">
              <div className="h-8 w-2/3 bg-stone-200/60 rounded" />
              <div className="h-5 w-1/3 bg-stone-200/60 rounded" />
              <div className="h-20 w-full bg-stone-200/60 rounded" />
              <div className="h-12 w-full bg-stone-200/60 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto max-w-3xl px-4 py-32 text-center">
          <h2 className="text-xl tracking-[-0.4px] text-ink font-semibold">
            Product Unavailable
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            This piece may be out of stock or archived from our current collection.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex items-center gap-2 border px-6 text-ink h-11 rounded-full border-hairline-strong bg-surface text-sm font-medium transition-colors hover:bg-hairline-soft"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const rawImages = product.images?.length > 0 ? product.images : [
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
  ];
  const imageSet = product.primaryImage
    ? [product.primaryImage, ...rawImages.filter(img => img !== product.primaryImage)]
    : rawImages;

  // A size is "unavailable" if no variant exists for it, or stock is 0
  // Offer the sizes the product actually has; fall back to the standard range for products without variants.
  const variantSizes = Array.from(
    new Set(
      (product.variants ?? [])
        .map((variant) => variant.size?.trim())
        .filter((size): size is string => !!size && !size.includes(',')),
    ),
  );
  const sizeOptions = variantSizes.length
    ? [
        ...SIZE_LIST.filter((size) => variantSizes.includes(size)),
        ...variantSizes.filter((size) => !SIZE_LIST.includes(size)),
      ]
    : SIZE_LIST;
  const unavailableSizes = sizeOptions.filter((size) =>
    isSizeUnavailable(product.variants, size)
  );

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Toast */}
      {toastMessage && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white shadow-2xl h-11 transition-colors hover:bg-ink-hover">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="pb-24 pt-6 lg:pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-mute">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/" className="hover:text-ink">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link to="/products" className="hover:text-ink">Shop</Link></li>
              <li aria-hidden="true">/</li>
              <li className="truncate text-ink" aria-current="page">{product.name}</li>
            </ol>
          </nav>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_480px]">
            {/* Gallery: thumbnails left on desktop, below on phones */}
            <div className="flex flex-col-reverse gap-3 lg:sticky lg:top-28 lg:flex-row">
              {imageSet.length > 1 && (
                <div className="flex gap-2 overflow-x-auto lg:max-h-[640px] lg:flex-col lg:overflow-y-auto" aria-label="Product images">
                  {imageSet.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-current={selectedImage === idx ? 'true' : undefined}
                      aria-label={`Show image ${idx + 1} of ${imageSet.length}`}
                      onClick={() => setSelectedImage(idx)}
                      className={`h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                        selectedImage === idx ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={optimizeImage(img, 200)} alt="" className="h-full w-full object-cover object-top" />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-hairline bg-hairline-soft lg:max-h-[720px]">
                <img
                  src={optimizeImage(imageSet[selectedImage], 1000)}
                  alt={product.name}
                  className="h-full w-full object-cover object-top"
                />
                {imageSet.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedImage((prev) => (prev - 1 + imageSet.length) % imageSet.length)}
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface/90 text-ink backdrop-blur hover:bg-surface"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedImage((prev) => (prev + 1) % imageSet.length)}
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface/90 text-ink backdrop-blur hover:bg-surface"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="absolute bottom-3 right-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-surface/90 px-3 text-sm font-medium text-ink backdrop-blur hover:bg-surface"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" /> Zoom
                </button>
              </div>
            </div>

            {/* Buy box */}
            <div className="w-full">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-[32px] font-semibold leading-10 tracking-[-1.28px] text-ink">{product.name}</h1>
                <div className="flex shrink-0 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface hover:border-ink"
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                    aria-pressed={isWishlisted}
                  >
                    <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-accent text-accent' : 'text-ink'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface hover:border-ink"
                    aria-label="Share"
                  >
                    <Share2 className="h-4 w-4 text-ink" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${product.inStock ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${product.inStock ? 'bg-emerald-600' : 'bg-red-600'}`} aria-hidden="true" />
                  {product.inStock ? 'In stock' : 'Out of stock'}
                </span>
                {product.isNewArrival && <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 font-mono text-xs uppercase text-ink">New</span>}
                {product.isBestSeller && <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 font-mono text-xs uppercase text-ink">Bestseller</span>}
              </div>

              <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[32px] font-semibold leading-10 tracking-[-1px] text-ink tabular-nums">₹{(product.price ?? 0).toLocaleString('en-IN')}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-base text-mute line-through tabular-nums">
                    <span className="sr-only">Was </span>₹{(product.originalPrice ?? 0).toLocaleString('en-IN')}
                  </span>
                )}
                {discountPercent !== null && <span className="text-sm font-medium text-accent">{discountPercent}% off</span>}
              </div>
              <p className="mt-1 text-sm text-mute">Inclusive of all taxes</p>

              {product.shortDescription && <p className="mt-5 text-base text-body">{product.shortDescription}</p>}

              {product.tags && product.tags.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
                  {product.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-hairline-soft px-2.5 py-0.5 text-xs text-body">{tag}</li>
                  ))}
                </ul>
              )}

              {/* Size */}
              <fieldset className="mt-8 border-t border-hairline pt-6">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium text-ink">
                    Size{selectedSize ? <span className="font-normal text-mute">: {selectedSize}</span> : null}
                  </legend>
                  <button
                    type="button"
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-ink underline underline-offset-4 hover:text-body"
                  >
                    <Ruler className="h-4 w-4" aria-hidden="true" /> Size guide
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sizeOptions.map((size) => {
                    const disabled = unavailableSizes.includes(size);
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSize(size)}
                        className={`inline-flex h-11 min-w-12 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                          isSelected ? 'border-ink bg-ink text-white' : 'border-hairline-strong bg-surface text-ink hover:border-ink'
                        } ${disabled ? 'cursor-not-allowed text-faint line-through opacity-60 hover:border-hairline-strong' : ''}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                {product.variants?.some((variant) => variant.size?.includes(',')) && (
                  <p className="mt-3 text-sm text-amber-700" role="status">
                    Size-wise stock is being configured. Each size must have its own inventory variant before it can be selected.
                  </p>
                )}
              </fieldset>

              {!isAdmin && (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <div className="flex h-12 w-full items-center justify-between rounded-full border border-hairline-strong bg-surface px-1 sm:w-32" role="group" aria-label="Quantity">
                    <button
                      type="button"
                      onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-hairline-soft disabled:text-faint"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-base font-medium tabular-nums text-ink" aria-live="polite">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((v) => v + 1)}
                      aria-label="Increase quantity"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-hairline-soft"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className={`btn-primary h-12 flex-1 ${addedToCart ? '!bg-emerald-700' : ''}`}
                  >
                    {!product.inStock ? 'Out of stock' : addedToCart ? 'Added to cart' : 'Add to cart'}
                  </button>
                </div>
              )}
              {!isAdmin && (
                <button type="button" onClick={handleToggleWishlist} className="btn-secondary mt-3 h-12 w-full">
                  <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-accent text-accent' : ''}`} aria-hidden="true" />
                  {isWishlisted ? 'Saved to wishlist' : 'Save to wishlist'}
                </button>
              )}

              {/* Details */}
              <div className="mt-10 border-t border-hairline">
                {ACCORDION_ITEMS.map((item) => {
                  const isOpen = openAccordion === item.key;
                  const content = getDefaultAccordionContent(item.key, product);
                  if (!content) return null;
                  const panelId = `pdp-panel-${item.key}`;
                  return (
                    <div key={item.key} className="border-b border-hairline">
                      <h2>
                        <button
                          type="button"
                          onClick={() => setOpenAccordion(isOpen ? null : item.key)}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-ink"
                        >
                          {item.label.charAt(0).toUpperCase() + item.label.slice(1).toLowerCase()}
                          <ChevronDown className={`h-4 w-4 text-mute transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      </h2>
                      {isOpen && (
                        <div id={panelId} className="pb-5 text-sm leading-6 text-body">
                          {content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {product && (
          <section className="mx-auto mt-20 max-w-7xl border-t border-hairline px-4 pt-14 sm:px-6 lg:px-8">
            <ProductComments key={product._id} productId={product._id} />
          </section>
        )}

        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mx-auto mt-20 max-w-7xl border-t border-hairline px-4 pt-14 sm:px-6 lg:px-8">
            <SectionHeader id="related-title" eyebrow="You may also like" title="More to explore" action={{ label: 'View all', to: '/products' }} />
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard
                  key={item._id}
                  href={`/product/${item.slug}`}
                  title={item.name}
                  image={item.primaryImage || item.images?.[0]}
                  price={item.price ?? 0}
                  originalPrice={item.originalPrice}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Fullscreen Lightbox Modal with Magnifier */}
      {isPreviewOpen && (
        <LightboxWithMagnifier
          imageSet={imageSet}
          selectedImage={selectedImage}
          productName={product.name}
          onClose={() => setIsPreviewOpen(false)}
          onNext={() => setSelectedImage((p) => (p + 1) % imageSet.length)}
          onPrev={() => setSelectedImage((p) => (p - 1 + imageSet.length) % imageSet.length)}
        />
      )}

      {/* Size Chart Modal */}
      {isSizeGuideOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-canvas p-6 sm:p-8 space-y-6 border border-ink">
            <div className="flex items-center justify-between border-b border-stone-300 pb-4">
              <span className="text-base text-ink font-semibold">
                SIZE CHART & MEASUREMENTS
              </span>
              <button
                type="button"
                onClick={() => setIsSizeGuideOpen(false)}
                className="p-1 text-stone-600 hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-canvas uppercase tracking-wider font-semibold border-b border-stone-300">
                  <tr>
                    <th className="p-3">Size</th>
                    <th className="p-3">Bust</th>
                    <th className="p-3">Waist</th>
                    <th className="p-3">Hips</th>
                    <th className="p-3">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-300/60 font-normal">
                  {SIZE_CHART.map((row) => (
                    <tr key={row.size} className="hover:bg-stone-200/50">
                      <td className="p-3 font-semibold text-stone-900">{row.size}</td>
                      <td className="p-3">{row.bust}</td>
                      <td className="p-3">{row.waist}</td>
                      <td className="p-3">{row.hips}</td>
                      <td className="p-3">{row.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              Measurements are specified in inches. Need custom dimensions? Speak with our atelier stylist directly via WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* Cart Side Drawer */}
      <CartSideDrawer isOpen={isCartDrawerOpen} onClose={() => setIsCartDrawerOpen(false)} />
    </div>
  );
};

export default ProductDetails;
