import { Model } from "@/db/odm";

// Every Mongoose model from the Express app, mapped to its Turso table, with
// the `ref` of each ObjectId path so `.populate(path)` works unchanged.

const audit = { createdBy: "User", updatedBy: "User" };

export const User = new Model("User", "users", { addresses: "Address", wishlist: "Product" });
export const Product = new Model("Product", "products", {
  categoryId: "Category",
  subcategoryId: "Category",
  collectionIds: "Collection",
  tagIds: "Tag",
  relatedProductIds: "Product",
  crossSellIds: "Product",
  upSellIds: "Product",
  ...audit,
});
export const Variant = new Model("Variant", "variants", { productId: "Product", ...audit });
export const Category = new Model("Category", "categories", { parentId: "Category", ...audit });
export const Collection = new Model("Collection", "collections", { productIds: "Product", ...audit });
export const Tag = new Model("Tag", "tags", audit);
export const Order = new Model("Order", "orders", {
  userId: "User",
  items: "OrderItem",
  couponId: "Coupon",
  "statusHistory.actorId": "User",
});
export const OrderItem = new Model("OrderItem", "orderitems", { orderId: "Order", productId: "Product", variantId: "Variant" });
export const Cart = new Model("Cart", "carts", { user: "User", "items.productId": "Product", "items.variantId": "Variant" });
export const Coupon = new Model("Coupon", "coupons", {
  "scope.categoryIds": "Category",
  "scope.collectionIds": "Collection",
  "scope.productIds": "Product",
  ...audit,
});
export const Address = new Model("Address", "addresses", { userId: "User" });
export const Exchange = new Model("Exchange", "exchanges", {
  orderId: "Order",
  orderItemId: "OrderItem",
  requestedBy: "User",
  requestedVariantId: "Variant",
  "adminDecision.decidedBy": "User",
  "qcResult.recordedBy": "User",
});
export const Comment = new Model("Comment", "comments", { productId: "Product", userId: "User" });
export const MediaAsset = new Model("MediaAsset", "media_assets", { uploadedBy: "User" });
export const NotificationTemplate = new Model("NotificationTemplate", "notification_templates", { updatedBy: "User" });
export const NotificationLog = new Model("NotificationLog", "notification_logs", { userId: "User" });
export const AuditLog = new Model("AuditLog", "audit_logs", { actorId: "User" });
export const InventoryAuditLog = new Model("InventoryAuditLog", "inventoryauditlogs", { variantId: "Variant", actorId: "User" });
export const AdminNotification = new Model("AdminNotification", "adminnotifications", {});
export const AboutUs = new Model("AboutUs", "about_us", audit);
export const AnnouncementBar = new Model("AnnouncementBar", "announcement_bars", audit);
export const Banner = new Model("Banner", "banners", audit);
export const CollectionsShowcase = new Model("CollectionsShowcase", "collections_showcase", audit);
export const Contact = new Model("Contact", "contacts", audit);
export const ContactInquiry = new Model("ContactInquiry", "contact_inquiries", {});
export const FeaturedSection = new Model("FeaturedSection", "featured_sections", { productIds: "Product", ...audit });
export const Hero = new Model("Hero", "heroes", audit);
/** Orders exactly as Shiprocket Checkout's order webhook sent them (see shiprocketOrderRoutes). */
export const ShiprocketOrder = new Model("ShiprocketOrder", "shiprocketorders", {});
export const StaticPage = new Model("StaticPage", "static_pages", audit);
export const HomepageVideoCard = new Model("HomepageVideoCard", "homepage_video_cards", audit);

export const registry: Record<string, Model<any>> = {
  User, Product, Variant, Category, Collection, Tag, Order, OrderItem, Cart, Coupon, Address, Exchange,
  Comment, MediaAsset, NotificationTemplate, NotificationLog, AuditLog, InventoryAuditLog, AdminNotification,
  AboutUs, AnnouncementBar, Banner, CollectionsShowcase, Contact, ContactInquiry, FeaturedSection, Hero,
  StaticPage, HomepageVideoCard,
};
