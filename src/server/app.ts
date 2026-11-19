// @ts-nocheck — route modules are ported JS; their exports are untyped.
// Port of the Express app.js: same mount paths, same order (order decides which
// router's middleware runs first, exactly as before).
import { errorHandler, notFoundHandler } from "./http/errors";
import { sendSuccess } from "./http/response";
import { Router } from "./http/router";
import { logger } from "./lib/logger";
import { globalLimiter } from "./middleware/security";

import authRoutes from "./routes/authRoutes";
import checkoutRoutes from "./routes/checkoutRoutes";
import productRoutes from "./routes/productRoutes";
import commentRoutes from "./routes/commentRoutes";
import variantRoutes from "./routes/variantRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import collectionRoutes from "./routes/collectionRoutes";
import tagRoutes from "./routes/tagRoutes";
import couponRoutes from "./routes/couponRoutes";
import orderRoutes from "./routes/orderRoutes";
import exchangeRoutes from "./routes/exchangeRoutes";
import addressRouter from "./routes/addressRoutes";
import wishlistRouter from "./routes/wishlistRoutes";
import cartRouter from "./routes/cartRoutes";
import catalogRouter from "./routes/catalogRoutes";
import shiprocketOrderRouter from "./routes/shiprocketOrderRoutes";
import inventoryRouter from "./routes/inventoryRoutes";
import heroRoutes from "./modules/cms/hero/hero.routes";
import announcementBarRoutes from "./modules/cms/announcementBar/announcementBar.routes";
import bannerRoutes from "./modules/cms/banners/banner.routes";
import staticPageRoutes from "./modules/cms/staticPages/staticPages.routes";
import aboutUsRoutes from "./modules/cms/aboutUs/aboutUs.routes";
import contactRoutes from "./modules/cms/contact/contact.routes";
import showcaseRoutes from "./modules/cms/collectionsShowcase/collectionsShowcase.routes";
import featuredSectionRoutes from "./modules/cms/featuredSections/featuredSection.routes";
import videoCardRoutes from "./modules/cms/videoCards/videoCard.routes";
import mediaRouter from "./modules/mediaLibrary/media.routes";
import mediaUploadRouter from "./modules/mediaLibrary/mediaUpload.routes";
import featuredReviewsRouter from "./modules/reviews/featuredReviews.routes";
import auditLogRouter from "./modules/auditLogs/auditLog.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import notificationRouter from "./modules/notifications/notification.routes";
import adminAlertsRouter from "./routes/adminNotificationRoutes";
import adminUsersRouter from "./modules/users/adminUsers.routes";

const app = new Router();

// 2. Security: rate limit (helmet/CORS/body parsing/sanitising happen in the API entry point)
app.use(globalLimiter);

// 3. Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// 4. Public health / root
app.get("/health", (req, res) => sendSuccess(res, { status: "ok" }));
app.get("/api/health", (req, res) => sendSuccess(res, { status: "ok" }));

// 5. Auth + checkout
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/checkout", checkoutRoutes);

// 6. Storefront
app.use("/api/v1/products", productRoutes.publicRouter);
app.use("/api/v1/products/:productId/comments", commentRoutes);
app.use("/api/v1/products", variantRoutes.publicVariantRouter);
app.use("/api/v1/categories", categoryRoutes.publicRouter);
app.use("/api/v1/collections", collectionRoutes.publicRouter);
app.use("/api/v1/tags", tagRoutes.publicRouter);
app.use("/api/v1/coupons", couponRoutes.publicRouter);

// 7. Admin (each admin router protects itself)
app.use("/api/v1/admin/products", productRoutes.adminRouter);
app.use("/api/v1/admin/categories", categoryRoutes.adminRouter);
app.use("/api/v1/admin/collections", collectionRoutes.adminRouter);
app.use("/api/v1/admin/tags", tagRoutes.adminRouter);
app.use("/api/v1/admin/coupons", couponRoutes.adminRouter);

app.use("/api/v1/orders", orderRoutes.customerRouter);
app.use("/api/v1/admin/orders", orderRoutes.adminRouter);
app.use("/api/v1/admin/exchanges", exchangeRoutes.adminRouter);

app.use("/api/v1/addresses", addressRouter);
app.use("/api/v1/wishlist", wishlistRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/fastrr", catalogRouter);
// Shiprocket webhooks (tracking + orders). The path avoids "shiprocket"/"sr"/"kr", which Shiprocket rejects.
app.use("/api/v1/webhooks/store", shiprocketOrderRouter);

app.use("/api/v1/admin/products/:productId/variants", variantRoutes.productVariantRouter);
app.use("/api/v1/admin/variants", variantRoutes.variantRouter);
app.use("/api/v1/admin/inventory", inventoryRouter);

app.use("/api/v1/admin/cms/hero", heroRoutes.adminRouter);
app.use("/api/v1/cms/hero", heroRoutes.publicRouter);
app.use("/api/v1/admin/cms/announcement-bar", announcementBarRoutes.adminRouter);
app.use("/api/v1/cms/announcement-bar", announcementBarRoutes.publicRouter);
app.use("/api/v1/admin/cms/banners", bannerRoutes.adminRouter);
app.use("/api/v1/cms/banners", bannerRoutes.publicRouter);
app.use("/api/v1/admin/cms/static-pages", staticPageRoutes.adminRouter);
app.use("/api/v1/cms/static-pages", staticPageRoutes.publicRouter);
app.use("/api/v1/admin/cms/about-us", aboutUsRoutes.adminRouter);
app.use("/api/v1/cms/about-us", aboutUsRoutes.publicRouter);
app.use("/api/v1/admin/cms/contact", contactRoutes.adminRouter);
app.use("/api/v1/cms/contact", contactRoutes.publicRouter);
app.use("/api/v1/admin/cms/collections-showcase", showcaseRoutes.adminRouter);
app.use("/api/v1/cms/collections-showcase", showcaseRoutes.publicRouter);
app.use("/api/v1/admin/cms/featured-sections", featuredSectionRoutes.adminRouter);
app.use("/api/v1/cms/featured-sections", featuredSectionRoutes.publicRouter);
app.use("/api/v1/admin/cms/video-cards", videoCardRoutes.adminRouter);
app.use("/api/v1/cms/video-cards", videoCardRoutes.publicRouter);

// Direct-to-storage uploads (new: Vercel caps request bodies at 4.5 MB)
app.use("/api/v1/uploads", mediaUploadRouter.publicRouter);
// New (redesign): site-wide featured reviews for the home page
app.use("/api/v1/reviews", featuredReviewsRouter);
app.use("/api/v1/admin/media", mediaUploadRouter.adminRouter);
app.use("/api/v1/admin/media", mediaRouter);
app.use("/api/v1/admin", dashboardRouter);
app.use("/api/v1/admin/notifications", notificationRouter);
app.use("/api/v1/admin/alerts", adminAlertsRouter);
app.use("/api/v1/admin/audit-logs", auditLogRouter); // admin-only, read-only (the router checks both)
app.use("/api/v1/admin", adminUsersRouter);

// 404 + global error handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
