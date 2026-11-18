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
            <span className="text-[#D4AF37] opacity-80 mt-1.5 text-[10px]">♦</span>
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
            <span className="text-[#D4AF37] opacity-80 mt-1.5 text-[10px]">♦</span>
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
          <span className="text-xs font-semibold tracking-widest uppercase text-white/60">
            {productName}
          </span>
          <div className="flex items-center gap-3">
            {/* Zoom toggle */}
            <button
              type="button"
              onClick={() => setIsMagnifierOn((v) => !v)}
              title={isMagnifierOn ? 'Disable magnifier' : 'Enable magnifier'}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wider transition-all ${isMagnifierOn
                ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
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
        <div className="relative flex-1 flex items-center justify-center bg-[#0d0d0d] min-h-0">

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
                  border: '2.5px solid #D4AF37',
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
                  ? 'border-[#D4AF37] opacity-100 ring-1 ring-[#D4AF37]'
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
            <ZoomIn className="h-3 w-3 text-[#D4AF37]" />
            <span className="text-[10px] tracking-wider text-white/40 uppercase font-medium">
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
      <div className="min-h-screen bg-[#FAF7F2]">
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
      <div className="min-h-screen bg-[#FAF7F2]">
        <div className="mx-auto max-w-3xl px-4 py-32 text-center">
          <h2 className="font-serif text-2xl tracking-widest text-[#4A3B32] uppercase">
            Product Unavailable
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            This piece may be out of stock or archived from our current collection.
          </p>
          <Link
            to="/products"
            className="mt-6 inline-flex items-center gap-2 border border-[#4A3B32] px-6 py-3 text-xs tracking-widest uppercase text-[#4A3B32] hover:bg-[#4A3B32] hover:text-white transition-all"
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D2C24] font-sans antialiased selection:bg-[#B38756]/20">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 rounded-full border border-[#B38756]/40 bg-[#2D211A] px-6 py-3 text-xs font-medium uppercase tracking-widest text-[#FAF7F2] shadow-2xl backdrop-blur-md animate-in fade-in duration-300">
          <Sparkles className="h-4 w-4 text-[#D4AF37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main High-Fashion Split Layout */}
      <main className="pt-24 lg:pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[430px_1fr] xl:grid-cols-[460px_1fr] gap-8 lg:gap-14 items-start">

            {/* LEFT: Compact Sticky Image Carousel */}
            <div className="relative group w-full max-w-[460px] mx-auto lg:mx-0 lg:sticky lg:top-28 self-start space-y-3">
              <div className="relative aspect-[3/4] max-h-[540px] w-full overflow-hidden rounded-2xl border border-stone-300/40 bg-white shadow-sm flex items-center justify-center">
                <img
                  src={optimizeImage(imageSet[selectedImage], 800)}
                  alt={product.name}
                  className="h-full w-full object-cover object-center transition-all duration-500"
                />

                {/* Overlaid Prev / Next Slider Arrows (Matching Screenshot) */}
                {imageSet.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImage((prev) => (prev - 1 + imageSet.length) % imageSet.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-stone-900 shadow-md backdrop-blur transition-all opacity-80 hover:opacity-100 hover:bg-white"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5 stroke-[1.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedImage((prev) => (prev + 1) % imageSet.length)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-stone-900 shadow-md backdrop-blur transition-all opacity-80 hover:opacity-100 hover:bg-white"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5 stroke-[1.5]" />
                    </button>
                  </>
                )}

                {/* Fullscreen Zoom Trigger */}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="absolute bottom-3 right-3 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-transform hover:scale-110"
                  title="Inspect detail"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Thumbnail Strip Below Stage */}
              {imageSet.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto p-1 justify-center">
                  {imageSet.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`h-14 w-12 shrink-0 overflow-hidden rounded-lg border transition-all ${selectedImage === idx
                        ? 'border-[#3D2C24] opacity-100 ring-1 ring-[#3D2C24] scale-105'
                        : 'border-transparent opacity-50 hover:opacity-90'
                        }`}
                    >
                      <img src={optimizeImage(img, 200)} alt="" className="h-full w-full object-cover bg-white" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* RIGHT: High-Fashion Product Info & Order Panel */}
            <div className="py-2 w-full max-w-2xl">
              {/* Main Card Container matching Screenshot 1 */}
              <div className="rounded-[2rem] border border-stone-200/80 bg-white p-2 sm:p-8 lg:p-6 shadow-sm relative">

                {/* Wishlist & Share absolute positioning */}
                <div className="absolute top-6 right-6 sm:top-8 sm:right-8 flex gap-3 z-10">
                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 transition-colors ${isWishlisted ? 'border-[#3D2C24]' : 'hover:border-[#3D2C24]'}`}
                    aria-label="Wishlist"
                  >
                    <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-[#3D2C24] text-[#3D2C24]' : 'text-stone-500'}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 transition-colors hover:border-[#3D2C24]"
                    aria-label="Share"
                  >
                    <Share2 className="h-4 w-4 text-stone-500" />
                  </button>
                </div>

                <div className="space-y-3 ">
                  {/* Collection Label & Title */}
                  <h1 className="font-sans text-3xl sm:text-4xl text-[#1F2937] font-semibold pr-18">
                    {product.name}
                  </h1>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold tracking-wider">
                    {product.inStock ? (
                      <span className="rounded-full bg-emerald-100/60 px-3 py-1.5 text-emerald-600">
                        In Stock
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100/60 px-3 py-1.5 text-red-600">
                        Out of Stock
                      </span>
                    )}
                    {product.isNewArrival && (
                      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-600">
                        New Arrival
                      </span>
                    )}
                    {product.isBestSeller && (
                      <span className="rounded-full bg-orange-50 px-3 py-1.5 text-orange-600">
                        Best Seller
                      </span>
                    )}
                  </div>
                  {product.shortDescription && (
                    <p className="text-[14px] text-[#4b5563] mt-2 leading-relaxed max-w-[90%]">
                      {product.shortDescription}
                    </p>
                  )}

                  {/* Tags */}
                  {product.tags && product.tags.length > 0 && (
                    <div className="text-[13px] text-[#4b5563] flex flex-wrap gap-x-2 gap-y-1 leading-relaxed">
                      {product.tags.map((tag, i, arr) => (
                        <React.Fragment key={tag}>
                          <span>{tag}</span>
                          {i < arr.length - 1 && <span className="text-stone-300">|</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Price */}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[28px] font-semibold text-[#1F2937]">
                      ₹{(product.price ?? 0).toLocaleString('en-IN')}
                    </span>
                    {product.originalPrice && (
                      <span className="text-lg text-[#9ca3af] line-through decoration-[#9ca3af]/60 font-medium">
                        ₹{(product.originalPrice ?? 0).toLocaleString('en-IN')}
                      </span>
                    )}
                    {discountPercent !== null && (
                      <span className="ml-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-[#f43f5e]">
                        {discountPercent}% OFF
                      </span>
                    )}
                  </div>

                  {/* Size Selector */}
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold tracking-[0.25em] text-[#374151]">
                        SIZE
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSizeGuideOpen(true)}
                        className="flex items-center gap-1.5 rounded-full border border-[#D4AF37] px-4 py-1.5 text-[10px] font-semibold tracking-widest text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-colors"
                      >
                        <Ruler className="h-3 w-3" /> SIZE GUIDE
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      {sizeOptions.map((size) => {
                        const disabled = unavailableSizes.includes(size);
                        const isSelected = selectedSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={disabled}
                            onClick={() => setSelectedSize(size)}
                            className={`flex h-11 w-11 items-center justify-center rounded-full border text-[13px] transition-all ${isSelected
                              ? 'border-[#374151] text-[#374151] bg-[#f9fafb]'
                              : 'border-stone-200 text-stone-500 hover:border-[#374151]'
                              } ${disabled ? 'opacity-40 cursor-not-allowed bg-stone-50' : ''}`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                    {product.variants?.some((variant) => variant.size?.includes(',')) && (
                      <p className="text-xs text-amber-700" role="status">
                        Size-wise stock is being configured. Each size must have its own inventory variant before it can be selected.
                      </p>
                    )}
                  </div>

                  {/* Quantity Selector */}
                  {!isAdmin && (
                    <div className="pt-4 space-y-4">
                      <span className="text-[11px] font-bold tracking-[0.25em] text-[#374151] block">
                        QUANTITY
                      </span>
                      <div className="flex h-12 w-[110px] items-center justify-between rounded-full border border-stone-200 px-4">
                        <button
                          type="button"
                          onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                          className="text-stone-400 hover:text-[#1F2937] transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="font-semibold text-[#1F2937]">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity((v) => v + 1)}
                          className="text-stone-400 hover:text-[#1F2937] transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons: Add to Cart (Pink), Add to Wishlist (Grey) mapping to screenshot's layout */}
                  {!isAdmin && (
                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!product.inStock}
                        className={`flex-1 rounded-xl py-3.5 text-[15px] font-semibold text-white transition-all ${addedToCart
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : 'bg-[#C2185B] hover:bg-[#AD1457]'
                          } disabled:opacity-50`}
                      >
                        {addedToCart ? 'Added to Cart' : 'Add to Cart'}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleWishlist}
                        className="flex-1 rounded-xl bg-[#4A3B32] hover:bg-[#3D2C24] py-3.5 text-[15px] font-semibold text-white transition-all"
                      >
                        {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Accordions Matching Screenshot 2 (Rounded distinct boxes) */}
              <div className="mt-8 flex flex-col gap-4">
                {ACCORDION_ITEMS.map((item) => {
                  const isOpen = openAccordion === item.key;
                  const content = getDefaultAccordionContent(item.key, product);
                  if (!content) return null;

                  return (
                    <div
                      key={item.key}
                      className={`overflow-hidden rounded-2xl border transition-colors ${isOpen ? 'border-[#D4AF37]/50 bg-white' : 'border-stone-200 bg-white'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenAccordion(isOpen ? null : item.key)}
                        className="flex w-full items-center justify-between px-6 py-[18px]"
                      >
                        <span className="text-[13px] font-semibold tracking-[0.2em] text-[#1F2937] uppercase">
                          {item.label}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-[#D4AF37]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-stone-400" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-6 pt-0 text-[14px] text-stone-600 leading-[1.8] font-light">
                          {content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>         </div>
        </div>


        {/* Product Comments / Feedback Section */}
        {product && (
          <section className="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-12 mt-16 pb-8">
            <ProductComments key={product._id} productId={product._id} />
          </section>
        )}

        {/* Related Products Carousel */}
        {related.length > 0 && (
          <section className="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-12 mt-24 pt-16 border-t border-stone-300/60 space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl sm:text-2xl tracking-[0.15em] text-[#3D2C24] uppercase">
                YOU MAY ALSO ADMIRE
              </h2>
              <Link
                to="/products"
                className="text-xs font-semibold uppercase tracking-widest text-[#3D2C24] hover:text-[#A87443] transition-colors"
              >
                VIEW ALL
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link
                  key={item._id}
                  to={`/product/${item.slug}`}
                  className="group space-y-3"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-white border border-stone-200/40 rounded-lg flex items-center justify-center">
                    <img
                      src={optimizeImage(item.primaryImage || item.images?.[0], 400)}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="space-y-1 text-xs tracking-wider">
                    <h3 className="font-serif text-stone-900 uppercase line-clamp-1 group-hover:text-[#A87443] transition-colors">
                      {item.name}
                    </h3>
                    <p className="font-semibold text-stone-800">
                      INR {(item.price ?? 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </Link>
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
          <div className="relative w-full max-w-xl bg-[#FAF7F2] p-6 sm:p-8 space-y-6 border border-[#3D2C24]">
            <div className="flex items-center justify-between border-b border-stone-300 pb-4">
              <span className="font-serif text-lg tracking-widest text-[#3D2C24] uppercase">
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
                <thead className="bg-[#EFE8DC] uppercase tracking-wider font-semibold border-b border-stone-300">
                  <tr>
                    <th className="p-3">Size</th>
                    <th className="p-3">Bust</th>
                    <th className="p-3">Waist</th>
                    <th className="p-3">Hips</th>
                    <th className="p-3">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-300/60 font-light">
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

            <p className="text-xs text-stone-600 leading-relaxed font-light">
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
