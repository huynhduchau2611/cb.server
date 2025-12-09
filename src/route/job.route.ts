import { Router } from 'express';
import { PostController } from '../controller/post.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateJobCreation, validateJobUpdate } from '../middleware/job.validation';
import { USER_ROLES } from '../const';

const router = Router();

// Protected routes - Employer only
router.post(
  '/',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  validateJobCreation,
  PostController.createJob
);

router.get(
  '/my-jobs',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PostController.getMyJobs
);

router.get(
  '/my-stats',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PostController.getMyJobStats
);

router.get(
  '/my-job/:id',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PostController.getMyJobById
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  validateJobUpdate,
  PostController.updateJob
);

router.patch(
  '/:id/visibility',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PostController.updateJobVisibility
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PostController.deleteJob
);

export default router;

