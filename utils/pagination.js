class PaginationManager {
  constructor() {
    this.defaultLimit = 20;
    this.maxLimit = 100;
    this.minLimit = 5;
  }

  /**
   * Create pagination parameters from request query
   * @param {Object} query - Express request query object
   * @returns {Object} Pagination parameters
   */
  createPaginationParams(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    let limit = parseInt(query.limit) || this.defaultLimit;

    // Enforce limits
    limit = Math.min(this.maxLimit, Math.max(this.minLimit, limit));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
      offset: skip
    };
  }

  /**
   * Create sort parameters from request query
   * @param {Object} query - Express request query object
   * @param {Object} defaultSort - Default sort object
   * @returns {Object} Sort object for MongoDB
   */
  createSortParams(query, defaultSort = { createdAt: -1 }) {
    if (!query.sortBy) {
      return defaultSort;
    }

    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    return { [query.sortBy]: sortDirection };
  }

  /**
   * Create filter parameters from request query
   * @param {Object} query - Express request query object
   * @param {Array} allowedFilters - Array of allowed filter fields
   * @returns {Object} Filter object for MongoDB
   */
  createFilterParams(query, allowedFilters = []) {
    const filters = {};

    allowedFilters.forEach(field => {
      if (query[field] !== undefined && query[field] !== '') {
        // Handle different filter types
        if (field.includes('Date')) {
          this.handleDateFilter(filters, field, query[field]);
        } else if (field.includes('Id')) {
          filters[field] = query[field];
        } else if (typeof query[field] === 'string') {
          // Text search with case-insensitive regex
          filters[field] = new RegExp(query[field], 'i');
        } else {
          filters[field] = query[field];
        }
      }
    });

    // Handle date range filters
    if (query.startDate && query.endDate) {
      filters.createdAt = {
        $gte: new Date(query.startDate),
        $lte: new Date(query.endDate)
      };
    } else if (query.startDate) {
      filters.createdAt = { $gte: new Date(query.startDate) };
    } else if (query.endDate) {
      filters.createdAt = { $lte: new Date(query.endDate) };
    }

    return filters;
  }

  /**
   * Handle date filter logic
   * @param {Object} filters - Filters object
   * @param {String} field - Field name
   * @param {String} value - Date value
   */
  handleDateFilter(filters, field, value) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        filters[field] = date;
      }
    } catch (error) {
      // Invalid date, skip filter
    }
  }

  /**
   * Execute paginated query with aggregation pipeline
   * @param {Model} model - Mongoose model
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} paginationParams - Pagination parameters
   * @returns {Object} Paginated results with metadata
   */
  async executeAggregationQuery(model, pipeline, paginationParams) {
    const { page, limit, skip } = paginationParams;

    // Create counting pipeline
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Create data pipeline with pagination
    const dataPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit }
    ];

    // Execute both queries in parallel
    const [countResult, dataResult] = await Promise.all([
      model.aggregate(countPipeline),
      model.aggregate(dataPipeline)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      }
    };
  }

  /**
   * Execute simple paginated query
   * @param {Query} query - Mongoose query
   * @param {Object} paginationParams - Pagination parameters
   * @returns {Object} Paginated results with metadata
   */
  async executePaginatedQuery(query, paginationParams) {
    const { page, limit, skip } = paginationParams;

    // Clone query for counting
    const countQuery = query.clone();

    // Execute count and data queries in parallel
    const [total, data] = await Promise.all([
      countQuery.countDocuments(),
      query.skip(skip).limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      }
    };
  }

  /**
   * Create cursor-based pagination for large datasets
   * @param {Object} query - Request query parameters
   * @param {String} cursorField - Field to use for cursor (default: _id)
   * @returns {Object} Cursor pagination parameters
   */
  createCursorPagination(query, cursorField = '_id') {
    const limit = Math.min(this.maxLimit, parseInt(query.limit) || this.defaultLimit);
    const cursor = query.cursor;
    const direction = query.direction === 'prev' ? -1 : 1;

    const filter = {};
    if (cursor) {
      filter[cursorField] = direction === 1
        ? { $gt: cursor }
        : { $lt: cursor };
    }

    return {
      filter,
      limit,
      sort: { [cursorField]: direction },
      cursor,
      direction
    };
  }

  /**
   * Execute cursor-based pagination query
   * @param {Query} query - Mongoose query
   * @param {Object} cursorParams - Cursor pagination parameters
   * @returns {Object} Cursor paginated results
   */
  async executeCursorQuery(query, cursorParams) {
    const { filter, limit, sort } = cursorParams;

    // Apply cursor filter
    query.find(filter);

    // Execute query with sorting and limit
    const data = await query
      .sort(sort)
      .limit(limit + 1); // Get one extra to check if there's more

    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop(); // Remove extra item
    }

    const nextCursor = data.length > 0 ? data[data.length - 1]._id : null;
    const prevCursor = data.length > 0 ? data[0]._id : null;

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        itemsCount: data.length
      }
    };
  }

  /**
   * Generate pagination metadata for response
   * @param {Object} req - Express request object
   * @param {Object} paginationData - Pagination data from query
   * @returns {Object} Response metadata
   */
  generateResponseMetadata(req, paginationData) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
    const { pagination } = paginationData;

    const metadata = {
      pagination: {
        ...pagination,
        links: {}
      }
    };

    // Generate navigation links
    if (pagination.hasNextPage) {
      const nextQuery = { ...req.query, page: pagination.nextPage };
      metadata.pagination.links.next = `${baseUrl}?${new URLSearchParams(nextQuery)}`;
    }

    if (pagination.hasPrevPage) {
      const prevQuery = { ...req.query, page: pagination.prevPage };
      metadata.pagination.links.prev = `${baseUrl}?${new URLSearchParams(prevQuery)}`;
    }

    // First and last page links
    if (pagination.totalPages > 1) {
      const firstQuery = { ...req.query, page: 1 };
      const lastQuery = { ...req.query, page: pagination.totalPages };

      metadata.pagination.links.first = `${baseUrl}?${new URLSearchParams(firstQuery)}`;
      metadata.pagination.links.last = `${baseUrl}?${new URLSearchParams(lastQuery)}`;
    }

    return metadata;
  }
}

module.exports = new PaginationManager();