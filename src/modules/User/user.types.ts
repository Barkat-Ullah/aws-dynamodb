// ─── user.types.ts ────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface UpdateProfileDTO {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Extends Express Request so controllers get req.user typed
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}