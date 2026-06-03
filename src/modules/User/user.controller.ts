// ─── user.controller.ts ───────────────────────────────────────────────────────
// Thin layer: parse request → call service → send response.
// All business logic lives in user.service.ts.

import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { sendResponse, sendError } from "../../utils/sendResponse";
import { userService } from "./user.service";

// ── POST /auth/register ───────────────────────────────────────────────────────
export const register = catchAsync(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const result = await userService.register({ name, email, password, role });

  return sendResponse(res, {
    statusCode: 201,
    message: "Registration successful",
    token: result.token,
    data: result.user,
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await userService.login({ email, password });

  return sendResponse(res, {
    statusCode: 200,
    message: "Login successful",
    token: result.token,
    data: result.user,
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const profile = await userService.getProfile(req.user!.userId);

  return sendResponse(res, {
    statusCode: 200,
    message: "Profile retrieved",
    data: profile,
  });
});

// ── PATCH /auth/me ────────────────────────────────────────────────────────────

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const dto = req.body.data ? JSON.parse(req.body.data) : req.body;

  const { name, phone } = dto;
  const updated = await userService.updateProfile(
    req.user!.userId,
    { name, phone },
    req.file
  );

  return sendResponse(res, {
    statusCode: 200,
    message: "Profile updated",
    data: updated,
  });
});

// ── PATCH /auth/change-password ───────────────────────────────────────────────
export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return sendError(res, "oldPassword and newPassword are required", 400);
  }
  if (newPassword.length < 8) {
    return sendError(res, "New password must be at least 8 characters", 400);
  }

  await userService.changePassword(req.user!.userId, oldPassword, newPassword);

  return sendResponse(res, {
    statusCode: 200,
    message: "Password changed successfully",
    data: null,
  });
});

// ── DELETE /auth/me/avatar ────────────────────────────────────────────────────
export const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  await userService.deleteAvatar(req.user!.userId);
  return res.status(204).send();
});