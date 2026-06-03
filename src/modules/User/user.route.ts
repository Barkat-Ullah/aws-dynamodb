// ─── user.route.ts ────────────────────────────────────────────────────────────

import { Router } from "express";
import {
  register,
  login,
  getMyProfile,
  updateMyProfile,
  changePassword,
  deleteAvatar,
} from "./user.controller";
import { validateBody } from "../../middleware/validateRequest";
import { upload } from "../../utils/fileuploader";
import { protect } from "../../middleware/auth";

export const userRouter = Router();

// ── Validators (plain functions, no extra lib needed) ─────────────────────────
const validateRegister = (body: Record<string, unknown>) => {
  const errors: string[] = [];
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2)
    errors.push("name must be at least 2 characters");
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email as string))
    errors.push("valid email is required");
  if (!body.password || (body.password as string).length < 8)
    errors.push("password must be at least 8 characters");
  return errors;
};

const validateLogin = (body: Record<string, unknown>) => {
  const errors: string[] = [];
  if (!body.email) errors.push("email is required");
  if (!body.password) errors.push("password is required");
  return errors;
};

// ── Public routes (no auth required) ─────────────────────────────────────────
userRouter.post("/register", validateBody(validateRegister), register);
userRouter.post("/login", validateBody(validateLogin), login);

// ── Protected routes (JWT required) ──────────────────────────────────────────
userRouter.get("/me", protect, getMyProfile);

userRouter.patch(
  "/me",
  protect,
  upload.single("avatar"),
  updateMyProfile
);

userRouter.patch("/change-password", protect, changePassword);
userRouter.delete("/me/avatar", protect, deleteAvatar);