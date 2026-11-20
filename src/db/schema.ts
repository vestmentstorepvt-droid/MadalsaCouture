import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Every MongoDB collection becomes one table: `id` (the original ObjectId) and
// `doc` (the document exactly as the API returns it). Lookups use expression
// indexes on json_extract(doc, ...) — see indexes.ts.

const docTable = (name: string) =>
  sqliteTable(name, {
    id: text("id").primaryKey(),
    doc: text("doc", { mode: "json" }).notNull(),
  });

export const COLLECTION_NAMES = [
  "users",
  "products",
  "variants",
  "categories",
  "collections",
  "tags",
  "orders",
  "orderitems",
  "carts",
  "coupons",
  "addresses",
  "exchanges",
  "comments",
  "media_assets",
  "notification_templates",
  "notification_logs",
  "audit_logs",
  "inventoryauditlogs",
  "adminnotifications",
  "about_us",
  "announcement_bars",
  "banners",
  "collections_showcase",
  "contacts",
  "contact_inquiries",
  "featured_sections",
  "heroes",
  "static_pages",
  "homepage_video_cards",
  "counters",
  "shiprocket_id_counters",
  // Legacy collections kept so nothing from the old database is lost.
  "payments",
  "shipments",
  "shiprocketorders",
  "checkoutsessions",
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

export const users = docTable("users");
export const products = docTable("products");
export const variants = docTable("variants");
export const categories = docTable("categories");
export const collections = docTable("collections");
export const tags = docTable("tags");
export const orders = docTable("orders");
export const orderitems = docTable("orderitems");
export const carts = docTable("carts");
export const coupons = docTable("coupons");
export const addresses = docTable("addresses");
export const exchanges = docTable("exchanges");
export const comments = docTable("comments");
export const mediaAssets = docTable("media_assets");
export const notificationTemplates = docTable("notification_templates");
export const notificationLogs = docTable("notification_logs");
export const auditLogs = docTable("audit_logs");
export const inventoryAuditLogs = docTable("inventoryauditlogs");
export const adminNotifications = docTable("adminnotifications");
export const aboutUs = docTable("about_us");
export const announcementBars = docTable("announcement_bars");
export const banners = docTable("banners");
export const collectionsShowcase = docTable("collections_showcase");
export const contacts = docTable("contacts");
export const contactInquiries = docTable("contact_inquiries");
export const featuredSections = docTable("featured_sections");
export const heroes = docTable("heroes");
export const staticPages = docTable("static_pages");
export const homepageVideoCards = docTable("homepage_video_cards");
export const counters = docTable("counters");
export const shiprocketIdCounters = docTable("shiprocket_id_counters");
export const payments = docTable("payments");
export const shipments = docTable("shipments");
export const shiprocketOrders = docTable("shiprocketorders");
export const checkoutSessions = docTable("checkoutsessions");

/** Webhook/event ids already handled — a repeat delivery is ignored. */
export const processedEvents = sqliteTable("processed_events", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }).notNull(),
});
