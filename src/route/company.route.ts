import { Router } from 'express';
import { CompanyController } from '../controller/company.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { uploadAvatar } from '../middleware/upload.middleware';
import { USER_ROLES } from '../const';

const router = Router();

// Protected routes - Authenticated users
router.post(
  '/partner-request',
  authenticateToken,
  CompanyController.submitPartnerRequest
);

router.get(
  '/my-company',
  authenticateToken,
  CompanyController.getMyCompany
);

router.patch(
  '/my-company',
  authenticateToken,
  CompanyController.updateMyCompany
);

router.post(
  '/my-company/avatar',
  authenticateToken,
  uploadAvatar.single('avatar'),
  CompanyController.uploadCompanyAvatar
);

// Admin only routes
router.get(
  '/partner-requests',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  CompanyController.getAllPartnerRequests
);

router.patch(
  '/partner-requests/:id/approve',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  CompanyController.approvePartnerRequest
);

router.patch(
  '/partner-requests/:id/reject',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  CompanyController.rejectPartnerRequest
);

// Plan management routes
router.get(
  '/plans/templates',
  CompanyController.getPlanTemplates
);

router.patch(
  '/:id/plan',
  authenticateToken,
  CompanyController.updateCompanyPlan
);

// Get employer user from company ID (public endpoint)
router.get(
  '/:companyId/employer',
  CompanyController.getEmployerUser
);

// Featured companies (public)
router.get(
  '/featured',
  CompanyController.getFeaturedCompanies
);

// Toggle company featured status (Admin only)
router.patch(
  '/:id/featured',
  authenticateToken,
  authorizeRoles(USER_ROLES.ADMIN),
  CompanyController.toggleCompanyFeatured
);

export default router;

