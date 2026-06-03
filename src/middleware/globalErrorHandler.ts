// ─── globalErrorHandler.ts ───────────────────────────────────────────────────
// Catches all errors thrown by controllers/services and formats them uniformly.
// Handles: AppError, JWT errors, DynamoDB conditional check failures,
//          Dynamoose validation errors, and unexpected errors.

import { Request, Response, NextFunction } from "express";
import AppError from "../helper/AppError";

const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // ── Known operational errors (thrown as AppError in our code) ─────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: false,
      statusCode: err.statusCode,
      message: err.message,
    });
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ status: false, message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res
      .status(401)
      .json({ status: false, message: "Token expired. Please log in again." });
  }

  // ── DynamoDB ConditionalCheckFailedException ───────────────────────────────
  if (err.name === "ConditionalCheckFailedException") {
    return res
      .status(409)
      .json({ status: false, message: "Conflict: condition check failed" });
  }

  // ── Dynamoose / AWS validation errors ─────────────────────────────────────
  if (err.name === "ValidationError") {
    return res.status(400).json({
      status: false,
      message: "Validation error",
      details: err.message,
    });
  }

  // ── Multer file upload errors ──────────────────────────────────────────────
  if (err.message === "Invalid file type") {
    return res
      .status(400)
      .json({ status: false, message: "Invalid file type. Allowed: jpeg, png, webp, pdf" });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ status: false, message: "File too large" });
  }

  // ── Unknown / programming errors — don't leak details in production ────────
  console.error("UNHANDLED ERROR:", err);

  const isDev = process.env.NODE_ENV === "development";
  return res.status(500).json({
    status: false,
    message: "Something went wrong",
    ...(isDev && { error: err.message, stack: err.stack }),
  });
};

export default globalErrorHandler;