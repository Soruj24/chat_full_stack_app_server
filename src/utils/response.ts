import { Response } from "express";

/**
 * Standardized success response format
 */
export const successResponse = (
  res: Response,
  {
    statusCode = 200,
    message = "Success",
    payload = {},
  }: {
    statusCode?: number;
    message?: string;
    payload?: any;
  }
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    payload,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Standardized error response format
 */
export const errorResponse = (
  res: Response,
  {
    statusCode = 500,
    message = "Internal Server Error",
    errors = [],
  }: {
    statusCode?: number;
    message?: string;
    errors?: any[];
  }
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};
