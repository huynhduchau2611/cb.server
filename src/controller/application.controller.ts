import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { APPLICATION_TYPE, APPLICATION_STATUS } from '../const';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export class ApplicationController {
  /**
   * Create a new application
   * Protected endpoint - Candidate only
   */
  public static async createApplication(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application, Post, User } = await import('../model');
      const userId = req.user?.id;
      let { postId, type } = req.body;
      const cvFile = (req as any).file;

      // Handle formData - can come as JSON string or as separate fields in multipart/form-data
      let formData: any = null;
      if (req.body.formData) {
        // If formData is provided as JSON string
        if (typeof req.body.formData === 'string') {
          try {
            formData = JSON.parse(req.body.formData);
          } catch (e) {
            // If parsing fails, ignore
          }
        } else {
          formData = req.body.formData;
        }
      } else if (req.body.phone || req.body.skills || req.body.experience || req.body.availability) {
        // Check if form data fields are in req.body directly (from multipart/form-data)
        formData = {
          phone: req.body.phone,
          skills: req.body.skills,
          experience: req.body.experience,
          availability: req.body.availability,
          additionalInfo: req.body.additionalInfo || '',
        };
      }

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Validate required fields
      if (!postId || !type) {
        errorResponse(res, 'Post ID and application type are required', 400);
        return;
      }

      // Validate application type
      if (!Object.values(APPLICATION_TYPE).includes(type)) {
        errorResponse(res, 'Invalid application type', 400);
        return;
      }

      // Check if post exists and is approved
      const post = await Post.findById(postId);
      if (!post) {
        errorResponse(res, 'Job post not found', 404);
        return;
      }

      if (post.status !== 'approved') {
        errorResponse(res, 'This job post is not available for applications', 403);
        return;
      }

      // Ensure the job is still accepting applications
      const currentApplied = post.candidateApplied ?? 0;
      const maxCandidates = post.candidateCount ?? 0;
      if (maxCandidates > 0 && currentApplied >= maxCandidates) {
        errorResponse(res, 'This job post has reached its application limit', 400);
        return;
      }

      // Check if user already applied to this post
      const existingApplication = await Application.findOne({
        post: postId,
        user: userId,
      });

      if (existingApplication) {
        errorResponse(res, 'You have already applied to this job', 400);
        return;
      }

      // Validate based on type
      if (type === APPLICATION_TYPE.CV) {
        if (!cvFile) {
          errorResponse(res, 'CV file is required for CV type applications', 400);
          return;
        }
      } else if (type === APPLICATION_TYPE.FORM) {
        if (!formData || !formData.phone || !formData.skills || !formData.experience || !formData.availability) {
          errorResponse(res, 'Form data is required for form type applications', 400);
          return;
        }
      }

      // Handle CV file upload
      let cvUrl: string | undefined;
      if (cvFile) {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads', 'cvs');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(cvFile.originalname);
        const fileName = `${userId}-${postId}-${Date.now()}${fileExtension}`;
        const filePath = path.join(uploadsDir, fileName);

        // Save file
        fs.writeFileSync(filePath, cvFile.buffer);

        // Generate URL (in production, use cloud storage like S3)
        cvUrl = `/uploads/cvs/${fileName}`;
      }

      // Create application
      const applicationData: any = {
        type,
        user: userId,
        post: postId,
        status: APPLICATION_STATUS.APPLIED,
      };

      if (type === APPLICATION_TYPE.CV && cvUrl) {
        applicationData.cvUrl = cvUrl;
      }

      if (type === APPLICATION_TYPE.FORM && formData) {
        applicationData.formData = {
          phone: formData.phone,
          skills: formData.skills,
          experience: formData.experience,
          availability: formData.availability,
          additionalInfo: formData.additionalInfo || '',
        };
      }

      const application = await Application.create(applicationData);

      // Keep candidate applied statistics in sync
      post.candidateApplied = (post.candidateApplied ?? 0) + 1;
      await post.save();

      // Populate user and post for response
      await application.populate([
        { path: 'user', select: 'fullName email phone' },
        { path: 'post', select: 'title company' },
      ]);

      successResponse(res, {
        application,
        message: 'Application submitted successfully',
      }, 201);
    } catch (error: any) {
      console.error('Create application error:', error);
      if (error.code === 11000) {
        errorResponse(res, 'You have already applied to this job', 400);
      } else if (error.name === 'ValidationError') {
        errorResponse(res, error.message, 400);
      } else {
        errorResponse(res, `Failed to create application: ${error.message || 'Unknown error'}`, 500);
      }
    }
  }

  /**
   * Get my applications (Candidate)
   * Protected endpoint - Candidate only
   */
  public static async getMyApplications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application } = await import('../model');
      const userId = req.user?.id;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: any = { user: userId };
      if (status) {
        filter.status = status;
      }

      const applications = await Application.find(filter)
        .populate({
          path: 'post',
          select: 'title description salary typeWork company techStack status createdAt',
          populate: {
            path: 'company',
            select: 'name avatarUrl province district',
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Application.countDocuments(filter);

      successResponse(res, {
        applications,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
        message: 'Applications retrieved successfully',
      });
    } catch (error: any) {
      console.error('Get my applications error:', error);
      errorResponse(res, `Failed to retrieve applications: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get applications for a job (Employer)
   * Protected endpoint - Employer only
   */
  public static async getJobApplications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application, Post, Company } = await import('../model');
      const userId = req.user?.id;
      const { postId } = req.params;
      const { page = 1, limit = 20, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Verify that the post belongs to the user's company
      const company = await Company.findOne({ user: userId });
      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      const post = await Post.findById(postId).populate('company');
      if (!post) {
        errorResponse(res, 'Job post not found', 404);
        return;
      }

      // Check if post belongs to user's company
      const postCompanyId = (post.company as any)?._id?.toString() || (post.company as any)?.toString();
      const companyId = (company._id as any)?.toString() || String(company._id);
      if (postCompanyId !== companyId) {
        errorResponse(res, 'You do not have permission to view applications for this job', 403);
        return;
      }

      const filter: any = { post: postId };
      if (status) {
        filter.status = status;
      }

      const applications = await Application.find(filter)
        .populate({
          path: 'user',
          select: 'fullName email phone avatar',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Application.countDocuments(filter);

      successResponse(res, {
        applications,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
        message: 'Applications retrieved successfully',
      });
    } catch (error: any) {
      console.error('Get job applications error:', error);
      errorResponse(res, `Failed to retrieve applications: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get all applications for employer's jobs
   * Protected endpoint - Employer only
   */
  public static async getMyJobApplications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application, Post, Company } = await import('../model');
      const userId = req.user?.id;
      const { page = 1, limit = 20, status, postId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Find user's company
      const company = await Company.findOne({ user: userId });
      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Find all posts belonging to this company
      const posts = await Post.find({ company: company._id });
      const postIds = posts.map((p) => p._id);

      if (postIds.length === 0) {
        successResponse(res, {
          applications: [],
          pagination: {
            currentPage: Number(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: Number(limit),
          },
          message: 'No applications found',
        });
        return;
      }

      const filter: any = { post: { $in: postIds } };
      if (status) {
        filter.status = status;
      }
      if (postId) {
        filter.post = postId;
      }

      const applications = await Application.find(filter)
        .populate({
          path: 'user',
          select: 'fullName email phone avatar',
        })
        .populate({
          path: 'post',
          select: 'title company',
          populate: {
            path: 'company',
            select: 'name',
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Application.countDocuments(filter);

      successResponse(res, {
        applications,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
        message: 'Applications retrieved successfully',
      });
    } catch (error: any) {
      console.error('Get my job applications error:', error);
      errorResponse(res, `Failed to retrieve applications: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Update application status
   * Protected endpoint - Employer or Admin
   */
  public static async updateApplicationStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application, Post, Company } = await import('../model');
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { applicationId } = req.params;
      const { status, note } = req.body;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!status || !Object.values(APPLICATION_STATUS).includes(status)) {
        errorResponse(res, 'Valid status is required', 400);
        return;
      }

      const application = await Application.findById(applicationId).populate('post');
      if (!application) {
        errorResponse(res, 'Application not found', 404);
        return;
      }

      // Verify permission
      if (userRole === 'employer') {
        const company = await Company.findOne({ user: userId });
        if (!company) {
          errorResponse(res, 'Company not found', 404);
          return;
        }

        const post = application.post as any;
        const postCompanyId = post.company?.toString() || post.company;
        const companyId = (company._id as any)?.toString() || String(company._id);
        if (postCompanyId !== companyId) {
          errorResponse(res, 'You do not have permission to update this application', 403);
          return;
        }
      } else if (userRole !== 'admin') {
        errorResponse(res, 'You do not have permission to update applications', 403);
        return;
      }

      // Update application status
      application.status = status;
      if (note) {
        // Store note in a separate field if needed
        // For now, we'll add it to formData.additionalInfo if it's a form application
        if (application.type === APPLICATION_TYPE.FORM && application.formData) {
          application.formData.additionalInfo = `${application.formData.additionalInfo || ''}\n\n[Note from employer]: ${note}`;
        }
      }
      await application.save();

      // Populate for response
      await application.populate([
        { path: 'user', select: 'fullName email phone avatar' },
        { path: 'post', select: 'title company' },
      ]);

      successResponse(res, {
        application,
        message: 'Application status updated successfully',
      });
    } catch (error: any) {
      console.error('Update application status error:', error);
      errorResponse(res, `Failed to update application status: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get all applications (Admin)
   * Protected endpoint - Admin only
   */
  public static async getAllApplications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application } = await import('../model');
      const { page = 1, limit = 20, status, type, postId, userId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: any = {};
      if (status) {
        filter.status = status;
      }
      if (type) {
        filter.type = type;
      }
      if (postId) {
        filter.post = postId;
      }
      if (userId) {
        filter.user = userId;
      }

      const applications = await Application.find(filter)
        .populate({
          path: 'user',
          select: 'fullName email phone avatar',
        })
        .populate({
          path: 'post',
          select: 'title company',
          populate: {
            path: 'company',
            select: 'name',
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await Application.countDocuments(filter);

      successResponse(res, {
        applications,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
        message: 'Applications retrieved successfully',
      });
    } catch (error: any) {
      console.error('Get all applications error:', error);
      errorResponse(res, `Failed to retrieve applications: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get application statistics
   * Protected endpoint - Employer or Admin
   */
  public static async getApplicationStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { Application, Post, Company } = await import('../model');
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      let filter: any = {};

      if (userRole === 'employer') {
        const company = await Company.findOne({ user: userId });
        if (!company) {
          errorResponse(res, 'Company not found', 404);
          return;
        }

        const posts = await Post.find({ company: company._id });
        const postIds = posts.map((p) => p._id);
        filter.post = { $in: postIds };
      }

      const stats = await Application.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const total = await Application.countDocuments(filter);

      const statsMap: Record<string, number> = {};
      stats.forEach((stat) => {
        statsMap[stat._id] = stat.count;
      });

      successResponse(res, {
        stats: {
          total,
          applied: statsMap[APPLICATION_STATUS.APPLIED] || 0,
          reviewing: statsMap[APPLICATION_STATUS.REVIEWING] || 0,
          shortlisted: statsMap[APPLICATION_STATUS.SHORTLISTED] || 0,
          interviewed: statsMap[APPLICATION_STATUS.INTERVIEWED] || 0,
          hired: statsMap[APPLICATION_STATUS.HIRED] || 0,
          rejected: statsMap[APPLICATION_STATUS.REJECTED] || 0,
          withdrawn: statsMap[APPLICATION_STATUS.WITHDRAWN] || 0,
        },
        message: 'Statistics retrieved successfully',
      });
    } catch (error: any) {
      console.error('Get application stats error:', error);
      errorResponse(res, `Failed to retrieve statistics: ${error.message || 'Unknown error'}`, 500);
    }
  }
}

