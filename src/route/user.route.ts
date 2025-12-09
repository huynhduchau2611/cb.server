import { Router } from 'express';
import { getProfile, updateProfile, changePassword, deleteAccount, uploadAvatar } from '@/controller/user.controller';
import { authenticateToken } from '@/middleware/auth.middleware';
import { uploadAvatar as uploadAvatarMiddleware } from '@/middleware/upload.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// User routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/profile/avatar', uploadAvatarMiddleware.single('avatar'), uploadAvatar);
router.put('/change-password', changePassword);
router.delete('/account', deleteAccount);

export default router;
