const logger = require('../config/logger');

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, _next) => {
  let { statusCode = 500, message, code = 'INTERNAL_ERROR' } = err;

  // Validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.array(),
    });
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_ENTRY';
  }

  // MySQL foreign key constraint
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    message = 'Referenced resource does not exist';
    code = 'INVALID_REFERENCE';
  }

  if (statusCode === 500 && !err.isOperational) {
    logger.error('Unhandled error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  const response = {
    error: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message,
    code,
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const notFound = (req, res) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
  });
};

module.exports = { AppError, errorHandler, notFound };
