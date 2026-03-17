import { Request, Response, NextFunction } from "express";
import Message from "../models/Message";
import Chat from "../models/Chat";
import mongoose from "mongoose";
import { errorResponse, successResponse } from "./responsControllers";
import User from "../models/schemas/User";
import { io } from "../index";

export const createMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }

    const { chatId, text, type, mediaUrl, fileName, fileSize, duration, location, contact, replyTo, isForwarded } = req.body;

    if (!chatId || !mongoose.isValidObjectId(chatId)) {
      errorResponse(res, { statusCode: 400, message: "Invalid chatId" });
      return;
    }

    const message = await Message.create({
      chatId: chatId as any,
      sender: userId as any,
      text,
      type: type || 'text',
      mediaUrl,
      fileName,
      fileSize,
      duration,
      location,
      contact,
      replyTo: replyTo && mongoose.isValidObjectId(replyTo) 
        ? (replyTo as any)
        : undefined,
      isForwarded: !!isForwarded,
      timestamp: new Date(),
      status: 'sent'
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id
    });

    successResponse(res, {
      statusCode: 201,
      message: "Message created successfully",
      payload: message
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?._id;

        const message = await Message.findById(id);
        if (!message) {
            errorResponse(res, { statusCode: 404, message: "Message not found" });
            return;
        }

        if (message.sender.toString() !== userId.toString()) {
            errorResponse(res, { statusCode: 403, message: "Unauthorized" });
            return;
        }

        await Message.findByIdAndDelete(id);

        successResponse(res, {
            statusCode: 200,
            message: "Message deleted successfully"
        });
        return;
    } catch (error) {
        next(error);
    }
};

export const pinMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { chatId } = req.body;
        const userId = (req as any).user?._id;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            errorResponse(res, { statusCode: 404, message: "Chat not found" });
            return;
        }

        const isPinned = chat.pinnedMessages.includes(id as any);

        if (isPinned) {
            chat.pinnedMessages = chat.pinnedMessages.filter((msgId: any) => msgId.toString() !== id.toString());
        } else {
            chat.pinnedMessages.push(id as any);
        }

        await chat.save();

        successResponse(res, {
            statusCode: 200,
            message: isPinned ? "Message unpinned" : "Message pinned",
            payload: { isPinned: !isPinned }
        });
        return;
    } catch (error) {
        next(error);
    }
};

export const reactMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;
    const { messageId, emoji } = req.body as { messageId?: string; emoji?: string };

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }
    if (!messageId || !mongoose.isValidObjectId(messageId) || !emoji) {
      errorResponse(res, { statusCode: 400, message: "Invalid input" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      errorResponse(res, { statusCode: 404, message: "Message not found" });
      return;
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r: any) => r.userId.toString() === userId.toString()
    );

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({
        userId: userId as any,
        emoji,
        timestamp: new Date()
      });
    }
    await message.save();

    // Broadcast via socket to the chat room
    io.to(message.chatId.toString()).emit("message_reaction", {
      messageId: message._id.toString(),
      reactions: message.reactions.map((r: { emoji: string; userId?: mongoose.Types.ObjectId }) => ({ emoji: r.emoji, userId: r.userId?.toString() })),
      userId: userId.toString()
    });

    successResponse(res, {
      statusCode: 200,
      message: "Reaction updated",
      payload: {
        messageId: message._id.toString(),
        reactions: message.reactions
      }
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const starMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;
    const { id } = req.params;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }
    if (!id || !mongoose.isValidObjectId(id)) {
      errorResponse(res, { statusCode: 400, message: "Invalid messageId" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      errorResponse(res, { statusCode: 404, message: "User not found" });
      return;
    }

    const isStarred = (user as any).starredMessages?.includes(id as any);

    if (isStarred) {
      await User.findByIdAndUpdate(userId, {
        $pull: { starredMessages: id as any }
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { starredMessages: id as any }
      });
    }

    successResponse(res, {
      statusCode: 200,
      message: isStarred ? "Message unstarred" : "Message starred",
      payload: { isStarred: !isStarred }
    });
    return;
  } catch (error) {
    next(error);
  }
};
