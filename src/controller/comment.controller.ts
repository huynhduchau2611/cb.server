import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { Comment, User, Company } from '../model';
import mongoose from 'mongoose';

export class CommentController {
  /**
   * Create a new comment
   * Protected endpoint - Authentication required
   */
  public static async createComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const { targetType, targetId, pros, cons } = req.body;

      // Validate required fields
      if (!targetType || !targetId || !pros || !cons) {
        errorResponse(res, 'Target type, target ID, pros, and cons are required', 400);
        return;
      }

      // Validate targetType
      if (!['user', 'company'].includes(targetType)) {
        errorResponse(res, 'Target type must be either "user" or "company"', 400);
        return;
      }

      // Validate target exists
      if (targetType === 'user') {
        const targetUser = await User.findById(targetId);
        if (!targetUser) {
          errorResponse(res, 'Target user not found', 404);
          return;
        }
        // Prevent self-comment
        if (targetId === userId) {
          errorResponse(res, 'Cannot comment on yourself', 400);
          return;
        }
      } else if (targetType === 'company') {
        const targetCompany = await Company.findById(targetId);
        if (!targetCompany) {
          errorResponse(res, 'Target company not found', 404);
          return;
        }
      }

      // Check if user already commented on this target
      const existingComment = await Comment.findOne({
        user: userId,
        targetType,
        targetId,
      });

      if (existingComment) {
        errorResponse(res, 'You have already commented on this target', 400);
        return;
      }

      // Create comment
      const comment = await Comment.create({
        user: userId,
        targetType,
        targetId,
        pros: pros.trim(),
        cons: cons.trim(),
        upCount: 0,
        upvotedBy: [],
      });

      // Populate user info
      await comment.populate('user', 'fullName email avatar role');

      successResponse(res, { comment }, 201);
    } catch (error: any) {
      console.error('Error creating comment:', error);
      if (error.code === 11000) {
        errorResponse(res, 'You have already commented on this target', 400);
      } else {
        errorResponse(res, error.message || 'Failed to create comment', 500);
      }
    }
  }

  /**
   * Get comments for a target (user or company)
   * Public endpoint - no authentication required
   */
  public static async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { targetType, targetId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // Validate required fields
      if (!targetType || !targetId) {
        errorResponse(res, 'Target type and target ID are required', 400);
        return;
      }

      if (!['user', 'company'].includes(targetType as string)) {
        errorResponse(res, 'Target type must be either "user" or "company"', 400);
        return;
      }

      // Build query
      const query: any = {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId as string),
      };

      // Build sort
      const sort: any = {};
      if (sortBy === 'upCount') {
        sort.upCount = sortOrder === 'desc' ? -1 : 1;
        sort.createdAt = -1; // Secondary sort by date
      } else {
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get comments with pagination
      const comments = await Comment.find(query)
        .populate('user', 'fullName email avatar role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      // Get total count
      const total = await Comment.countDocuments(query);

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      successResponse(res, {
        comments,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      errorResponse(res, error.message || 'Failed to fetch comments', 500);
    }
  }

  /**
   * Upvote a comment
   * Protected endpoint - Authentication required
   */
  public static async upvoteComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const { id } = req.params;
      const comment = await Comment.findById(id);

      if (!comment) {
        errorResponse(res, 'Comment not found', 404);
        return;
      }

      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isUpvoted = comment.upvotedBy.some(
        (id) => id.toString() === userId
      );

      if (isUpvoted) {
        // Remove upvote
        comment.upvotedBy = comment.upvotedBy.filter(
          (id) => id.toString() !== userId
        );
        comment.upCount = Math.max(0, comment.upCount - 1);
      } else {
        // Add upvote
        comment.upvotedBy.push(userIdObj);
        comment.upCount += 1;
      }

      await comment.save();

      // Populate user info
      await comment.populate('user', 'fullName email avatar role');

      successResponse(res, {
        comment,
        isUpvoted: !isUpvoted,
      });
    } catch (error: any) {
      console.error('Error upvoting comment:', error);
      errorResponse(res, error.message || 'Failed to upvote comment', 500);
    }
  }

  /**
   * Delete a comment
   * Protected endpoint - Authentication required (only comment owner or admin)
   */
  public static async deleteComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const { id } = req.params;
      const comment = await Comment.findById(id);

      if (!comment) {
        errorResponse(res, 'Comment not found', 404);
        return;
      }

      // Check if user is comment owner or admin
      if (comment.user.toString() !== userId && userRole !== 'admin') {
        errorResponse(res, 'You are not authorized to delete this comment', 403);
        return;
      }

      await Comment.findByIdAndDelete(id);

      successResponse(res, { message: 'Comment deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      errorResponse(res, error.message || 'Failed to delete comment', 500);
    }
  }
}

