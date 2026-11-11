/**
 * Zod validation middleware factory.
 *
 *   validate({ body: userSchema, params: paramsSchema, query: querySchema })
 *
 * Validates the declared parts of the request and replaces them with the
 * parsed (and coerced) values so downstream code sees clean data.
 */
const ApiError = require('../utils/ApiError');

const validate = ({ body, params, query } = {}) => (req, _res, next) => {
  try {
    if (body) req.body = body.parse(req.body);
    if (params) req.params = params.parse(req.params);
    if (query) req.query = query.parse(req.query);
    next();
  } catch (err) {
    // Forward Zod error to errorHandler
    err.statusCode = 422;
    err.code = 'VALIDATION_FAILED';
    next(err);
  }
};

module.exports = validate;
