// @ts-nocheck — ported from the Express backend (middleware/auditMiddleware.js); logic unchanged.
import __imp0 from "@/server/config/logger";
import __imp1 from "@/server/models/auditLogModel";

const logger = __imp0;

/**
 * Async audit log middleware — fires AFTER the response is sent.
 * Logs every admin mutating request to audit_logs collection.
 * Non-blocking: all writes happen in res.on('finish').
 */
const auditMiddleware = (req, res, next) => {
  if (!req.user) return next();

  // Derive module from URL: /api/v1/admin/products/123 → 'products'
  const pathParts = (req.path || req.url || '').split('/').filter(Boolean);
  const adminIdx = pathParts.indexOf('admin');
  const module = adminIdx >= 0 && pathParts[adminIdx + 1] ? pathParts[adminIdx + 1] : 'unknown';

  const entityId = req.params.id || req.params.variantId || req.params.orderId || null;

  res.on('finish', async () => {
    try {
      // Lazy require to avoid circular dependency — model registered after middleware loads
      const AuditLog = __imp1;
      await AuditLog.create({
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: `${req.method} ${req.originalUrl}`,
        module,
        entityId: entityId ? String(entityId) : null,
        beforeSnapshot: null,
        afterSnapshot: null,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        timestamp: new Date()
      });
    } catch (err) {
      // Never let audit failures affect the app
      logger.error('Audit log write failed: ' + (err.message || err));
    }
  });

  next();
};

const __exports: any = auditMiddleware;

export default __exports;
