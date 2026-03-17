import { Request, Response, NextFunction } from "express";
import generateMockData from "../config/data";
import User from "../models/schemas/User";

export const seedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { users } = await generateMockData();

    await User.deleteMany({});
    const createdUsers = await User.insertMany(users);

    res.status(201).json({
      success: true,
      message: "Seed user data added successfully",
      count: Array.isArray(createdUsers) ? createdUsers.length : 0,
      users: createdUsers,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getSeedStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userCount = await User.countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        users: userCount,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
