import { Router } from 'express';
import { CommentController } from '../controller/comment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/', CommentController.getComments);

// Protected routes (authentication required)
router.post('/', authenticateToken, CommentController.createComment);
router.post('/:id/upvote', authenticateToken, CommentController.upvoteComment);
router.delete('/:id', authenticateToken, CommentController.deleteComment);

export default router;

