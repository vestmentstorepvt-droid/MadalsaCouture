// @ts-nocheck — ported from the Express backend (services/reportService.js); logic unchanged.
import * as __imp0 from "node:stream";
import __imp1 from "@/server/models/orderModel";
import __imp2 from "@/server/models/variantModel";
import __imp3 from "@/server/models/userModel";
import __imp4 from "@/server/utils/csvExport";

const { Readable } = __imp0;

const Order = __imp1;
const Variant = __imp2;
const User = __imp3;
const { streamCsv } = __imp4;

/**
 * Order statuses that count as revenue-generating.
 */
const PAID_STATUSES = [
  'Paid',
  'Processing',
  'Packed',
  'ReadyToShip',
  'Shipped',
  'OutForDelivery',
  'Delivered',
];

/**
 * Build the MongoDB group _id expression for the chosen granularity.
 *
 * @param {'day'|'week'|'month'} groupBy
 * @returns {object} Aggregation expression for $group._id
 */
function buildGroupId(groupBy) {
  switch (groupBy) {
    case 'week':
      return {
        year: { $isoWeekYear: '$createdAt' },
        week: { $isoWeek: '$createdAt' },
      };
    case 'month':
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
      };
    case 'day':
    default:
      return {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      };
  }
}

/**
 * Convert a group _id object into a human-readable period string.
 *
 * @param {object} id  - The _id from the aggregation group stage.
 * @param {'day'|'week'|'month'} groupBy
 * @returns {string}
 */
function formatPeriod(id, groupBy) {
  switch (groupBy) {
    case 'week':
      return `${id.year}-W${String(id.week).padStart(2, '0')}`;
    case 'month':
      return `${id.year}-${String(id.month).padStart(2, '0')}`;
    case 'day':
    default:
      return `${id.year}-${String(id.month).padStart(2, '0')}-${String(id.day).padStart(2, '0')}`;
  }
}

class ReportService {
  /**
   * Aggregate sales report: revenue, order count, and AOV grouped by
   * day / week / month for the given date range.
   *
   * JSON mode  — returns an array of result objects.
   * CSV  mode  — streams the response directly to `res` and returns void.
   *
   * @param {Date}   from
   * @param {Date}   to
   * @param {'day'|'week'|'month'} groupBy
   * @param {object|null} [res=null]  Express response object (CSV mode when provided)
   * @returns {Promise<Array<{period:string, revenue:number, orderCount:number, aov:number}>|void>}
   */
  async getSalesReport(from, to, groupBy = 'day', res = null) {
    const groupId = buildGroupId(groupBy);

    // Determine sort fields from the group _id keys
    const sortStage = Object.keys(groupId).reduce((acc, key) => {
      acc[`_id.${key}`] = 1;
      return acc;
    }, {});

    const results = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          status: { $in: PAID_STATUSES },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
          aov: { $avg: '$total' },
        },
      },
      { $sort: sortStage },
    ]);

    // Shape results: add a human-readable `period` string
    const shaped = results.map((row) => ({
      period: formatPeriod(row._id, groupBy),
      revenue: row.revenue,
      orderCount: row.orderCount,
      aov: row.aov,
    }));

    if (res) {
      // CSV mode — stream via Readable.from so no full buffer is needed
      const columns = [
        { header: 'Period', key: 'period' },
        { header: 'Revenue', key: 'revenue' },
        { header: 'Order Count', key: 'orderCount' },
        { header: 'Average Order Value', key: 'aov' },
      ];
      await streamCsv(res, Readable.from(shaped), columns, 'sales-report.csv');
      return;
    }

    return shaped;
  }

  /**
   * Inventory health report: zero-stock and low-stock variants.
   *
   * JSON mode — returns `{ zeroStock: [...], lowStock: [...] }`.
   * CSV  mode — streams both sets as separate sections.
   *
   * @param {object|null} [res=null]  Express response object (CSV mode when provided)
   * @returns {Promise<{zeroStock: object[], lowStock: object[]}|void>}
   */
  async getInventoryReport(res = null) {
    const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 5;

    const variantProjection = 'sku productId size color fabric stock reservedStock';

    const [zeroStock, lowStock] = await Promise.all([
      // Variants with no stock at all
      Variant.find(
        { stock: 0, isDeleted: false },
        variantProjection
      ).lean(),

      // Variants whose available stock (stock - reservedStock) is at or below threshold
      // but still have some physical units (stock > 0)
      Variant.find(
        {
          $expr: {
            $lte: [
              { $subtract: ['$stock', '$reservedStock'] },
              LOW_STOCK_THRESHOLD,
            ],
          },
          stock: { $gt: 0 },
          isDeleted: false,
        },
        variantProjection
      ).lean(),
    ]);

    if (res) {
      // CSV mode — combine both sets with a 'stockStatus' discriminator column
      const combined = [
        ...zeroStock.map((v) => ({ ...v, stockStatus: 'zero' })),
        ...lowStock.map((v) => ({ ...v, stockStatus: 'low' })),
      ];

      const columns = [
        { header: 'Stock Status', key: 'stockStatus' },
        { header: 'SKU', key: 'sku' },
        { header: 'Product ID', key: 'productId' },
        { header: 'Size', key: 'size' },
        { header: 'Color', key: 'color' },
        { header: 'Fabric', key: 'fabric' },
        { header: 'Stock', key: 'stock' },
        { header: 'Reserved Stock', key: 'reservedStock' },
      ];

      await streamCsv(res, Readable.from(combined), columns, 'inventory-report.csv');
      return;
    }

    return { zeroStock, lowStock };
  }

  /**
   * Customer report: new registrations and blocked accounts within a date range.
   *
   * JSON mode — returns `{ newRegistrations: number, blockedAccounts: number }`.
   * CSV  mode — streams a single summary row.
   *
   * @param {Date}   from
   * @param {Date}   to
   * @param {object|null} [res=null]  Express response object (CSV mode when provided)
   * @returns {Promise<{newRegistrations: number, blockedAccounts: number}|void>}
   */
  async getCustomerReport(from, to, res = null) {
    const [newRegistrations, blockedAccounts] = await Promise.all([
      // New USER accounts created within the period
      User.countDocuments({
        role: 'USER',
        isDeleted: false,
        createdAt: { $gte: from, $lte: to },
      }),

      // All blocked USER accounts (not scoped to date range — a global count)
      User.countDocuments({
        status: 'blocked',
        role: 'USER',
        isDeleted: false,
      }),
    ]);

    if (res) {
      // CSV mode — single summary row
      const summary = [{ newRegistrations, blockedAccounts }];
      const columns = [
        { header: 'New Registrations', key: 'newRegistrations' },
        { header: 'Blocked Accounts', key: 'blockedAccounts' },
      ];
      await streamCsv(res, Readable.from(summary), columns, 'customer-report.csv');
      return;
    }

    return { newRegistrations, blockedAccounts };
  }
}

const __exports: any = new ReportService();

export default __exports;
