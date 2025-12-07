import { Router } from 'express';
import { BlogController } from '../controller/blog.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { USER_ROLES } from '../const';

const router = Router();

// ==================== USER ROUTES ====================
// Protected routes - Any authenticated user

router.post(
  '/',
  authenticateToken,
  BlogController.createBlog
);

router.get(
  '/my-blogs',
  authenticateToken,
  BlogController.getMyBlogs
);

router.get(
  '/my-blogs/:id',
  authenticateToken,
  BlogController.getMyBlogById
);

router.delete(
  '/:id',
  authenticateToken,
  BlogController.deleteBlog
);

export default router;

