import { Request, Response, NextFunction } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import mongoose from "mongoose";
import { errorResponse, successResponse } from "./responsControllers";

export const getChats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }

    const chats = await Chat.find({
      participants: userId
    })
    .populate("participants", "name username avatar email")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

    const chatsWithStatus = chats.map(chat => {
      const chatObj = chat.toObject();
      return {
        ...chatObj,
        id: chatObj._id.toString(),
        isPinned: chat.pinnedBy?.some((id: mongoose.Types.ObjectId) => id.toString() === userId.toString()),
        isArchived: chat.archivedBy?.some((id: mongoose.Types.ObjectId) => id.toString() === userId.toString()),
        isMuted: chat.mutedBy?.some((id: mongoose.Types.ObjectId) => id.toString() === userId.toString()),
      };
    });

    successResponse(res, {
      statusCode: 200,
      message: "Chats retrieved successfully",
      payload: chatsWithStatus
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const createChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      errorResponse(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }

    const { participantId, participantIds, type, name, description, avatar } = req.body;

    if (type === 'private') {
      // Check if private chat already exists
      let chat = await Chat.findOne({
        type: 'private',
        participants: { $all: [userId, participantId], $size: 2 }
      });

      if (chat) {
        const populatedChat = await Chat.findById(chat._id).populate("participants", "name username avatar email");
        const obj = populatedChat.toObject();
        successResponse(res, {
          statusCode: 200,
          message: "Chat already exists",
          payload: { ...obj, id: obj._id.toString() }
        });
        return;
      }

      chat = await Chat.create({
        type: 'private',
        participants: [userId, participantId]
      });

      const populatedChat = await Chat.findById(chat._id).populate("participants", "name username avatar email");
      const obj = populatedChat.toObject();
      successResponse(res, {
        statusCode: 201,
        message: "Chat created successfully",
        payload: { ...obj, id: obj._id.toString() }
      });
      return;
    } else {
      // Create group chat
      const participants = participantIds || [participantId];
      if (!participants.includes(userId.toString())) {
        participants.push(userId.toString());
      }

      const chat = await Chat.create({
        type: 'group',
        participants,
        name,
        description,
        avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
        admin: userId
      });

      const populatedChat = await Chat.findById(chat._id).populate("participants", "name username avatar email");
      const obj = populatedChat.toObject();
      successResponse(res, {
        statusCode: 201,
        message: "Group chat created successfully",
        payload: { ...obj, id: obj._id.toString() }
      });
      return;
    }
  } catch (error) {
    next(error);
  }
};

export const getChatMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const messages = await Message.find({ chatId: id })
      .populate("sender", "name avatar")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name" }
      })
      .sort({ timestamp: 1 });

    successResponse(res, {
      statusCode: 200,
      message: "Messages retrieved successfully",
      payload: messages
    });
    return;
  } catch (error) {
    next(error);
  }
};
