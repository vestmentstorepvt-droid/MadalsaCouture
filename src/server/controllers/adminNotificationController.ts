// @ts-nocheck — ported from the Express backend (controllers/adminNotificationController.js); logic unchanged.
import __imp0 from "@/server/models/adminNotificationModel";
import __imp1 from "@/server/utils/response";

const AdminNotification = __imp0;
const { sendSuccess, sendError } = __imp1;

class AdminNotificationController {
  async getNotifications(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      const notifications = await AdminNotification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await AdminNotification.countDocuments();
      const unreadCount = await AdminNotification.countDocuments({ isRead: false });

      return sendSuccess(res, { notifications, unreadCount }, 200, {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await AdminNotification.findByIdAndUpdate(
        req.params.id,
        { isRead: true },
        { new: true }
      );
      if (!notification) {
        return sendError(res, 'NOT_FOUND', 'Notification not found.', 404);
      }
      return sendSuccess(res, { notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      await AdminNotification.updateMany({ isRead: false }, { $set: { isRead: true } });
      return sendSuccess(res, { success: true });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new AdminNotificationController();

export default __exports;
