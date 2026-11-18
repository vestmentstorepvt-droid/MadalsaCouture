// @ts-nocheck — ported from the Express backend (repositories/auditLogRepository.js); logic unchanged.
import __imp0 from "@/server/models/auditLogModel";

const AuditLog = __imp0;

/**
 * Repository for AuditLog — append-only, no update or delete.
 *
 * Indexes (defined on the model):
 *   - actorId + timestamp  (compound — declared on schema)
 *   - module   + timestamp (compound — declared on schema)
 *   - timestamp            (single-field — declared on schema)
 */
class AuditLogRepository {
  /**
   * Create a new audit log entry.
   * This is the only write operation permitted on audit_logs.
   *
   * @param {Object} data - Audit log fields.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return AuditLog.create(data);
  }

  /**
   * Paginated query for audit logs with optional filters.
   *
   * @param {Object} filter  - Mongoose filter (actorId, module, date range, etc.)
   * @param {Object} options - { page, limit, sort }
   * @returns {Promise<{ data: Object[], meta: { pagination: Object } }>}
   */
  async findAll(filter = {}, options = {}) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const sort = options.sort || { timestamp: -1 };

    const [data, total] = await Promise.all([
      AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);

    return {
      data,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      }
    };
  }
}

const __exports: any = new AuditLogRepository();

export default __exports;
