import cloudinary from '../config/cloudinary';

export const uploadToCloudinary = async (
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    
    uploadStream.end(buffer);
  });
};