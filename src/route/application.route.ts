import { Router } from 'express';
import { ApplicationController } from '../controller/application.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { uploadCV } from '../middleware/upload.middleware';
import { USER_ROLES, APPLICATION_TYPE } from '../const';

const router = Router();

// Candidate routes
// Apply multer middleware (file is optional, will be undefined if not provided)
router.post(
  '/',
  authenticateToken,
  authorizeRoles(USER_ROLES.CANDIDATE),
  uploadCV.single('cvFile'),
  ApplicationController.createApplication
);

router.get(
  '/my-applications',
  authenticateToken,
  authorizeRoles(USER_ROLES.CANDIDATE),
  ApplicationController.getMyApplications
);

// Employer routes
router.get(
  '/job/:postId',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  ApplicationController.getJobApplications
);

router.get(
  '/my-jobs',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  ApplicationController.getMyJobApplications
);

router.patch(
  '/:applicationId/status',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER, USER_ROLES.ADMIN),
  ApplicationController.updateApplicationStatus
);

router.get(
  '/stats',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER, USER_ROLES.ADMIN),
  ApplicationController.getApplicationStats
);

// Admin routes
router.get(
  '/',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  ApplicationController.getAllApplications
);

export default router;

