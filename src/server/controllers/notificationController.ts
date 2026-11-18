// @ts-nocheck — ported from the Express backend (controllers/notificationController.js); logic unchanged.
import __imp0 from "@/server/models/notificationTemplateModel";
import __imp1 from "@/server/models/notificationLogModel";
import __imp2 from "@/server/utils/response";
import __imp3 from "@/server/utils/pagination";

const NotificationTemplate = __imp0;
const NotificationLog = __imp1;
const { sendSuccess, sendError } = __imp2;
const { paginate } = __imp3;

class NotificationController {
  /**
   * GET /api/v1/admin/notifications/templates
   * List all notification templates. Auto-initializes defaults if empty.
   */
  async listTemplates(req, res, next) {
    try {
      let templates = await NotificationTemplate.find().sort({ type: 1 }).lean();
      if (!templates || templates.length === 0) {
        const DEFAULT_TEMPLATES = [
          {
            type: 'welcome',
            subject: 'Welcome to Madalsa Couture, {{name}}!',
            htmlBody: '<h1>Welcome, {{name}}!</h1><p>Your account has been created. Explore our latest collections at <a href="{{storeUrl}}">Madalsa Couture</a>.</p>',
            requiredPlaceholders: ['name'],
            isActive: true
          },
          {
            type: 'email_verification',
            subject: 'Verify your email — Madalsa Couture',
            htmlBody: '<p>Please verify your email by clicking the link: <a href="{{verifyUrl}}">{{verifyUrl}}</a></p>',
            requiredPlaceholders: ['verifyUrl'],
            isActive: true
          },
          {
            type: 'password_reset',
            subject: 'Password Reset Request — Madalsa Couture',
            htmlBody: '<p>Hi {{name}}, click the link to reset your password: <a href="{{resetUrl}}">Reset Password</a></p><p>This link expires in 15 minutes.</p>',
            requiredPlaceholders: ['name', 'resetUrl'],
            isActive: true
          },
          {
            type: 'order_confirmation',
            subject: 'Order Confirmed — #{{orderNumber}}',
            htmlBody: '<h2>Your order #{{orderNumber}} has been confirmed!</h2><p>Total: ₹{{total}}</p><p>We will notify you when your order ships.</p>',
            requiredPlaceholders: ['orderNumber', 'total'],
            isActive: true
          },
          {
            type: 'order_shipped',
            subject: 'Your Order #{{orderNumber}} Has Been Shipped',
            htmlBody: '<h2>Great news!</h2><p>Your order #{{orderNumber}} has been shipped and is on its way.</p>',
            requiredPlaceholders: ['orderNumber'],
            isActive: true
          },
          {
            type: 'order_out_for_delivery',
            subject: 'Out for Delivery — Order #{{orderNumber}}',
            htmlBody: '<p>Your order #{{orderNumber}} is out for delivery today. Please be available to receive it.</p>',
            requiredPlaceholders: ['orderNumber'],
            isActive: true
          },
          {
            type: 'order_delivered',
            subject: 'Order #{{orderNumber}} Delivered',
            htmlBody: '<p>Your order #{{orderNumber}} has been delivered. We hope you love your purchase!</p>',
            requiredPlaceholders: ['orderNumber'],
            isActive: true
          },
          {
            type: 'exchange_status_update',
            subject: 'Exchange Request Update — Status: {{status}}',
            htmlBody: '<p>Your exchange request (ID: {{exchangeId}}) has been updated to: <strong>{{status}}</strong>.</p>',
            requiredPlaceholders: ['status', 'exchangeId'],
            isActive: true
          }
        ];
        await NotificationTemplate.insertMany(DEFAULT_TEMPLATES);
        templates = await NotificationTemplate.find().sort({ type: 1 }).lean();
      }
      return sendSuccess(res, { templates });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/admin/notifications/templates/:type
   * Update a notification template by type.
   * Validates that all requiredPlaceholders appear in subject or htmlBody.
   */
  async updateTemplate(req, res, next) {
    try {
      const { type } = req.params;
      const { subject, htmlBody, requiredPlaceholders, isActive } = req.body;

      // Load the current template
      const template = await NotificationTemplate.findOne({ type });
      if (!template) {
        return sendError(res, 'NOT_FOUND', `No template found for type: ${type}`, 404);
      }

      // Build new values (fall back to current values if not provided)
      const newSubject = subject !== undefined ? subject : template.subject;
      const newHtmlBody = htmlBody !== undefined ? htmlBody : template.htmlBody;
      const placeholders = requiredPlaceholders !== undefined
        ? requiredPlaceholders
        : template.requiredPlaceholders;

      // Validate all requiredPlaceholders are present in subject OR htmlBody
      const combined = newSubject + ' ' + newHtmlBody;
      const missing = placeholders.filter(
        (p) => !combined.includes(`{{${p}}}`)
      );
      if (missing.length > 0) {
        return sendError(
          res,
          'VALIDATION_ERROR',
          `Missing required placeholders in template: ${missing.join(', ')}`,
          422
        );
      }

      const updates = {
        subject: newSubject,
        htmlBody: newHtmlBody,
        requiredPlaceholders: placeholders,
        updatedBy: req.user.id
      };
      if (isActive !== undefined) {
        updates.isActive = isActive;
      }

      const updated = await NotificationTemplate.findOneAndUpdate(
        { type },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean();

      return sendSuccess(res, { template: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/notifications/logs
   * Paginated list of notification logs.
   * Optional filters: type, status, recipient, userId.
   */
  async listLogs(req, res, next) {
    try {
      const { page, limit, type, status, recipient, userId } = req.query;

      const filter = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (recipient) filter.recipient = { $regex: recipient, $options: 'i' };
      if (userId) filter.userId = userId;

      const result = await paginate(NotificationLog, filter, {
        page,
        limit,
        sort: { createdAt: -1 }
      });

      return sendSuccess(res, { logs: result.data }, 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
}

const __exports: any = new NotificationController();

export default __exports;
