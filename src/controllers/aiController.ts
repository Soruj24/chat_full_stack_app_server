import { Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import { aiService } from "../services/aiService";
import { AuthRequest } from "../types";
import { successResponse } from "./responsControllers";
import createHttpError from "http-errors";

 
  // Handle AI assistant chat requests
  
export const handleAiChat = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { message } = req.body;
    const userId = req.user?._id;

    if (!message) {
      throw createHttpError(400, "Message is required");
    }

    if (!userId) {
      throw createHttpError(401, "User not authenticated");
    }

    const response = await aiService.chat(userId.toString(), message);

    successResponse(res, {
      statusCode: 200,
      message: "AI response generated successfully",
      payload: {
        response,
      },
    });
  }
);
