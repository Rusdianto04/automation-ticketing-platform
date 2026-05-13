"use strict";

/**
 * src/common/errors/AppError.js
 * Base application error with HTTP status support.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name        = "AppError";
    this.statusCode  = statusCode;
    this.code        = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} tidak ditemukan`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError, ConflictError };
