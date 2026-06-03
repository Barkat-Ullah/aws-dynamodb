import { Response } from "express";

type TSuccessResponse<T> = {
  status?: boolean;
  statusCode: number;
  message: string;
  token?: string;
  data: T | T[] | null;
};

export const sendResponse = <T>(res: Response, data: TSuccessResponse<T>) => {
  res.status(data.statusCode).json({
    status: true,
    statusCode: data.statusCode,
    message: data.message,
    token: data.token,
    data: data.data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  status = 400,
  details?: any,
) => {
  return res
    .status(status)
    .json({ success: false, error: { message, details } });
};
