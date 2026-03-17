import { Router } from "express";
import { handleGetAllUsers, handleGetUser } from "../controllers/authController";
import { isLoggedIn } from "../middleware/auth";

const userRouter = Router();

// These routes are used by the chat application to find users
userRouter.get("/", isLoggedIn, handleGetAllUsers);
userRouter.get("/:userId", isLoggedIn, handleGetUser);

export default userRouter;
