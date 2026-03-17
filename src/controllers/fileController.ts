import { Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import createError from "http-errors";
import { uploadToCloudinary } from "../utils/cloudinary";
import cloudinary from "../config/cloudinary";
import { AuthRequest } from "../types";
import { successResponse } from "./responsControllers";
import { processFileBuffer } from "../utils/documentProcessor";
import { UserDocument } from "../models/UserDocument";

/**
 * @desc    Upload a single file (with AI processing)
 * @route   POST /api/files/upload
 * @access  Private
 */
export const handleUploadFile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw createError(400, "No file uploaded");
    }

    const folder = req.body.folder || "general-uploads";
    const userId = req.user!._id;
    
    try {
      // 1. Upload to Cloudinary with appropriate resource type
      const mime = req.file.mimetype || "";
      let resourceType: 'image' | 'video' | 'raw' = 'image';
      if (mime.startsWith("video/")) resourceType = 'video';
      else if (!mime.startsWith("image/")) resourceType = 'raw';
      const result: any = await uploadToCloudinary(req.file.buffer, folder, resourceType);
      
      // 2. Process for AI if it's a document
      let textContent = "";
      const allowedDocTypes = [".pdf", ".txt", ".docx", ".md"];
      const ext = req.file.originalname.split('.').pop()?.toLowerCase();
      
      if (ext && allowedDocTypes.includes(`.${ext}`)) {
        try {
          textContent = await processFileBuffer(
            req.file.buffer, 
            req.file.originalname, 
            req.file.mimetype
          );
        } catch (err) {
          console.error("Text extraction failed:", err);
          // Don't fail the whole upload if text extraction fails
        }
      }

      // 3. Save metadata to database
      const userDoc = await UserDocument.create({
        userId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileSize: req.file.size,
        textContent: textContent || "No text content extracted.",
      });
      
      successResponse(res, {
        statusCode: 200,
        message: "File uploaded and processed successfully",
        payload: {
          document: userDoc,
        },
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw createError(500, "Failed to upload file to storage");
    }
  }
);

/**
 * @desc    Upload multiple files
 * @route   POST /api/files/upload-multiple
 * @access  Private
 */
export const handleUploadMultipleFiles = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      throw createError(400, "No files uploaded");
    }

    const folder = req.body.folder || "general-uploads";
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const result: any = await uploadToCloudinary(file.buffer, folder);
        uploadedFiles.push({
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
          originalName: file.originalname,
        });
      } catch (error) {
        console.error(`Cloudinary upload error for ${file.originalname}:`, error);
        // We continue with other files if one fails
      }
    }

    if (uploadedFiles.length === 0) {
      throw createError(500, "Failed to upload any files");
    }

    successResponse(res, {
      statusCode: 200,
      message: `${uploadedFiles.length} files uploaded successfully`,
      payload: uploadedFiles,
    });
  }
);

/**
 * @desc    Get all documents for current user
 * @route   GET /api/files
 * @access  Private
 */
export const handleGetUserDocuments = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user!._id;

    const documents = await UserDocument.find({ userId })
      .select("-textContent") // Don't send large text content in list
      .sort({ createdAt: -1 });

    successResponse(res, {
      statusCode: 200,
      message: "Documents retrieved successfully",
      payload: {
        documents,
      },
    });
  }
);

/**
 * @desc    Delete a file from Cloudinary
 * @route   DELETE /api/files/:public_id
 * @access  Private
 */
export const handleDeleteFile = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { public_id } = req.params;

    if (!public_id) {
      throw createError(400, "Public ID is required");
    }

    try {
      // 1. Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(public_id as string);
      
      // 2. Delete from database
      await UserDocument.findOneAndDelete({ publicId: public_id as string });

      successResponse(res, {
        statusCode: 200,
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      throw createError(500, "Failed to delete file from storage");
    }
  }
);
