import { Router } from 'express';
import { PostController } from '@/controller/post.controller';
import { CompanyController } from '@/controller/company.controller';
import { getUserById } from '@/controller/user.controller';

const router = Router();

// Post routes (public)
router.get('/posts', PostController.getAllPosts);
router.get('/posts/featured', PostController.getFeaturedPosts);
router.get('/posts/stats', PostController.getJobStats);
router.get('/posts/suggestions', PostController.getSearchSuggestions);
router.get('/posts/:id', PostController.getPostById);
router.get('/companies/:companyId/posts', PostController.getPostsByCompany);
router.post('/posts/update-expired', PostController.updateExpiredPosts);

// Company routes (public)
router.get('/companies', CompanyController.getAllCompanies);
router.get('/companies/search', CompanyController.searchCompanies);
router.get('/companies/stats', CompanyController.getCompanyStats);
router.get('/companies/location/:province/:district?', CompanyController.getCompaniesByLocation);
router.get('/companies/tax-code/:taxCode', CompanyController.getCompanyByTaxCode);
router.get('/companies/:id', CompanyController.getCompanyById);

// User routes (public)
router.get('/users/:id', getUserById);

export default router;
