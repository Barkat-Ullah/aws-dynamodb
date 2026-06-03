// ─── AppError.ts (fixed signature) ───────────────────────────────────────────
// Your compiled AppError takes (statusCode, message).
// The service files use new AppError("message", statusCode) — standard convention.
// This version accepts both argument orders for compatibility.

class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(messageOrCode: string | number, statusCodeOrMessage?: number | string) {
    // Support both: new AppError("msg", 404) and new AppError(404, "msg")
    const message =
      typeof messageOrCode === "string" ? messageOrCode : String(statusCodeOrMessage);
    const statusCode =
      typeof messageOrCode === "number" ? messageOrCode : (statusCodeOrMessage as number) || 500;

    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // operational errors are shown to the client
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;