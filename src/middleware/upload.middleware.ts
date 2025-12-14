import multer from 'multer';
import { Request } from 'express';

// Configure multer for memory storage (for file uploads)
const storage = multer.memoryStorage();

// File filter for CV uploads (PDF, DOC, DOCX only)
// File is optional - if no file is provided, it's OK (for form type applications)
const fileFilter = (req: Request, file: Express.Multer.File | undefined, cb: multer.FileFilterCallback) => {
  // If no file provided, allow (for form type applications)
  if (!file) {
    return cb(null, true);
  }

  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
  }
};

// Multer configuration - file is optional
export const uploadCV = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// File filter for avatar uploads (images only)
const avatarFileFilter = (req: Request, file: Express.Multer.File | undefined, cb: multer.FileFilterCallback) => {
  if (!file) {
    return cb(new Error('Avatar file is required'));
  }

  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Multer configuration for avatar uploads
export const uploadAvatar = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for avatars
  },
});

