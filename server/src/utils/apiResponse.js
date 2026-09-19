/**
 * Aarogya API Response Helpers
 * Standardized helpers for consistent success and error response formatting
 */

/**
 * Send a success response
 */
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send a created (201) success response
 */
const createdResponse = (res, data, message = 'Created successfully') => {
  return successResponse(res, data, message, 201);
};

/**
 * Send an error response
 */
const errorResponse = (res, code, message, statusCode = 400, details = null) => {
  const body = {
    success: false,
    error: {
      code,
      message
    }
  };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
};

/**
 * Send a not found (404) response
 */
const notFoundResponse = (res, entity = 'Resource') => {
  return errorResponse(res, 'NOT_FOUND', `${entity} not found.`, 404);
};

/**
 * Send an unauthorized (401) response
 */
const unauthorizedResponse = (res, message = 'Authentication required.') => {
  return errorResponse(res, 'UNAUTHORIZED', message, 401);
};

/**
 * Send a forbidden (403) response
 */
const forbiddenResponse = (res, message = 'You do not have permission to perform this action.') => {
  return errorResponse(res, 'FORBIDDEN', message, 403);
};

/**
 * Send a conflict (409) response
 */
const conflictResponse = (res, message = 'Resource already exists.') => {
  return errorResponse(res, 'CONFLICT', message, 409);
};

module.exports = {
  successResponse,
  createdResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse
};
