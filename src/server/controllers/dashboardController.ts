// @ts-nocheck — ported from the Express backend (controllers/dashboardController.js); logic unchanged.
import __imp0 from "@/server/services/dashboardService";
import __imp1 from "@/server/services/reportService";
import __imp2 from "@/server/utils/response";

const dashboardService = __imp0;
const reportService = __imp1;
const { sendSuccess, sendError } = __imp2;

class DashboardController {
  /**
   * GET /api/v1/admin/dashboard
   *
   * Returns all KPI data for the admin dashboard.
   */
  async getDashboard(req, res, next) {
    try {
      const kpis = await dashboardService.getDashboardKpis();
      return sendSuccess(res, { kpis });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports/sales
   *
   * Query params:
   *   from    — ISO date string (required)
   *   to      — ISO date string (required)
   *   groupBy — 'day' | 'week' | 'month'  (default: 'day')
   *   export  — 'csv' to stream a CSV file instead of JSON
   */
  async getSalesReport(req, res, next) {
    try {
      const { from: fromStr, to: toStr, groupBy = 'day', export: exportParam } = req.query;

      // Validate required date params
      if (!fromStr || !toStr) {
        return sendError(res, 'VALIDATION_ERROR', '`from` and `to` query parameters are required.', 400);
      }

      const from = new Date(fromStr);
      const to = new Date(toStr);

      if (isNaN(from.getTime())) {
        return sendError(res, 'VALIDATION_ERROR', '`from` must be a valid ISO date string.', 400);
      }
      if (isNaN(to.getTime())) {
        return sendError(res, 'VALIDATION_ERROR', '`to` must be a valid ISO date string.', 400);
      }

      // Normalise groupBy to one of the three accepted values
      const normalised = ['day', 'week', 'month'].includes(groupBy) ? groupBy : 'day';

      if (exportParam === 'csv') {
        // Service streams the CSV directly to res; nothing further to do
        await reportService.getSalesReport(from, to, normalised, res);
        return;
      }

      const report = await reportService.getSalesReport(from, to, normalised);
      return sendSuccess(res, { report });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports/inventory
   *
   * Query params:
   *   export — 'csv' to stream a CSV file instead of JSON
   */
  async getInventoryReport(req, res, next) {
    try {
      const { export: exportParam } = req.query;

      if (exportParam === 'csv') {
        await reportService.getInventoryReport(res);
        return;
      }

      const report = await reportService.getInventoryReport();
      return sendSuccess(res, { report });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/reports/customers
   *
   * Query params:
   *   from   — ISO date string (optional, defaults to 30 days ago)
   *   to     — ISO date string (optional, defaults to now)
   *   export — 'csv' to stream a CSV file instead of JSON
   */
  async getCustomerReport(req, res, next) {
    try {
      const { from: fromStr, to: toStr, export: exportParam } = req.query;

      // Default to last 30 days when not supplied
      const to = toStr ? new Date(toStr) : new Date();
      const from = fromStr
        ? new Date(fromStr)
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (exportParam === 'csv') {
        await reportService.getCustomerReport(from, to, res);
        return;
      }

      const report = await reportService.getCustomerReport(from, to);
      return sendSuccess(res, { report });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new DashboardController();

export default __exports;
