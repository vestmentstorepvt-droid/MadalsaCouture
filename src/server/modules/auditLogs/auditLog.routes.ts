// @ts-nocheck — ported from the Express backend (modules/auditLogs/auditLog.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/lib/mongoose";
import __imp2 from "@/server/middleware/authMiddleware";
import __imp3 from "@/server/repositories/auditLogRepository";
import __imp4 from "@/server/utils/response";

const { Router } = __imp0;
const mongoose = __imp1;
const { authenticate, authorize } = __imp2;
const auditLogRepository = __imp3;
const { sendSuccess, sendError } = __imp4;

const router = Router();

// All audit log routes are admin-only, read-only
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * GET /api/v1/admin/audit-logs
 *
 * Paginated list of audit log entries.
 *
 * Query params:
 *   page      — page number (default: 1)
 *   limit     — items per page (default: 20, max: 100)
 *   actorId   — filter by actor ObjectId
 *   module    — filter by module string (e.g. 'cms', 'orders')
 *   dateFrom  — ISO date string (inclusive lower bound on timestamp)
 *   dateTo    — ISO date string (inclusive upper bound on timestamp)
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, actorId, module: moduleName, dateFrom, dateTo } = req.query;

    const filter = {};

    if (actorId) {
      if (!mongoose.Types.ObjectId.isValid(actorId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid actorId format', 400);
      }
      filter.actorId = actorId;
    }

    if (moduleName) {
      filter.module = moduleName;
    }

    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (isNaN(from.getTime())) {
          return sendError(res, 'VALIDATION_ERROR', 'Invalid dateFrom format', 400);
        }
        filter.timestamp.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (isNaN(to.getTime())) {
          return sendError(res, 'VALIDATION_ERROR', 'Invalid dateTo format', 400);
        }
        filter.timestamp.$lte = to;
      }
    }

    const result = await auditLogRepository.findAll(filter, { page, limit });

    return sendSuccess(res, { logs: result.data }, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

// No POST, PUT, PATCH, or DELETE routes on this collection

const __exports: any = router;

export default __exports;
