// @ts-nocheck — ported from the Express backend (services/dashboardService.js); logic unchanged.
import __imp0 from "@/server/models/orderModel";
import __imp1 from "@/server/models/orderItemModel";
import __imp2 from "@/server/models/userModel";
import __imp3 from "@/server/models/productModel";
import __imp4 from "@/server/services/inventoryService";

const Order = __imp0;
const OrderItem = __imp1;
const User = __imp2;
const Product = __imp3;
const inventoryService = __imp4;

/**
 * Statuses that represent revenue-generating orders.
 * 'Paid' and all post-payment fulfilment states are included.
 */
const PAID_STATUSES = ['Paid', 'Processing', 'Packed', 'ReadyToShip', 'Shipped', 'OutForDelivery', 'Delivered'];

/**
 * Low-stock threshold — defaults to 5 if the env var is not set.
 */
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD, 10) || 5;

class DashboardService {
  /**
   * Collect all KPI data for the admin dashboard in a single parallel fetch.
   *
   * Runs five independent queries concurrently via Promise.all:
   *   1. todayRevenue   — sum of `total` on paid+ orders created today (UTC).
   *   2. ordersByStatus — count of non-deleted orders grouped by status.
   *   3. lowStockCount  — number of variants at or below LOW_STOCK_THRESHOLD.
   *   4. newCustomers   — USER accounts created in the last 7 days.
   *   5. topProducts    — top 5 products by revenue from order items.
   *
   * @returns {Promise<{
   *   todayRevenue: number,
   *   ordersByStatus: Object.<string, number>,
   *   lowStockCount: number,
   *   newCustomers: number,
   *   topProducts: Array<{ productId: string, productTitle: string, revenue: number }>
   * }>}
   */
  async getDashboardKpis() {
    const now = new Date();

    // Start of today in UTC (midnight)
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));

    // 7 days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayRevenueResult,
      ordersByStatusResult,
      lowStockVariants,
      newCustomers,
      topProducts,
      totalOrdersResult,
      totalRevenueResult,
      totalCustomersResult,
      totalProductsResult
    ] = await Promise.all([

      // 1. Today's revenue — sum of `total` for paid+ orders created today
      Order.aggregate([
        {
          $match: {
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: startOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),

      // 2. Orders grouped by status (non-deleted)
      Order.aggregate([
        {
          $match: { isDeleted: false }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // 3. Low-stock variants — returns an array; we only need the count
      inventoryService.getLowStockVariants(LOW_STOCK_THRESHOLD),

      // 4. New USER accounts in the last 7 days
      User.countDocuments({
        role: 'USER',
        isDeleted: false,
        createdAt: { $gte: sevenDaysAgo }
      }),

      // 5. Top 5 products by revenue — aggregate OrderItem, lookup product name
      OrderItem.aggregate([
        {
          $group: {
            _id: '$productId',
            // Use the snapshot title from the first matched item (consistent within a product)
            productTitle: { $first: '$productTitle' },
            revenue: { $sum: '$lineTotal' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDoc'
          }
        },
        {
          $project: {
            _id: 0,
            name: {
              $ifNull: [
                { $arrayElemAt: ['$productDoc.title', 0] },
                '$productTitle'
              ]
            },
            revenue: 1
          }
        }
      ]),

      // 6. Total orders (all time, non-deleted)
      Order.countDocuments({ isDeleted: false }),

      // 7. Total revenue (sum of total for paid orders)
      Order.aggregate([
        { $match: { status: { $in: PAID_STATUSES }, isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),

      // 8. Total customers (all USER roles)
      User.countDocuments({ role: 'USER', isDeleted: false }),

      // 9. Total products (all non-deleted)
      Product.countDocuments({ isDeleted: false })
    ]);

    // Additional sales trend data (last 30 days)
    const salesTrend = await this.getSalesTrend(30);

    // Flatten ordersByStatus into a plain object { [status]: count }
    const ordersByStatus = ordersByStatusResult.reduce((acc, entry) => {
      acc[entry._id] = entry.count;
      return acc;
    }, {});

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;

    return {
      todayRevenue: todayRevenueResult[0]?.total ?? 0,
      totalOrders: totalOrdersResult ?? 0,
      totalRevenue,
      totalCustomers: totalCustomersResult ?? 0,
      totalProducts: totalProductsResult ?? 0,
      orderStatusBreakdown: Object.entries(ordersByStatus).map(([status, count]) => ({ status, count })),
      salesChart: salesTrend.map(item => ({ date: item.date, revenue: item.revenue, orders: item.orderCount })),
      lowStockCount: lowStockVariants.length,
      newCustomers,
      topProducts
    };
  }

  /**
   * Return daily revenue and order counts for the last `days` days.
   *
   * Only orders in a paid+ state are included. Results are grouped by
   * calendar day (UTC) and sorted chronologically (oldest → newest).
   *
   * @param {number} [days=30] - Number of calendar days to look back.
   * @returns {Promise<Array<{ date: string, revenue: number, orderCount: number }>>}
   *   Each element represents one calendar day that had at least one qualifying order.
   *   `date` is formatted as 'YYYY-MM-DD'.
   */
  async getSalesTrend(days = 30) {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await Order.aggregate([
      {
        $match: {
          status: { $in: PAID_STATUSES },
          createdAt: { $gte: fromDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            year:  { $year:        '$createdAt' },
            month: { $month:       '$createdAt' },
            day:   { $dayOfMonth:  '$createdAt' }
          },
          revenue:    { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: {
          '_id.year':  1,
          '_id.month': 1,
          '_id.day':   1
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: {
                $dateFromParts: {
                  year:  '$_id.year',
                  month: '$_id.month',
                  day:   '$_id.day'
                }
              }
            }
          },
          revenue:    1,
          orderCount: 1
        }
      }
    ]);

    return results;
  }
}

const __exports: any = new DashboardService();

export default __exports;
