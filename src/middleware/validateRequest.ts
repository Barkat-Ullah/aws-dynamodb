import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/sendResponse";

export type ValidatorFn = (body: any) => string[];

export function validateBody(validator: ValidatorFn) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = validator(req.body || {});
    if (errors && errors.length > 0) {
      return sendError(res, "Invalid request payload", 400, { errors });
    }
    return next();
  };
}

