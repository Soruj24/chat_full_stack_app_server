import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const imageTypes = /jpeg|jpg|png|gif|webp/;
    const videoTypes = /mp4|webm|mov|mkv|avi/;
    const audioTypes = /mp3|wav|m4a|ogg|webm/;
    const docTypes = /pdf|txt|doc|docx|md|zip|rar/;

    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    const ok =
        imageTypes.test(ext) ||
        videoTypes.test(ext) ||
        audioTypes.test(ext) ||
        docTypes.test(ext);

    if (ok) return cb(null, true);
    cb(new Error('Unsupported file type'));
};

const upload = multer({
    storage,
    fileFilter,
    // Allow larger uploads to support short videos/voice notes
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export default upload;
