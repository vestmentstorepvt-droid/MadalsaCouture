// @ts-nocheck — ported from the Express backend (constants/messages.js); logic unchanged.


const __exports: any = {
  SUCCESS: {
    REGISTER: 'Welcome! Your account has been created successfully.',
    LOGIN: 'Welcome back.',
    FORGOT_PASSWORD: 'If this email exists, password reset instructions have been sent.',
    RESET_PASSWORD: 'Password updated successfully.',
    LOGOUT: 'You have been logged out successfully.',
    CHANGE_PASSWORD: 'Password changed successfully.',

    // Product
    PRODUCT_CREATED: 'Product created successfully.',
    PRODUCT_UPDATED: 'Product updated successfully.',
    PRODUCT_PUBLISHED: 'Product published successfully.',
    PRODUCT_ARCHIVED: 'Product archived successfully.',
    PRODUCT_DELETED: 'Product deleted successfully.',

    // Variant
    VARIANT_CREATED: 'Variant created successfully.',
    VARIANT_UPDATED: 'Variant updated successfully.',
    VARIANT_DELETED: 'Variant deleted successfully.',

    // Category
    CATEGORY_CREATED: 'Category created successfully.',
    CATEGORY_UPDATED: 'Category updated successfully.',
    CATEGORY_DELETED: 'Category deleted successfully.',

    // Collection
    COLLECTION_CREATED: 'Collection created successfully.',
    COLLECTION_UPDATED: 'Collection updated successfully.',
    COLLECTION_DELETED: 'Collection deleted successfully.',

    // Tag
    TAG_CREATED: 'Tag created successfully.',
    TAG_DELETED: 'Tag deleted successfully.',

    // Inventory
    INVENTORY_ADJUSTED: 'Stock adjusted successfully.',

    // Coupon
    COUPON_CREATED: 'Coupon created successfully.',
    COUPON_UPDATED: 'Coupon updated successfully.',
    COUPON_DELETED: 'Coupon deleted successfully.',

    // Order
    ORDER_CREATED: 'Order placed successfully.',
    ORDER_CANCELLED: 'Order cancelled successfully.',
    ORDER_STATUS_UPDATED: 'Order status updated successfully.',

    // Payment
    PAYMENT_ORDER_CREATED: 'Payment order created successfully.',
    PAYMENT_VERIFIED: 'Payment verified successfully.',
    REFUND_INITIATED: 'Refund initiated successfully.',
    COD_MARKED_PAID: 'COD order marked as paid.',

    // Exchange
    EXCHANGE_REQUESTED: 'Exchange request submitted successfully.',
    EXCHANGE_APPROVED: 'Exchange approved successfully.',
    EXCHANGE_REJECTED: 'Exchange rejected successfully.',
    QC_RESULT_RECORDED: 'QC result recorded successfully.',

    // Wishlist
    WISHLIST_ADDED: 'Product added to wishlist.',
    WISHLIST_REMOVED: 'Product removed from wishlist.',

    // Address
    ADDRESS_CREATED: 'Address saved successfully.',
    ADDRESS_UPDATED: 'Address updated successfully.',
    ADDRESS_DELETED: 'Address deleted successfully.',
    ADDRESS_SET_DEFAULT: 'Default address updated.',

    // Admin
    ADMIN_PROFILE_UPDATED: 'Profile updated successfully.',

    // CMS
    VERSION_RESTORED: 'Content version restored successfully.',
    MEDIA_UPLOADED: 'Media uploaded successfully.',
    MEDIA_DELETED: 'Media deleted successfully.',
    SETTINGS_UPDATED: 'Settings updated successfully.',
    NOTIFICATION_SENT: 'Notification sent successfully.',

    // Bulk / Import
    CSV_IMPORT_COMPLETE: 'CSV import completed.',
    BULK_IMPORT_COMPLETE: 'Bulk import processed.'
  },
  ERROR: {
    DUPLICATE_EMAIL: 'This email address is already registered.',
    DUPLICATE_PHONE: 'This phone number is already in use.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    WEAK_PASSWORD: 'Password must contain at least 8 characters including uppercase, lowercase, number and special character.',
    TOKEN_INVALID: 'Invalid or expired token.',
    SERVER: 'Something went wrong. Please try again later.',
    NOT_FOUND: 'Resource not found.',
    FORBIDDEN: 'Insufficient permissions.',
    UNAUTHORIZED: 'Authentication required.',
    CONFLICT: 'A conflict occurred with the current state of the resource.',
    VALIDATION_ERROR: 'Validation failed.',
    INSUFFICIENT_STOCK: 'Insufficient stock available.',
    COUPON_EXHAUSTED: 'This coupon has reached its usage limit.',
    INVALID_TRANSITION: 'This status transition is not allowed.',
    CONCURRENT_UPDATE: 'This order was updated by another request. Please retry.',
    EXCHANGE_WINDOW_EXPIRED: 'The exchange window for this product has expired.',
    PUBLISH_CONDITIONS_UNMET: 'Product cannot be published: missing required fields.',
    PRICE_MISMATCH: 'Order total does not match server-computed amount.',
    PURCHASE_REQUIRED: 'A verified purchase is required to perform this action.',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    WEBHOOK_SIGNATURE_INVALID: 'Webhook signature verification failed.',
    CANNOT_DELETE_WITH_ACTIVE_ORDERS: 'Cannot delete product with active orders.',
    CANNOT_DELETE_WITH_ACTIVE_PRODUCTS: 'Cannot delete category with active products.',
    EXCHANGE_ONLY_FOR_DELIVERED: 'Exchange can only be requested for delivered orders.',
    ROLE_ESCALATION_FORBIDDEN: 'Role escalation is not permitted.',

    // Variant / SKU
    SKU_CONFLICT: 'A variant with this SKU already exists.',
    VARIANT_COMBINATION_EXISTS: 'A variant with this size, color, and fabric combination already exists for this product.',

    // Taxonomy
    DUPLICATE_TAG: 'A tag with this name already exists.',
    DUPLICATE_SLUG: 'A resource with this slug already exists.',

    // Coupon
    DUPLICATE_COUPON_CODE: 'A coupon with this code already exists.',
    COUPON_NOT_FOUND: 'Coupon not found.',
    COUPON_NOT_ACTIVE: 'This coupon is not currently active.',
    COUPON_EXPIRED: 'This coupon has expired.',
    COUPON_SCOPE_MISMATCH: 'Cart items do not qualify for this coupon.',
    COUPON_MIN_ORDER_NOT_MET: 'Order total does not meet the minimum required for this coupon.',
    COUPON_LIMIT_REACHED: 'You have reached the usage limit for this coupon.',
    COUPON_NO_LONGER_VALID: 'This coupon is no longer valid for your current cart.',

    // Inventory
    STOCK_BELOW_ZERO: 'Stock adjustment would result in negative stock.',

    // Order
    ORDER_NOT_CANCELLABLE: 'This order cannot be cancelled at its current status.',

    // Address
    ADDRESS_IN_USE: 'This address is referenced by an active order and cannot be deleted.',
    CANNOT_DELETE_ADDRESS_IN_USE: 'Cannot delete address referenced by an active order.',

    // Exchange / QC
    QC_FAILED_NO_REFUND: 'QC check failed. No automatic refund will be issued; manual resolution required.',
    EXCHANGE_QC_FAILED: 'Exchange QC failed. Manual resolution required.',

    // CMS / Media
    VERSION_NOT_FOUND: 'Content version not found.',
    MEDIA_UPLOAD_FAILED: 'Media upload failed. Please try again.',

    // Webhooks
    DUPLICATE_WEBHOOK_EVENT: 'Webhook event already processed.',

    // Admin
    ADMIN_ALREADY_EXISTS: 'An admin account already exists.'
  },
  ROLES: {
    ADMIN: 'ADMIN',
    USER: 'USER'
  }
};

export default __exports;
