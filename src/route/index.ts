import { Router } from 'express';
import publicRoutes from './public.route';
import authRoutes from './auth.route';
import userRoutes from './user.route';
import companyRoutes from './company.route';
import jobRoutes from './job.route';
import adminRoutes from './admin.route';
import blogRoutes from './blog.route';
import publicBlogRoutes from './publicBlog.route';
import adminBlogRoutes from './adminBlog.route';
import applicationRoutes from './application.route';
import paymentRoutes from './payment.route';
import chatRoutes from './chat.route';
import commentRoutes from './comment.route';

const router = Router();

// Public routes (no authentication required)
router.use('/api/public', publicRoutes);
router.use('/api/public/blogs', publicBlogRoutes);

// Protected routes (authentication required)
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/companies', companyRoutes);
router.use('/api/jobs', jobRoutes);
router.use('/api/blogs', blogRoutes);
router.use('/api/applications', applicationRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/chat', chatRoutes);
router.use('/api/comments', commentRoutes);

// Admin routes (admin only)
router.use('/api/admin', adminRoutes);
router.use('/api/admin/blogs', adminBlogRoutes);

// Health check endpoint
router.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'CareerBridge API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
