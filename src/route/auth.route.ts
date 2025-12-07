import { Router } from 'express';
import { register, login, getProfile, updateProfile, refreshToken } from '@/controller/auth.controller';
import { validateRegister, validateLogin, validateUpdateProfile } from '@/middleware/validation.middleware';
import { authenticateToken } from '@/middleware/auth.middleware';

const router = Router();

// Public auth routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

// Protected auth routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, validateUpdateProfile, updateProfile);
router.post('/refresh-token', authenticateToken, refreshToken);

export default router;
