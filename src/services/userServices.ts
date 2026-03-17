import { Types } from "mongoose";
import createError from "http-errors";
import User from "../models/schemas/User"; // ensure User exports IUserDoc
import { IUser } from "../types";
import { IUserDoc } from "../models/types/UserTypes";

interface UpdateOptions {
  new?: boolean;
  runValidators?: boolean;
  context?: string;
}

// ✅ Find user
export const findUser = async (id: string | undefined): Promise<IUserDoc> => {
  if (!Types.ObjectId.isValid(id || "")) {
    throw createError(400, "Invalid user ID");
  }

  const user = await User.findById(id).select("+password");
  if (!user) {
    throw createError(404, "User not found");
  }
  return user;
};

// ✅ Delete user
export const deleteUser = async (id: string): Promise<IUserDoc> => {
  if (!Types.ObjectId.isValid(id)) {
    throw createError(400, "Invalid user ID");
  }

  const userDelete = await User.findByIdAndDelete(id);
  if (!userDelete) {
    throw createError(404, "User not found for deletion");
  }
  return userDelete;
};

// ✅ Update user
export const updateUser = async (
  id: string,
  updates: Partial<IUser>,
  updateOptions: UpdateOptions
): Promise<IUserDoc> => {
  if (!Types.ObjectId.isValid(id)) {
    throw createError(400, "Invalid user ID");
  }

  const userUpdate = await User.findByIdAndUpdate(id, updates as any, updateOptions);
  if (!userUpdate) {
    throw createError(404, "User not found for update");
  }
  return userUpdate;
};

// ✅ Create user
export const createUser = async (
  username: string,
  email: string,
  password: string
): Promise<IUserDoc> => {
  const user = await User.create({ username, email, password });
  return user;
};

// ✅ Check existing user
export const existingUser = async (email: string): Promise<void> => {
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw createError(400, "User already exists");
  }
};
