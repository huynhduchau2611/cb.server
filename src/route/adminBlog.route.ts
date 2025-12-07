import { Router } from 'express';
import { BlogController } from '../controller/blog.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { USER_ROLES } from '../const';

const router = Router();

// Admin blog routes - Admin only

// Get all blogs (all statuses)
router.get(
  '/',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  BlogController.getAllBlogsForAdmin
);

// Get blog statistics
router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  BlogController.getBlogStats
);

// Approve blog
router.patch(
  '/:id/approve',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  BlogController.approveBlog
);

// Reject blog
router.patch(
  '/:id/reject',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  BlogController.rejectBlog
);

export default router;

