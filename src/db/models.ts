import type { CollectionName } from "./schema";
import type { Doc } from "./query";

// Per-collection behaviour that Mongoose schemas used to provide: default
// values on insert, fields hidden from normal reads (`select: false`),
// timestamps, sub-documents that get their own `_id`, value normalisation
// (trim/lowercase), and the scalar paths that are safe to filter in SQL.

export type ModelConfig = {
  timestamps: boolean;
  /** Fields omitted unless selected with `+field`. */
  hidden?: string[];
  /** Default values applied (deep) on insert. */
  defaults?: () => Doc;
  /** Array paths whose new elements get an `_id`. */
  subdocIds?: string[];
  /** Normalise a document before it is written. */
  normalize?: (doc: Doc) => void;
  /** Scalar (or array-of-scalar) paths that can be filtered/sorted in SQL. */
  sqlPaths: string[];
  /** Unique constraints, checked like MongoDB's duplicate key error. */
  unique?: { paths: string[]; sparse?: boolean; caseInsensitive?: boolean }[];
  /** Top-level schema fields. Unknown keys are dropped on write (Mongoose strict mode). Omit for strict: false. */
  fields?: string[];
  /** Sub-document defaults (arrays or single objects), plus per-item timestamps. */
  subdocs?: Record<string, { defaults: () => Doc; timestamps?: boolean }>;
};

const image = () => ({ altText: "", role: "gallery", sortOrder: 0 });
const f = (s: string) => s.split(/[\s,]+/).filter(Boolean);

const trim = (doc: Doc, ...paths: string[]) => {
  for (const p of paths) if (typeof doc[p] === "string") doc[p] = doc[p].trim();
};
const lower = (doc: Doc, ...paths: string[]) => {
  for (const p of paths) if (typeof doc[p] === "string") doc[p] = doc[p].trim().toLowerCase();
};

const audit = () => ({ createdBy: null, updatedBy: null, isDeleted: false, deletedAt: null });
const schedule = () => ({ startsAt: null, endsAt: null });

export const MODELS: Record<CollectionName, ModelConfig> = {
  users: {
    fields: f("name email pendingEmail phone password authProvider role status addresses address wishlist isEmailVerified emailVerified refreshToken refreshTokenExpiresAt passwordResetToken passwordResetExpiresAt verificationToken verificationTokenExpiresAt loginAttempts lockUntil lastLoginAt isDeleted deletedAt isActive"),
    timestamps: true,
    hidden: [
      "password",
      "refreshToken",
      "refreshTokenExpiresAt",
      "passwordResetToken",
      "passwordResetExpiresAt",
      "verificationToken",
      "verificationTokenExpiresAt",
    ],
    defaults: () => ({
      pendingEmail: null,
      authProvider: "local",
      role: "USER",
      status: "active",
      addresses: [],
      address: { country: null, state: null, city: null, addressLine: null, pincode: null },
      wishlist: [],
      isEmailVerified: false,
      emailVerified: false,
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: null,
      isDeleted: false,
      deletedAt: null,
      isActive: true,
    }),
    normalize: (d) => {
      trim(d, "name", "phone");
      lower(d, "email", "pendingEmail");
    },
    sqlPaths: ["email", "role", "status", "isDeleted", "phone", "createdAt", "authProvider", "passwordResetToken", "verificationToken", "refreshToken"],
    unique: [{ paths: ["email"] }, { paths: ["phone"], sparse: true }],
  },
  products: {
    fields: f("title slug shortDescription description basePrice mrp sku taxRate hsnCode categoryId subcategoryId collectionIds tagIds designer brand occasions season gender ageGroup flags isCODEligible isCouponEligible exchangeWindowDays images primaryImage highlights productDetails sizeFit stylingTips careInstructions deliveryReturns disclaimer specifications shipping relatedProductIds crossSellIds upSellIds seo status externalShiprocketId createdBy updatedBy isDeleted deletedAt"),
    subdocs: { images: { defaults: image } },
    timestamps: true,
    defaults: () => ({
      shortDescription: null,
      description: null,
      mrp: null,
      sku: null,
      taxRate: 0,
      hsnCode: null,
      categoryId: null,
      subcategoryId: null,
      collectionIds: [],
      tagIds: [],
      designer: null,
      brand: null,
      occasions: [],
      season: null,
      gender: "Unisex",
      ageGroup: "Adult",
      flags: {
        isNewArrival: false,
        isFeatured: false,
        isBestSeller: false,
        isTrending: false,
        isLimitedEdition: false,
        isMadeToOrder: false,
        isReadyToShip: true,
        isPreOrder: false,
      },
      isCODEligible: true,
      isCouponEligible: true,
      exchangeWindowDays: null,
      images: [],
      primaryImage: null,
      highlights: [],
      productDetails: [],
      sizeFit: [],
      stylingTips: [],
      careInstructions: [],
      deliveryReturns: [],
      disclaimer: null,
      specifications: {
        fabric: null,
        careInstructions: null,
        fitNotes: null,
        measurements: null,
        washCare: null,
        countryOfOrigin: "India",
      },
      shipping: { weight: null, dimensions: { length: null, width: null, height: null }, shippingClass: null },
      relatedProductIds: [],
      crossSellIds: [],
      upSellIds: [],
      seo: { metaTitle: null, metaDescription: null, metaKeywords: [], canonicalUrl: null, ogImage: null },
      status: "draft",
      externalShiprocketId: null,
      ...audit(),
    }),
    normalize: (d) => {
      trim(d, "title", "sku");
      lower(d, "slug");
    },
    sqlPaths: [
      "slug", "status", "isDeleted", "categoryId", "subcategoryId", "collectionIds", "tagIds", "sku",
      "flags.isFeatured", "flags.isNewArrival", "flags.isTrending", "flags.isBestSeller", "gender", "designer",
      "brand", "basePrice", "createdAt", "updatedAt", "externalShiprocketId", "title",
    ],
    unique: [{ paths: ["slug"] }],
  },
  variants: {
    fields: f("productId title size color fabric optionValues sku barcode externalShiprocketId price stock reservedStock availableStock inventory images weight weightUnit dimensions createdBy updatedBy isDeleted deletedAt"),
    subdocs: { images: { defaults: image } },
    timestamps: true,
    defaults: () => ({
      title: null,
      optionValues: null,
      externalShiprocketId: null,
      stock: 10,
      reservedStock: 0,
      availableStock: 10,
      inventory: { quantity: 0 },
      images: [],
      weight: null,
      weightUnit: "kg",
      dimensions: { length: null, width: null, height: null },
      ...audit(),
    }),
    normalize: (d) => {
      if (d.stock !== undefined || d.reservedStock !== undefined) {
        d.availableStock = Math.max(0, (d.stock || 0) - (d.reservedStock || 0));
      }
    },
    sqlPaths: ["productId", "sku", "barcode", "isDeleted", "size", "color", "fabric", "availableStock", "stock", "externalShiprocketId", "createdAt"],
    unique: [{ paths: ["sku"] }, { paths: ["barcode"], sparse: true }],
  },
  categories: {
    fields: f("name slug parentId bannerUrl description seo displayOrder status createdBy updatedBy isDeleted deletedAt"),
    timestamps: true,
    defaults: () => ({
      parentId: null,
      bannerUrl: null,
      description: null,
      seo: { metaTitle: null, metaDescription: null, ogImage: null },
      displayOrder: 0,
      status: "active",
      ...audit(),
    }),
    normalize: (d) => {
      trim(d, "name");
      lower(d, "slug");
    },
    sqlPaths: ["slug", "parentId", "status", "isDeleted", "displayOrder", "name", "createdAt"],
    unique: [{ paths: ["slug"] }],
  },
  collections: {
    fields: f("name slug description externalShiprocketId imageUrl type productIds rules startsAt endsAt status createdBy updatedBy isDeleted deletedAt"),
    subdocs: { rules: { defaults: () => ({ field: null, operator: null, value: null }) } },
    timestamps: true,
    subdocIds: ["rules"],
    defaults: () => ({
      description: null,
      externalShiprocketId: null,
      imageUrl: null,
      productIds: [],
      rules: [],
      startsAt: null,
      endsAt: null,
      status: "active",
      ...audit(),
    }),
    normalize: (d) => {
      trim(d, "name");
      lower(d, "slug");
    },
    sqlPaths: ["slug", "status", "isDeleted", "type", "productIds", "externalShiprocketId", "createdAt", "name"],
    unique: [{ paths: ["slug"] }],
  },
  tags: {
    fields: f("name slug createdBy updatedBy isDeleted deletedAt"),
    timestamps: true,
    defaults: () => ({ ...audit() }),
    normalize: (d) => {
      trim(d, "name");
      lower(d, "slug");
    },
    sqlPaths: ["slug", "isDeleted", "createdAt", "name"],
    unique: [{ paths: ["slug"] }, { paths: ["name"], caseInsensitive: true }],
  },
  orders: {
    // shiprocketShipping: the order in Shiprocket's shipping panel { orderId, shipmentId, status, awb, courier, error } (shiprocketShipping.ts)
    fields: f("orderNumber userId guestEmail items shippingAddress couponId couponCode discountAmount shippingCharge taxAmount subtotal total paymentMethod shiprocketOrderId shiprocketShipping source status statusHistory notes isDeleted deletedAt"),
    subdocs: { statusHistory: { defaults: () => ({ timestamp: new Date().toISOString(), actorId: null, actorEmail: null, note: null }) }, shippingAddress: { defaults: () => ({ deliveryPhone: null }) } },
    timestamps: true,
    defaults: () => ({
      userId: null,
      guestEmail: null,
      items: [],
      couponId: null,
      couponCode: null,
      discountAmount: 0,
      shippingCharge: 0,
      taxAmount: 0,
      shiprocketOrderId: null,
      shiprocketShipping: null,
      source: "native",
      status: "Created",
      statusHistory: [],
      notes: null,
      isDeleted: false,
      deletedAt: null,
    }),
    sqlPaths: ["orderNumber", "userId", "status", "isDeleted", "createdAt", "couponCode", "couponId", "shiprocketOrderId", "paymentMethod", "total", "guestEmail", "source"],
    unique: [{ paths: ["orderNumber"] }, { paths: ["shiprocketOrderId"], sparse: true }],
  },
  orderitems: {
    fields: f("orderId productId variantId productTitle productImage sku size color fabric quantity unitPrice mrp lineTotal"),
    timestamps: true,
    defaults: () => ({ productImage: null, mrp: null }),
    sqlPaths: ["orderId", "productId", "variantId", "createdAt"],
  },
  carts: {
    fields: f("user items subtotal totalItems"),
    subdocs: { items: { defaults: () => ({ variantId: null, selectedSize: "", selectedColor: "", quantity: 1, price: 0 }), timestamps: true } },
    timestamps: true,
    subdocIds: ["items"],
    defaults: () => ({ items: [], subtotal: 0, totalItems: 0 }),
    sqlPaths: ["user"],
    unique: [{ paths: ["user"] }],
  },
  coupons: {
    fields: f("code type value minOrderValue scope startDate endDate usageLimitTotal usageLimitPerCustomer usageCount stackable createdBy updatedBy isActive isDeleted deletedAt"),
    timestamps: true,
    defaults: () => ({
      value: null,
      minOrderValue: 0,
      scope: { categoryIds: [], collectionIds: [], productIds: [] },
      startDate: null,
      endDate: null,
      usageLimitTotal: null,
      usageLimitPerCustomer: null,
      usageCount: 0,
      stackable: false,
      createdBy: null,
      updatedBy: null,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    }),
    normalize: (d) => {
      if (typeof d.code === "string") d.code = d.code.trim().toUpperCase();
    },
    sqlPaths: ["code", "isDeleted", "isActive", "startDate", "endDate", "createdAt", "type"],
    unique: [{ paths: ["code"] }],
  },
  addresses: {
    fields: f("userId name addressLine city state pincode country phone deliveryPhone isDefault isDeleted deletedAt"),
    timestamps: true,
    defaults: () => ({ country: "India", deliveryPhone: null, isDefault: false, isDeleted: false, deletedAt: null }),
    normalize: (d) => trim(d, "name", "addressLine", "city", "state", "country", "phone", "deliveryPhone"),
    sqlPaths: ["userId", "isDefault", "isDeleted", "createdAt"],
  },
  exchanges: {
    fields: f("orderId orderItemId requestedBy reason requestedVariantId status adminDecision qcResult"),
    subdocs: { adminDecision: { defaults: () => ({ decidedBy: null, decidedAt: null, note: null }) }, qcResult: { defaults: () => ({ passed: null, note: null, recordedBy: null, recordedAt: null }) } },
    timestamps: true,
    defaults: () => ({
      requestedVariantId: null,
      status: "ExchangeRequested",
      adminDecision: {},
      qcResult: {},
    }),
    sqlPaths: ["orderId", "orderItemId", "requestedBy", "status", "createdAt"],
  },
  comments: {
    fields: f("productId userId body rating authorName isGuest media isDeleted"),
    subdocs: { media: { defaults: () => ({ publicId: null }) } },
    timestamps: true,
    subdocIds: ["media"],
    defaults: () => ({ rating: null, authorName: null, isGuest: false, media: [], isDeleted: false }),
    normalize: (d) => trim(d, "body", "authorName"),
    sqlPaths: ["productId", "userId", "isDeleted", "createdAt", "rating"],
    unique: [{ paths: ["productId", "userId"] }],
  },
  media_assets: {
    fields: f("cloudinaryPublicId url format resourceType folder tags bytes width height referenceCount uploadedBy isDeleted deletedAt"),
    timestamps: true,
    defaults: () => ({
      format: null,
      resourceType: "image",
      folder: "",
      tags: [],
      bytes: null,
      width: null,
      height: null,
      referenceCount: 0,
      uploadedBy: null,
      isDeleted: false,
      deletedAt: null,
    }),
    normalize: (d) => trim(d, "cloudinaryPublicId", "url", "format", "folder"),
    sqlPaths: ["cloudinaryPublicId", "folder", "tags", "isDeleted", "resourceType", "uploadedBy", "createdAt", "url"],
    unique: [{ paths: ["cloudinaryPublicId"] }],
  },
  notification_templates: {
    fields: f("type subject htmlBody requiredPlaceholders isActive updatedBy"),
    timestamps: true,
    defaults: () => ({ requiredPlaceholders: [], isActive: true, updatedBy: null }),
    normalize: (d) => trim(d, "type"),
    sqlPaths: ["type", "isActive", "createdAt"],
    unique: [{ paths: ["type"] }],
  },
  notification_logs: {
    fields: f("type recipient subject status attempts lastAttemptAt error userId"),
    timestamps: true,
    defaults: () => ({ status: "retrying", attempts: 0, lastAttemptAt: null, error: null, userId: null }),
    normalize: (d) => trim(d, "type", "recipient", "subject"),
    sqlPaths: ["type", "recipient", "status", "userId", "createdAt"],
  },
  audit_logs: {
    fields: f("actorId actorEmail action module entityId beforeSnapshot afterSnapshot ipAddress timestamp"),
    timestamps: false,
    defaults: () => ({
      actorEmail: null,
      module: "unknown",
      entityId: null,
      beforeSnapshot: null,
      afterSnapshot: null,
      ipAddress: null,
      timestamp: new Date().toISOString(),
    }),
    sqlPaths: ["actorId", "module", "timestamp", "entityId", "actorEmail"],
  },
  inventoryauditlogs: {
    fields: f("variantId delta reasonCode note actorId actorEmail timestamp"),
    timestamps: false,
    defaults: () => ({ note: null, actorEmail: null, timestamp: new Date().toISOString() }),
    sqlPaths: ["variantId", "timestamp", "reasonCode", "actorId"],
  },
  adminnotifications: {
    fields: f("title message type relatedId isRead"),
    timestamps: true,
    defaults: () => ({ type: "other", relatedId: null, isRead: false }),
    normalize: (d) => trim(d, "title", "message"),
    sqlPaths: ["isRead", "createdAt", "type"],
  },
  about_us: {
    subdocs: { cards: { defaults: () => ({ title: "", description: "", imageUrl: "", icon: "" }) }, virtues: { defaults: () => ({ label: "", desc: "" }) }, craftBadges: { defaults: () => ({ title: "", description: "", icon: "" }) }, imageBlocks: { defaults: () => ({ imageUrl: "", caption: null, displayOrder: 0 }) } },
    timestamps: true,
    subdocIds: ["cards", "virtues", "craftBadges", "imageBlocks"],
    defaults: () => ({
      heroLabel: "ABOUT MADALSA ATELIER",
      heading: "Timeless Elegance & Contemporary Grace",
      subheading: "Discover the artistry, heritage, and vision behind Madalsa Couture.",
      body: "",
      designerName: "Madalsa Rai",
      designerRole: "Founder & Creative Director",
      designerImageUrl: "",
      establishedYear: "Est. 2024",
      founderQuote:
        "Couture is not merely fabric and thread—it is an intimate dialogue between emotion, art, and confidence.",
      storyParagraphs: [],
      highlights: [],
      cards: [],
      virtues: [],
      craftBadges: [],
      imageBlocks: [],
      status: "active",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    sqlPaths: ["isDeleted", "status", "createdAt"],
  },
  announcement_bars: {
    fields: f("message link backgroundColor textColor countdownTarget status startsAt endsAt isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      link: "",
      backgroundColor: "#D4AF37",
      textColor: "#000000",
      countdownTarget: null,
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    normalize: (d) => trim(d, "message", "link", "backgroundColor", "textColor"),
    sqlPaths: ["isDeleted", "status", "createdAt"],
  },
  banners: {
    fields: f("placement title imageUrl linkUrl ctaLabel ctaUrl showCtaButton promoCouponCode altText priority status startsAt endsAt isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      title: null,
      imageUrl: null,
      linkUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      showCtaButton: false,
      promoCouponCode: null,
      altText: null,
      priority: 0,
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    normalize: (d) => trim(d, "placement"),
    sqlPaths: ["placement", "priority", "status", "isDeleted", "createdAt", "imageUrl"],
  },
  collections_showcase: {
    fields: f("items isDeleted createdBy updatedBy"),
    subdocs: { items: { defaults: () => ({ imageUrl: null, isActive: true, displayOrder: 0 }) } },
    timestamps: true,
    subdocIds: ["items"],
    defaults: () => ({ items: [], isDeleted: false, createdBy: null, updatedBy: null }),
    sqlPaths: ["isDeleted", "createdAt"],
  },
  contacts: {
    fields: f("address phone email businessHours formRoutingEmail mapEmbedUrl status startsAt endsAt isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      address: null,
      phone: null,
      email: null,
      businessHours: null,
      formRoutingEmail: null,
      mapEmbedUrl: null,
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    sqlPaths: ["isDeleted", "status", "createdAt"],
  },
  contact_inquiries: {
    fields: f("name email phone subject message status"),
    timestamps: true,
    defaults: () => ({ phone: null, subject: "General Inquiry", status: "new" }),
    normalize: (d) => {
      trim(d, "name", "phone", "subject", "message");
      lower(d, "email");
    },
    sqlPaths: ["status", "createdAt", "email"],
  },
  featured_sections: {
    fields: f("title subtitle productIds displayOrder status startsAt endsAt isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      subtitle: null,
      productIds: [],
      displayOrder: 0,
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    normalize: (d) => trim(d, "title"),
    sqlPaths: ["displayOrder", "isDeleted", "status", "createdAt"],
  },
  heroes: {
    fields: f("media mediaType mediaUrl headline subHeadline cta styles status startsAt endsAt isDeleted createdBy updatedBy"),
    subdocs: {},
    timestamps: true,
    defaults: () => ({
      subHeadline: "",
      styles: {
        headlineSize: "large",
        subHeadlineSize: "medium",
        buttonSize: "medium",
        buttonStyle: "outline",
        alignment: "bottom-left",
      },
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    sqlPaths: ["isDeleted", "status", "createdAt"],
  },
  static_pages: {
    fields: f("title slug body seo status isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      seo: { metaTitle: null, metaDescription: null, ogImage: null },
      status: "draft",
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    normalize: (d) => {
      trim(d, "title");
      lower(d, "slug");
    },
    sqlPaths: ["slug", "status", "isDeleted", "createdAt"],
    unique: [{ paths: ["slug"] }],
  },
  homepage_video_cards: {
    fields: f("title description videoUrl posterUrl linkUrl buttonText displayOrder status startsAt endsAt isDeleted createdBy updatedBy"),
    timestamps: true,
    defaults: () => ({
      description: "",
      linkUrl: "",
      buttonText: "",
      displayOrder: 0,
      status: "inactive",
      ...schedule(),
      isDeleted: false,
      createdBy: null,
      updatedBy: null,
    }),
    normalize: (d) => trim(d, "title", "description", "videoUrl", "posterUrl", "linkUrl", "buttonText"),
    sqlPaths: ["isDeleted", "status", "displayOrder", "createdAt"],
  },
  counters: { timestamps: false, sqlPaths: [] },
  shiprocket_id_counters: { timestamps: false, sqlPaths: [] },
  payments: { timestamps: true, sqlPaths: ["orderId"] },
  shipments: { timestamps: true, sqlPaths: ["orderId"] },
  // Shiprocket webhook deliveries as received (see shiprocketOrderRoutes / shiprocketOrderImport).
  shiprocketorders: { timestamps: true, sqlPaths: ["kind", "processed", "orderId", "awb"] },
};
