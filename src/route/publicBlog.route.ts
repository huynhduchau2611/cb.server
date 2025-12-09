import { Router } from 'express';
import { BlogController } from '../controller/blog.controller';

const router = Router();

// Public blog routes - No authentication required

// Get all approved blogs
router.get('/', BlogController.getPublicBlogs);

// Get blog by slug
router.get('/:slug', BlogController.getBlogBySlug);

export default router;

