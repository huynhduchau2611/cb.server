import { Router } from 'express';
import { PostController } from '../controller/post.controller';
import { CompanyController } from '../controller/company.controller';
import { getAllUsers, getUserById, toggleUserStatus } from '../controller/user.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { USER_ROLES } from '../const';

const router = Router();

// All routes require admin role
router.use(authenticateToken);
router.use(authorizeRoles(USER_ROLES.ADMIN));

// Job management routes
router.get('/jobs', PostController.getAllJobsForAdmin);
router.get('/jobs/stats', PostController.getAdminJobStats);
router.patch('/jobs/:id/approve', PostController.approveJob);
router.patch('/jobs/:id/reject', PostController.rejectJob);
router.patch('/jobs/:id/toggle-featured', PostController.toggleFeatured);

// User management routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/toggle-status', toggleUserStatus);

// Admin overview statistics
router.get('/overview/stats', CompanyController.getAdminOverviewStats);

export default router;

