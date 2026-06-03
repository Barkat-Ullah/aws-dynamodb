// ─── auth.middleware.ts ───────────────────────────────────────────────────────
//
// Two middleware functions:
//
//   protect(req, res, next)
//     • Reads token from Authorization: Bearer <token>
//     • Verifies JWT signature + expiry
//     • Fetches user from DynamoDB (GetItem by userId from token payload)
//     • Attaches user to req.user for downstream controllers
//     • Rejects if token is missing, invalid, expired, or user is deactivated
//
//   restrictTo(...roles)
//     • Returns middleware that allows only the given roles
//     • Must be chained AFTER protect (needs req.user)
//     • Usage: router.delete("/", protect, restrictTo("admin"), deleteHandler)

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AppError from "../helper/AppError";
import catchAsync from "../utils/catchAsync";
import { UserModel } from "../modules/User/user.model";
import { UserRole } from "../modules/User/user.types";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

// ─────────────────────────────────────────────────────────────────────────────
// protect — verifies JWT and loads user from DB
// ─────────────────────────────────────────────────────────────────────────────

export const protect = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required. Please log in.", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AppError("Authentication token missing.", 401);
    }

    // 2. Verify signature and expiry
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError("Your session has expired. Please log in again.", 401);
      }
      throw new AppError("Invalid token. Please log in again.", 401);
    }

    // 3. Fetch user from DynamoDB — GetItem by userId (from token payload)
    //    This is a cheap O(1) lookup, not a Scan.
    //    Why fetch again instead of trusting the token?
    //    → Catches deactivated accounts without waiting for token expiry.
    //    → For high-security endpoints you always want DB confirmation.
    const user = await UserModel.get({ userId: decoded.userId });

    if (!user) {
      throw new AppError("User belonging to this token no longer exists.", 401);
    }

    if (!user.isActive) {
      throw new AppError("Your account has been deactivated.", 403);
    }

    // 4. Attach to request for downstream handlers
    req.user = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };

    next();
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// restrictTo — role-based access control
// ─────────────────────────────────────────────────────────────────────────────
// Returns a middleware function. Must run after `protect`.
//
// Usage:
//   router.delete("/:id", protect, restrictTo("admin"), deleteProduct)
//   router.get("/admin/users", protect, restrictTo("admin"), listUsers)

export const restrictTo = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Authentication required.", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth — populates req.user if token present, but doesn't block
// ─────────────────────────────────────────────────────────────────────────────
// Use for endpoints that behave differently for authenticated vs anonymous users
// (e.g. product listing that shows "add to cart" for logged-in users).

export const optionalAuth = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // no token — continue as anonymous
    }

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const user = await UserModel.get({ userId: decoded.userId });
      if (user && user.isActive) {
        req.user = { userId: user.userId, email: user.email, role: user.role };
      }
    } catch {
      // Invalid/expired token in optional auth → silently ignore
    }

    next();
  }
);