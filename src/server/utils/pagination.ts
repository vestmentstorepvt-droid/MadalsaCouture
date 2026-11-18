// @ts-nocheck — ported from the Express backend (utils/pagination.js); logic unchanged.


/**
 * Paginate a Mongoose query.
 * @param {Model} Model - Mongoose model
 * @param {object} query - Mongoose filter object
 * @param {object} options - { page, limit, sort, populate, select }
 * @returns {{ data: [], meta: { pagination: { page, limit, total, totalPages } } }}
 */
const paginate = async (Model, query = {}, options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };

  let findQuery = Model.find(query).sort(sort).skip(skip).limit(limit);
  if (options.select) findQuery = findQuery.select(options.select);
  if (options.populate) findQuery = findQuery.populate(options.populate);

  const [data, total] = await Promise.all([
    findQuery.lean(),
    Model.countDocuments(query)
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
};

const __exports: any = { paginate };

export default __exports;
