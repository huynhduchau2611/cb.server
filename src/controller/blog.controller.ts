import { Request, Response } from 'express';
import Blog from '@/model/Blog.model';
import { successResponse, errorResponse } from '@/utils/response.util';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class BlogController {
  /**
   * Create a new blog post
   * Protected - Any authenticated user can create
   */
  public static async createBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, excerpt, coverImage, tags } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Validate inputs
      if (!title || !title.trim()) {
        errorResponse(res, 'Title is required', 400);
        return;
      }

      if (!content || !content.trim() || content === '<p></p>') {
        errorResponse(res, 'Content is required', 400);
        return;
      }

      const blog = await Blog.create({
        title,
        content,
        excerpt: excerpt || undefined,
        coverImage: coverImage || undefined,
        tags: tags || [],
        author: userId,
        status: 'pending',
      });

      const populatedBlog = await Blog.findById(blog._id)
        .populate('author', 'fullName email avatar')
        .lean();

      successResponse(res, {
        blog: populatedBlog,
        message: 'Blog created successfully. Waiting for admin approval.',
      }, 201);
    } catch (error: any) {
      console.error('Create blog error:', error);
      
      // Send more specific error message
      const errorMessage = error.message || 'Failed to create blog';
      errorResponse(res, errorMessage, 500);
    }
  }

  /**
   * Get all approved blogs (Public)
   */
  public static async getPublicBlogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        tag,
        sortBy = 'publishedAt',
        sortOrder = 'desc',
      } = req.query;

      const filter: any = { status: 'approved' };

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { excerpt: { $regex: search, $options: 'i' } },
        ];
      }

      if (tag) {
        filter.tags = tag;
      }

      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const skip = (Number(page) - 1) * Number(limit);

      const [blogs, total] = await Promise.all([
        Blog.find(filter)
          .populate('author', 'fullName avatar')
          .select('-content') // Exclude full content for list view
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Blog.countDocuments(filter),
      ]);

      successResponse(res, {
        blogs,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      console.error('Get public blogs error:', error);
      errorResponse(res, 'Failed to fetch blogs', 500);
    }
  }

  /**
   * Get blog by slug (Public - only approved blogs)
   */
  public static async getBlogBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const blog = await Blog.findOne({ slug, status: 'approved' })
        .populate('author', 'fullName email avatar')
        .lean();

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      // Increment view count
      await Blog.findByIdAndUpdate(blog._id, { $inc: { viewCount: 1 } });

      successResponse(res, { blog });
    } catch (error) {
      console.error('Get blog by slug error:', error);
      errorResponse(res, 'Failed to fetch blog', 500);
    }
  }

  /**
   * Get my blogs
   * Protected - User's own blogs
   */
  public static async getMyBlogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const {
        page = 1,
        limit = 10,
        status,
      } = req.query;

      const filter: any = { author: userId };
      if (status) {
        filter.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [blogs, total] = await Promise.all([
        Blog.find(filter)
          .select('-content')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Blog.countDocuments(filter),
      ]);

      successResponse(res, {
        blogs,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      console.error('Get my blogs error:', error);
      errorResponse(res, 'Failed to fetch your blogs', 500);
    }
  }

  /**
   * Get my blog by ID
   * Protected - User can view their own blog regardless of status
   */
  public static async getMyBlogById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const blog = await Blog.findOne({ _id: id, author: userId })
        .populate('author', 'fullName email avatar')
        .lean();

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      successResponse(res, { blog });
    } catch (error) {
      console.error('Get my blog error:', error);
      errorResponse(res, 'Failed to fetch blog', 500);
    }
  }

  /**
   * Update my blog
   * Protected - User can update their own pending/rejected blogs
   */
  public static async updateBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { title, content, excerpt, coverImage, tags } = req.body;

      const blog = await Blog.findOne({ _id: id, author: userId });

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      // Only allow updating pending or rejected blogs
      if (blog.status === 'approved') {
        errorResponse(res, 'Cannot edit approved blog. Please create a new one.', 400);
        return;
      }

      // Update fields
      if (title) blog.title = title;
      if (content) blog.content = content;
      if (excerpt !== undefined) blog.excerpt = excerpt;
      if (coverImage !== undefined) blog.coverImage = coverImage;
      if (tags) blog.tags = tags;

      // Reset status to pending if it was rejected
      if (blog.status === 'rejected') {
        blog.status = 'pending';
        blog.rejectionReason = '';
      }

      await blog.save();

      const updatedBlog = await Blog.findById(blog._id)
        .populate('author', 'fullName email avatar')
        .lean();

      successResponse(res, {
        blog: updatedBlog,
        message: 'Blog updated successfully',
      });
    } catch (error) {
      console.error('Update blog error:', error);
      errorResponse(res, 'Failed to update blog', 500);
    }
  }

  /**
   * Delete my blog
   * Protected - User can delete their own blogs
   */
  public static async deleteBlog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const blog = await Blog.findOne({ _id: id, author: userId });

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      await Blog.findByIdAndDelete(id);

      successResponse(res, { message: 'Blog deleted successfully' });
    } catch (error) {
      console.error('Delete blog error:', error);
      errorResponse(res, 'Failed to delete blog', 500);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get all blogs for admin (all statuses)
   * Admin only
   */
  public static async getAllBlogsForAdmin(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { excerpt: { $regex: search, $options: 'i' } },
        ];
      }

      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const skip = (Number(page) - 1) * Number(limit);

      const [blogs, total] = await Promise.all([
        Blog.find(filter)
          .populate('author', 'fullName email avatar')
          .select('-content')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Blog.countDocuments(filter),
      ]);

      successResponse(res, {
        blogs,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      console.error('Admin get blogs error:', error);
      errorResponse(res, 'Failed to fetch blogs', 500);
    }
  }

  /**
   * Approve blog
   * Admin only
   */
  public static async approveBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const blog = await Blog.findById(id);

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      if (blog.status === 'approved') {
        errorResponse(res, 'Blog is already approved', 400);
        return;
      }

      blog.status = 'approved';
      blog.publishedAt = new Date();
      blog.rejectionReason = '';
      await blog.save();

      const updatedBlog = await Blog.findById(blog._id)
        .populate('author', 'fullName email avatar')
        .lean();

      successResponse(res, {
        blog: updatedBlog,
        message: 'Blog approved successfully',
      });
    } catch (error) {
      console.error('Approve blog error:', error);
      errorResponse(res, 'Failed to approve blog', 500);
    }
  }

  /**
   * Reject blog
   * Admin only
   */
  public static async rejectBlog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      const blog = await Blog.findById(id);

      if (!blog) {
        errorResponse(res, 'Blog not found', 404);
        return;
      }

      blog.status = 'rejected';
      blog.rejectionReason = rejectionReason || 'Does not meet content guidelines';
      await blog.save();

      const updatedBlog = await Blog.findById(blog._id)
        .populate('author', 'fullName email avatar')
        .lean();

      successResponse(res, {
        blog: updatedBlog,
        message: 'Blog rejected',
      });
    } catch (error) {
      console.error('Reject blog error:', error);
      errorResponse(res, 'Failed to reject blog', 500);
    }
  }

  /**
   * Get blog statistics for admin
   */
  public static async getBlogStats(_req: Request, res: Response): Promise<void> {
    try {
      const [totalBlogs, pendingBlogs, approvedBlogs, rejectedBlogs, totalViews] = await Promise.all([
        Blog.countDocuments(),
        Blog.countDocuments({ status: 'pending' }),
        Blog.countDocuments({ status: 'approved' }),
        Blog.countDocuments({ status: 'rejected' }),
        Blog.aggregate([
          { $group: { _id: null, total: { $sum: '$viewCount' } } }
        ]).then(result => result[0]?.total || 0),
      ]);

      successResponse(res, {
        totalBlogs,
        pendingBlogs,
        approvedBlogs,
        rejectedBlogs,
        totalViews,
      });
    } catch (error) {
      console.error('Get blog stats error:', error);
      errorResponse(res, 'Failed to fetch blog statistics', 500);
    }
  }
}

