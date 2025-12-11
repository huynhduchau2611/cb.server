import { Request, Response } from 'express';
import { Post } from '@/model';
import { successResponse, errorResponse } from '@/utils/response.util';
import { POST_STATUS } from '@/const';
import mongoose from 'mongoose';

export class PostController {
  /**
   * Get all posts with pagination and filtering
   * Public endpoint - no authentication required
   */
  public static async getAllPosts(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'approved',
        typeWork,
        techStack,
        minSalary,
        maxSalary,
        companyId,
        search,
        location,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;


      // Build filter object
      const filter: any = {};
      filter.isHidden = false;

      // Only show approved posts for public (exclude expired posts)
      // Note: Cronjob updates expired posts status to EXPIRED, but we also filter by expiration
      // as an additional safety layer in case cronjob hasn't run yet
      if (status === 'approved') {
        filter.status = POST_STATUS.APPROVED; // Only show APPROVED posts (cronjob updates expired to EXPIRED)
      }

      // Add other filters
      if (typeWork) {
        filter.typeWork = typeWork;
      }

      if (techStack) {
        filter.techStack = { $in: Array.isArray(techStack) ? techStack : [techStack] };
      }

      if (minSalary || maxSalary) {
        filter.salary = {};
        if (minSalary) {
          filter.salary.$gte = Number(minSalary);
        }
        if (maxSalary) {
          filter.salary.$lte = Number(maxSalary);
        }
      }

      if (companyId) {
        filter.company = companyId;
      }

      // Note: search and location filters are handled in aggregation pipeline

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Use aggregation pipeline to search in company name and handle location filter
      const pipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'companies',
            localField: 'company',
            foreignField: '_id',
            as: 'companyInfo',
          },
        },
        { $unwind: '$companyInfo' },
        // Only show posts from approved companies
        {
          $match: {
            'companyInfo.status': 'approved',
          },
        },
        // Join with plan to get postDuration
        {
          $lookup: {
            from: 'plans',
            localField: 'companyInfo.plan',
            foreignField: '_id',
            as: 'planInfo',
          },
        },
        // Filter out expired posts (only for approved posts shown to public)
        // A post is expired if createdAt < (now - postDuration days)
        ...(status === 'approved' ? [{
          $addFields: {
            planDuration: { $ifNull: [{ $arrayElemAt: ['$planInfo.limit.postDuration', 0] }, 999999] },
            isExpired: {
              $lt: [
                '$createdAt',
                {
                  $subtract: [
                    new Date(),
                    {
                      $multiply: [
                        { $ifNull: [{ $arrayElemAt: ['$planInfo.limit.postDuration', 0] }, 999999] },
                        24 * 60 * 60 * 1000 // Convert days to milliseconds
                      ]
                    }
                  ]
                }
              ]
            }
          }
        }, {
          $match: {
            isExpired: false
          }
        }] : []),
      ];

      // Add search filter if search query exists
      if (search) {
        const searchString = Array.isArray(search) ? search[0] : search;
        const searchRegex = typeof searchString === 'string' ? searchString : String(searchString);
        
        // Normalize search term: remove dots and convert to lowercase for comparison
        const normalizedSearch = searchRegex.replace(/\./g, '').toLowerCase();
        
        // Split search terms for better matching
        const searchTerms = searchRegex.split(/\s+/).filter(term => term.length > 0);
        
        // Create search conditions for text fields (title, description, company name)
        // These use case-insensitive regex
        const searchConditions: any[] = [
          { title: { $regex: searchRegex, $options: 'i' } },
          { description: { $regex: searchRegex, $options: 'i' } },
          { 'companyInfo.name': { $regex: searchRegex, $options: 'i' } },
        ];
        
        // Add individual term matching for better results
        searchTerms.forEach(term => {
          searchConditions.push(
            { title: { $regex: term, $options: 'i' } },
            { description: { $regex: term, $options: 'i' } },
            { 'companyInfo.name': { $regex: term, $options: 'i' } }
          );
        });
        
        // For techStack array: search by normalizing both search term and array elements
        // Remove dots from search term and match case-insensitively
        const techStackSearchPattern = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
        
        // Use $expr with $anyElementTrue and $regexMatch to search in array
        // This will match any element in techStack array after removing dots
          searchConditions.push({
          $expr: {
            $anyElementTrue: {
              $map: {
                input: '$techStack',
                as: 'tech',
                in: {
                  $regexMatch: {
                    input: { $toLower: { $replaceAll: { input: '$$tech', find: '.', replacement: '' } } },
                    regex: techStackSearchPattern,
                    options: 'i'
                  }
                }
              }
            }
          }
        });
        
        // Also add individual term search for techStack
        searchTerms.forEach(term => {
          const normalizedTerm = term.replace(/\./g, '').toLowerCase();
          const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
            searchConditions.push({
            $expr: {
              $anyElementTrue: {
                $map: {
                  input: '$techStack',
                  as: 'tech',
                  in: {
                    $regexMatch: {
                      input: { $toLower: { $replaceAll: { input: '$$tech', find: '.', replacement: '' } } },
                      regex: escapedTerm,
                      options: 'i'
                    }
                  }
                }
              }
            }
          });
        });
        
        pipeline.push({
          $match: {
            $or: searchConditions,
          },
        });
      }

      // Add location filter if location query exists
      if (location) {
        const locationString = Array.isArray(location) ? location[0] : location;
        let locationRegex = typeof locationString === 'string' ? locationString : String(locationString);
        
        // Normalize location name for better matching
        // Remove "Thành phố" prefix if present for matching
        const normalizedLocation = locationRegex.replace(/^Thành phố\s+/i, '').trim();
        
        // Try matching with both full name and normalized name
        pipeline.push({
          $match: {
            $or: [
              { 'companyInfo.province': { $regex: locationRegex, $options: 'i' } },
              { 'companyInfo.province': { $regex: normalizedLocation, $options: 'i' } },
            ],
          },
        });
      }

      // Add projection to match the expected format
      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          salary: 1,
          techStack: 1,
          typeWork: 1,
          candidateCount: 1,
          candidateApplied: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          company: {
            _id: '$companyInfo._id',
            name: '$companyInfo.name',
            avatarUrl: '$companyInfo.avatarUrl',
            size: '$companyInfo.size',
            typeCompany: '$companyInfo.typeCompany',
            province: '$companyInfo.province',
            district: '$companyInfo.district',
            ward: '$companyInfo.ward',
            workingTime: '$companyInfo.workingTime',
            taxCode: '$companyInfo.taxCode',
          },
        },
      });

      // Add sort
      pipeline.push({ $sort: sort });

      // Add pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });

      // Execute aggregation
      const posts = await Post.aggregate(pipeline);

      // Get total count for pagination (simplified version)
      const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
      countPipeline.push({ $count: 'total' });
      const countResult = await Post.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;

      // Calculate pagination info
      const totalPages = Math.ceil(total / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      const response = {
        posts,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage,
          hasPrevPage,
        },
      };

      successResponse(res, response);
    } catch (error) {
      errorResponse(res, 'Failed to fetch posts', 500);
    }
  }

  /**
   * Get post detail by ID
   * Public endpoint - no authentication required
   */
  public static async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await Post.findById(id)
        .populate({
          path: 'company',
          select: 'name avatarUrl size typeCompany province district ward workingTime taxCode user',
          populate: {
            path: 'user',
            select: 'fullName email avatar',
          },
        })
        .lean();

      if (!post) {
        errorResponse(res, 'Post not found', 404);
        return;
      }

      if (post.isHidden) {
        errorResponse(res, 'Post not available', 404);
        return;
      }

      // Only show approved posts for public
      if (post.status !== POST_STATUS.APPROVED) {
        errorResponse(res, 'Post not available', 404);
        return;
      }

      successResponse(res, { post });
    } catch (error) {
      errorResponse(res, 'Failed to fetch post details', 500);
    }
  }

  /**
   * Get posts by company ID
   * Public endpoint - no authentication required
   */
  public static async getPostsByCompany(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const filter = {
        company: companyId,
        status: POST_STATUS.APPROVED,
        isHidden: false,
      };

      const skip = (Number(page) - 1) * Number(limit);

      const posts = await Post.find(filter)
        .populate('company', 'name avatarUrl size typeCompany')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const total = await Post.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      successResponse(res, {
        posts,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      errorResponse(res, 'Failed to fetch company posts', 500);
    }
  }

  /**
   * Get featured posts (posts with highlight badge)
   * Public endpoint - no authentication required
   */
  public static async getFeaturedPosts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 5 } = req.query;

      const posts = await Post.find({
        status: POST_STATUS.APPROVED,
        isHidden: false,
        isFeatured: true,
      })
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .lean();

      successResponse(res, { posts });
    } catch (error) {
      errorResponse(res, 'Failed to fetch featured posts', 500);
    }
  }

  /**
   * Get job statistics
   * Public endpoint - no authentication required
   */
  public static async getJobStats(_req: Request, res: Response): Promise<void> {
    try {
      const { Company, User } = await import('../model');
      const { USER_ROLES } = await import('../const');

      // Get all stats in parallel for better performance
      const [
        totalJobs,
        jobsByType,
        jobsByLocation,
        avgSalary,
        totalCompanies,
        totalCandidates,
      ] = await Promise.all([
        // Total approved jobs
        Post.countDocuments({ status: POST_STATUS.APPROVED }),
        // Jobs by type
        Post.aggregate([
        { $match: { status: POST_STATUS.APPROVED } },
        { $group: { _id: '$typeWork', count: { $sum: 1 } } },
        ]),
        // Jobs by location
        Post.aggregate([
        { $match: { status: POST_STATUS.APPROVED } },
        {
          $lookup: {
            from: 'companies',
            localField: 'company',
            foreignField: '_id',
            as: 'companyInfo',
          },
        },
        { $unwind: '$companyInfo' },
        { $group: { _id: '$companyInfo.province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        ]),
        // Average salary
        Post.aggregate([
        { $match: { status: POST_STATUS.APPROVED } },
        { $group: { _id: null, avgSalary: { $avg: '$salary' } } },
        ]),
        // Total approved companies
        Company.countDocuments({ status: 'approved' }),
        // Total candidate users
        User.countDocuments({ role: USER_ROLES.CANDIDATE, isActive: true }),
      ]);

      successResponse(res, {
        totalJobs,
        jobsByType,
        jobsByLocation,
        averageSalary: avgSalary[0]?.avgSalary || 0,
        totalCompanies,
        totalCandidates,
      });
    } catch (error) {
      errorResponse(res, 'Failed to fetch job statistics', 500);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================
  
  /**
   * Get all jobs for admin (with all statuses)
   * Admin only endpoint
   */
  public static async getAllJobsForAdmin(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        companyId,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build filter object
      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      if (companyId) {
        filter.company = companyId;
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Only show jobs from companies with basic or expert plan
      const { Company, Plan } = await import('../model');
      const { PLAN_TYPE } = await import('../const');
      
      // Find companies with basic or expert plan
      const companiesWithPaidPlans = await Company.find({
        plan: { $exists: true, $ne: null }
      }).select('_id plan').lean();
      
      if (companiesWithPaidPlans.length === 0) {
        // If no companies with plans, return empty result
        successResponse(res, {
          posts: [],
          pagination: {
            currentPage: Number(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: Number(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
        return;
      }
      
      // Get plan types for these companies
      const planIds = companiesWithPaidPlans.map(c => c.plan).filter(Boolean) as mongoose.Types.ObjectId[];
      const plans = await Plan.find({
        _id: { $in: planIds }
      }).select('type').lean();
      
      const paidPlanTypes = [PLAN_TYPE.BASIC, PLAN_TYPE.EXPERT];
      const validCompanyIds: mongoose.Types.ObjectId[] = [];
      
      for (const company of companiesWithPaidPlans) {
        if (company.plan) {
          const plan = plans.find(p => p._id.toString() === company.plan?.toString());
          if (plan && paidPlanTypes.includes(plan.type as any)) {
            validCompanyIds.push(company._id as mongoose.Types.ObjectId);
          }
        }
      }
      
      // Filter jobs by company plan
      if (validCompanyIds.length > 0) {
        filter.company = { $in: validCompanyIds };
      } else {
        // If no companies with paid plans, return empty result
        successResponse(res, {
          posts: [],
          pagination: {
            currentPage: Number(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: Number(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
        return;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query with population
      const posts = await Post.find(filter)
        .populate({
          path: 'company',
          select: 'name avatarUrl size typeCompany province district ward taxCode plan',
          populate: {
            path: 'plan',
            select: 'type name'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Get total count for pagination
      const total = await Post.countDocuments(filter);

      // Calculate pagination info
      const totalPages = Math.ceil(total / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      successResponse(res, {
        posts,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (error) {
      console.error('Admin get all jobs error:', error);
      errorResponse(res, 'Failed to fetch jobs', 500);
    }
  }

  /**
   * Approve job post (Admin only)
   */
  public static async approveJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);

      if (!post) {
        errorResponse(res, 'Job post not found', 404);
        return;
      }

      if (post.status !== POST_STATUS.PENDING) {
        errorResponse(res, 'Only pending jobs can be approved', 400);
        return;
      }

      // Update status to approved
      post.status = POST_STATUS.APPROVED;
      await post.save();

      // Populate company info for response
      const updatedPost = await Post.findById(post._id)
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .lean();

      successResponse(res, {
        post: updatedPost,
        message: 'Job post approved successfully',
      });
    } catch (error) {
      console.error('Approve job error:', error);
      errorResponse(res, 'Failed to approve job post', 500);
    }
  }

  /**
   * Reject job post (Admin only)
   */
  public static async rejectJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      const post = await Post.findById(id);

      if (!post) {
        errorResponse(res, 'Job post not found', 404);
        return;
      }

      if (post.status !== POST_STATUS.PENDING) {
        errorResponse(res, 'Only pending jobs can be rejected', 400);
        return;
      }

      // Update status to rejected
      post.status = POST_STATUS.REJECTED;
      await post.save();

      // Populate company info for response
      const updatedPost = await Post.findById(post._id)
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .lean();

      successResponse(res, {
        post: updatedPost,
        message: rejectionReason ? `Job post rejected: ${rejectionReason}` : 'Job post rejected',
      });
    } catch (error) {
      console.error('Reject job error:', error);
      errorResponse(res, 'Failed to reject job post', 500);
    }
  }

  /**
   * Toggle featured status for a job (Admin only)
   */
  public static async toggleFeatured(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);

      if (!post) {
        errorResponse(res, 'Job post not found', 404);
        return;
      }

      // Check if trying to set as featured
      const willBeFeatured = !post.isFeatured;
      
      // If trying to set as featured, check if we've reached the limit (6)
      if (willBeFeatured) {
        const featuredCount = await Post.countDocuments({ isFeatured: true, status: 'approved' });
        if (featuredCount >= 6) {
          errorResponse(res, 'Tối đa chỉ có 6 việc làm nổi bật', 400);
          return;
        }
      }

      // Toggle featured status
      post.isFeatured = willBeFeatured;
      await post.save();

      // Populate company info for response
      const updatedPost = await Post.findById(post._id)
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .lean();

      successResponse(res, {
        post: updatedPost,
        message: post.isFeatured ? 'Job post featured successfully' : 'Job post unfeatured successfully',
      });
    } catch (error) {
      console.error('Toggle featured error:', error);
      errorResponse(res, 'Failed to toggle featured status', 500);
    }
  }

  /**
   * Get job statistics for admin
   */
  public static async getAdminJobStats(_req: Request, res: Response): Promise<void> {
    try {
      const totalJobs = await Post.countDocuments();
      const pendingJobs = await Post.countDocuments({ status: POST_STATUS.PENDING });
      const approvedJobs = await Post.countDocuments({ status: POST_STATUS.APPROVED });
      const rejectedJobs = await Post.countDocuments({ status: POST_STATUS.REJECTED });

      const jobsByCompany = await Post.aggregate([
        {
          $lookup: {
            from: 'companies',
            localField: 'company',
            foreignField: '_id',
            as: 'companyInfo',
          },
        },
        { $unwind: '$companyInfo' },
        {
          $group: {
            _id: '$company',
            companyName: { $first: '$companyInfo.name' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      successResponse(res, {
        totalJobs,
        pendingJobs,
        approvedJobs,
        rejectedJobs,
        jobsByCompany,
      });
    } catch (error) {
      console.error('Get admin job stats error:', error);
      errorResponse(res, 'Failed to fetch job statistics', 500);
    }
  }

  /**
   * Get search suggestions
   * Public endpoint - no authentication required
   */
  public static async getSearchSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || typeof query !== 'string') {
        successResponse(res, { suggestions: [] });
        return;
      }

      const searchRegex = new RegExp(query, 'i');

      // Get job title suggestions (chỉ tìm theo title và techStack)
      const jobSuggestions = await Post.aggregate([
        { $match: { status: POST_STATUS.APPROVED, isHidden: false } },
        {
          $lookup: {
            from: 'companies',
            localField: 'company',
            foreignField: '_id',
            as: 'companyInfo',
          },
        },
        { $unwind: '$companyInfo' },
        {
          $match: {
            $or: [
              { title: searchRegex },
              { techStack: { $in: [searchRegex] } },
            ],
          },
        },
        {
          $project: {
            title: 1,
            companyName: '$companyInfo.name',
            techStack: 1,
            type: { $literal: 'job' },
          },
        },
        { $limit: parseInt(limit as string) },
      ]);

      // Bỏ company suggestions vì không cần thiết

      // Get tech stack suggestions
      const techSuggestions = await Post.aggregate([
        { $match: { status: POST_STATUS.APPROVED, isHidden: false } },
        { $unwind: '$techStack' },
        {
          $match: {
            techStack: searchRegex,
          },
        },
        {
          $group: {
            _id: '$techStack',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            title: '$_id',
            count: 1,
            type: { $literal: 'skill' },
          },
        },
        { $limit: 5 },
      ]);

      // Bỏ location suggestions vì đã có LocationFilter riêng

      const suggestions = [
        ...jobSuggestions.map(job => ({
          type: 'job',
          title: job.title,
          subtitle: job.companyName,
          value: job.title,
        })),
        ...techSuggestions.map(tech => ({
          type: 'skill',
          title: tech.title,
          subtitle: 'Kỹ năng',
          value: tech.title,
          count: tech.count,
        })),
      ];

      successResponse(res, { suggestions: suggestions.slice(0, parseInt(limit as string)) });
    } catch (error) {
      errorResponse(res, 'Failed to fetch search suggestions', 500);
    }
  }

  /**
   * Create a new job post
   * Protected endpoint - Employer only
   * Checks job limit based on company's plan
   */
  public static async createJob(req: any, res: Response): Promise<void> {
    try {
      const { title, description, salary, techStack, typeWork, candidateCount } = req.body;
      const userId = req.user?.id;

      // Validate required fields
      if (!title || !description || !salary || !techStack || !typeWork || !candidateCount) {
        errorResponse(res, 'All fields are required', 400);
        return;
      }

      // Check for fraud/scam content
      const { checkJobPostingForFraud } = await import('@/utils/fraud-detection.util');
      const fraudCheck = checkJobPostingForFraud({
        title,
        description,
        techStack,
      });

      if (fraudCheck.isFraud) {
        errorResponse(
          res,
          `Nội dung đăng tin có dấu hiệu lừa đảo. Vui lòng kiểm tra lại các từ khóa: ${fraudCheck.allMatchedKeywords.join(', ')}`,
          400
        );
        return;
      }

      // Find the company associated with the user
      const { Company, Plan } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found. Please create a company profile first.', 404);
        return;
      }

      // Check if company is approved
      if (company.status !== 'approved') {
        errorResponse(res, 'Your company profile must be approved before posting jobs.', 403);
        return;
      }

      // Check if company has a plan
      if (!company.plan) {
        errorResponse(res, 'No active subscription plan found. Please subscribe to a plan to post jobs.', 403);
        return;
      }

      // Get the plan details
      const plan = await Plan.findById(company.plan);
      
      if (!plan) {
        errorResponse(res, 'Invalid subscription plan. Please contact support.', 404);
        return;
      }

      // Count current active posts for this company (excluding expired posts)
      // Active posts = PENDING or APPROVED posts that haven't expired yet
      const now = new Date();
      const expirationDate = new Date(now.getTime() - plan.limit.postDuration * 24 * 60 * 60 * 1000);
      
      const currentPostCount = await Post.countDocuments({
        company: company._id,
        status: { $in: [POST_STATUS.PENDING, POST_STATUS.APPROVED] },
        createdAt: { $gte: expirationDate }, // Only count posts created within postDuration days
      });

      // Check if the company has reached the job posting limit
      if (currentPostCount >= plan.limit.limitPost) {
        errorResponse(
          res,
          `Job posting limit reached. Your current plan (${plan.name}) allows ${plan.limit.limitPost} active job posts. Please upgrade your plan to post more jobs.`,
          403,
          {
            currentPosts: currentPostCount,
            maxPosts: plan.limit.limitPost,
            planName: plan.name,
          }
        );
        return;
      }

      // Create the new job post
      const newPost = await Post.create({
        title,
        description,
        salary: Number(salary),
        techStack: Array.isArray(techStack) ? techStack : [techStack],
        typeWork,
        candidateCount: Number(candidateCount),
        candidateApplied: 0,
        status: POST_STATUS.PENDING,
        company: company._id,
      });

      // Populate company information in the response
      const populatedPost = await Post.findById(newPost._id)
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .lean();

      successResponse(
        res,
        {
          post: populatedPost,
          message: 'Job post created successfully and is pending approval.',
          remainingPosts: plan.limit.limitPost - currentPostCount - 1,
        },
        201
      );
    } catch (error: any) {
      console.error('Error creating job post:', error);
      errorResponse(res, 'Failed to create job post', 500, error.message);
    }
  }

  /**
   * Get all jobs posted by the employer's company
   * Protected endpoint - Employer only
   */
  public static async getMyJobs(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10, status } = req.query;

      // Find the company associated with the user
      const { Company } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Build filter
      const filter: any = { company: company._id };
      if (status) {
        filter.status = status;
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Get posts
      const posts = await Post.find(filter)
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Get total count
      const total = await Post.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      successResponse(res, {
        posts,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
        },
      });
    } catch (error) {
      console.error('Error fetching my jobs:', error);
      errorResponse(res, 'Failed to fetch jobs', 500);
    }
  }

  /**
   * Update a job post
   * Protected endpoint - Employer only
   */
  public static async updateJob(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;

      // Find the company associated with the user
      const { Company } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Find the post
      const post = await Post.findOne({ _id: id, company: company._id });

      if (!post) {
        errorResponse(res, 'Job post not found or you do not have permission to update it', 404);
        return;
      }

      // Update the post
      const allowedUpdates = ['title', 'description', 'salary', 'techStack', 'typeWork', 'candidateCount'];
      const updates: any = {};
      
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      });

      // Check for fraud/scam content if updating title, description, or techStack
      if (updates.title || updates.description || updates.techStack) {
        const { checkJobPostingForFraud } = await import('@/utils/fraud-detection.util');
        const fraudCheck = checkJobPostingForFraud({
          title: updates.title || post.title,
          description: updates.description || post.description,
          techStack: updates.techStack || post.techStack,
        });

        if (fraudCheck.isFraud) {
          errorResponse(
            res,
            `Nội dung đăng tin có dấu hiệu lừa đảo. Vui lòng kiểm tra lại các từ khóa: ${fraudCheck.allMatchedKeywords.join(', ')}`,
            400
          );
          return;
        }
      }

      // If updating, set status back to pending for admin review
      if (Object.keys(updates).length > 0) {
        updates.status = POST_STATUS.PENDING;
      }

      const updatedPost = await Post.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
        .populate('company', 'name avatarUrl size typeCompany province district ward')
        .lean();

      successResponse(res, {
        post: updatedPost,
        message: 'Job post updated successfully. It is now pending approval.',
      });
    } catch (error) {
      console.error('Error updating job post:', error);
      errorResponse(res, 'Failed to update job post', 500);
    }
  }

  /**
   * Update job visibility (hide/show)
   * Protected endpoint - Employer only
   */
  public static async updateJobVisibility(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isHidden } = req.body;
      const userId = req.user?.id;

      if (typeof isHidden !== 'boolean') {
        errorResponse(res, 'isHidden must be a boolean value', 400);
        return;
      }

      const { Company } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      const post = await Post.findOne({ _id: id, company: company._id });

      if (!post) {
        errorResponse(res, 'Job post not found or you do not have permission to update it', 404);
        return;
      }

      if (post.status === POST_STATUS.EXPIRED) {
        errorResponse(res, 'This job post has already expired and cannot be modified', 400);
        return;
      }

      if (post.status !== POST_STATUS.APPROVED) {
        errorResponse(res, 'Only approved job posts can be hidden or shown', 400);
        return;
      }

      post.isHidden = isHidden;
      post.hiddenAt = isHidden ? new Date() : null;
      await post.save();

      const updatedPost = await post.populate('company', 'name avatarUrl size typeCompany province district ward');

      successResponse(res, {
        post: updatedPost,
        message: isHidden ? 'Job post has been hidden successfully.' : 'Job post is now visible to candidates.',
      });
    } catch (error: any) {
      console.error('Error updating job visibility:', error);
      errorResponse(res, 'Failed to update job visibility', 500, error.message);
    }
  }

  /**
   * Delete a job post
   * Protected endpoint - Employer only
   */
  public static async deleteJob(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Find the company associated with the user
      const { Company } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Find and delete the post
      const post = await Post.findOneAndDelete({ _id: id, company: company._id });

      if (!post) {
        errorResponse(res, 'Job post not found or you do not have permission to delete it', 404);
        return;
      }

      successResponse(res, {
        message: 'Job post deleted successfully',
        deletedPost: {
          id: post._id,
          title: post.title,
        },
      });
    } catch (error) {
      console.error('Error deleting job post:', error);
      errorResponse(res, 'Failed to delete job post', 500);
    }
  }

  /**
   * Get job detail by ID (for employer - can see any status)
   * Protected endpoint - Employer only
   */
  public static async getMyJobById(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Find the company associated with the user
      const { Company } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Find the post and verify ownership
      const post = await Post.findOne({ _id: id, company: company._id })
        .populate('company', 'name avatarUrl size typeCompany province district ward workingTime taxCode')
        .lean();

      if (!post) {
        errorResponse(res, 'Job post not found or you do not have permission to view it', 404);
        return;
      }

      successResponse(res, { post });
    } catch (error) {
      console.error('Error fetching my job:', error);
      errorResponse(res, 'Failed to fetch job details', 500);
    }
  }

  /**
   * Get job posting statistics for employer
   * Protected endpoint - Employer only
   */
  public static async getMyJobStats(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      // Find the company associated with the user
      const { Company, Plan } = await import('@/model');
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Get plan details
      let planInfo = null;
      if (company.plan) {
        const plan = await Plan.findById(company.plan);
        if (plan) {
          planInfo = {
            name: plan.name,
            maxPosts: plan.limit.limitPost,
            postDuration: plan.limit.postDuration,
          };
        }
      }

      // Get post statistics
      const totalPosts = await Post.countDocuments({ company: company._id });
      
      // Calculate active posts (excluding expired ones)
      const now = new Date();
      const expirationDate = planInfo 
        ? new Date(now.getTime() - planInfo.postDuration * 24 * 60 * 60 * 1000)
        : new Date(0); // If no plan, count all posts
      
      const activePosts = await Post.countDocuments({
        company: company._id,
        status: { $in: [POST_STATUS.PENDING, POST_STATUS.APPROVED] },
        createdAt: planInfo ? { $gte: expirationDate } : undefined, // Only count non-expired posts if plan exists
      });
      
      const approvedPosts = await Post.countDocuments({
        company: company._id,
        status: POST_STATUS.APPROVED,
        createdAt: planInfo ? { $gte: expirationDate } : undefined,
      });
      
      const pendingPosts = await Post.countDocuments({
        company: company._id,
        status: POST_STATUS.PENDING,
      });
      
      const rejectedPosts = await Post.countDocuments({
        company: company._id,
        status: POST_STATUS.REJECTED,
      });

      successResponse(res, {
        stats: {
          totalPosts,
          activePosts,
          approvedPosts,
          pendingPosts,
          rejectedPosts,
          remainingPosts: planInfo ? planInfo.maxPosts - activePosts : 0,
        },
        plan: planInfo,
      });
    } catch (error) {
      console.error('Error fetching job stats:', error);
      errorResponse(res, 'Failed to fetch job statistics', 500);
    }
  }

  /**
   * Update expired posts status from APPROVED to EXPIRED
   * Public endpoint - can be called manually or by external scheduler/cron service
   * Note: This also runs automatically every hour via scheduled job
   */
  public static async updateExpiredPosts(_req: Request, res: Response): Promise<void> {
    try {
      const { updateExpiredPosts } = await import('../utils/expired-posts-scheduler');
      const result = await updateExpiredPosts();

      successResponse(res, {
        expiredCount: result.expiredCount,
        totalChecked: result.totalChecked,
        message: `Updated ${result.expiredCount} expired post(s) status to EXPIRED`,
      });
    } catch (error) {
      console.error('Update expired posts error:', error);
      errorResponse(res, 'Failed to update expired posts', 500);
    }
  }

}
