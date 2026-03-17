import { Router } from "express";
import { 
  handleUploadFile, 
  handleUploadMultipleFiles, 
  handleDeleteFile,
  handleGetUserDocuments
} from "../controllers/fileController";
import { isLoggedIn } from "../middleware/auth";
import upload from "../config/multer.config";

const fileRouter = Router();

// All file routes require login
fileRouter.use(isLoggedIn);

/**
 * @route   GET /api/files
 * @desc    Get all user documents
 */
fileRouter.get("/", handleGetUserDocuments);

/**
 * @route   POST /api/files/upload
 * @desc    Upload a single file
 */
fileRouter.post("/", upload.single("file"), handleUploadFile);
fileRouter.post("/upload", upload.single("file"), handleUploadFile);

/**
 * @route   POST /api/files/upload-multiple
 * @desc    Upload multiple files
 */
fileRouter.post("/upload-multiple", upload.array("files", 10), handleUploadMultipleFiles);

/**
 * @route   DELETE /api/files/:public_id
 * @desc    Delete a file
 */
fileRouter.delete("/:public_id", handleDeleteFile);

export default fileRouter;
