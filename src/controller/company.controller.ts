import { Request, Response } from 'express';
import { Company, User, Post, Blog } from '../model';
import { successResponse, errorResponse } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { USER_ROLES, PARTNER_REQUEST_STATUS } from '../const';

export class CompanyController {
  /**
   * Get all companies with pagination and filtering
   * Public endpoint - no authentication required
   */
  public static async getAllCompanies(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        size,
        typeCompany,
        workingTime,
        province,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build filter object
      const filter: any = {};

      // Add filters
      if (size) {
        filter.size = size;
      }

      if (typeCompany) {
        filter.typeCompany = typeCompany;
      }

      if (workingTime) {
        filter.workingTime = workingTime;
      }

      if (province) {
        filter.province = { $regex: province, $options: 'i' };
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { province: { $regex: search, $options: 'i' } },
          { district: { $regex: search, $options: 'i' } },
        ];
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query with population
      const companies = await Company.find(filter)
        .populate('plan', 'name price type limit feature')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Get total count for pagination
      const total = await Company.countDocuments(filter);

      // Calculate pagination info
      const totalPages = Math.ceil(total / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      successResponse(res, {
        companies,
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
      errorResponse(res, 'Failed to fetch companies', 500);
    }
  }

  /**
   * Get company detail by ID
   * Public endpoint - no authentication required
   */
  public static async getCompanyById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const company = await Company.findById(id)
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      successResponse(res, { company });
    } catch (error) {
      errorResponse(res, 'Failed to fetch company details', 500);
    }
  }

  /**
   * Get company by tax code
   * Public endpoint - no authentication required
   */
  public static async getCompanyByTaxCode(req: Request, res: Response): Promise<void> {
    try {
      const { taxCode } = req.params;

      const company = await Company.findOne({ taxCode })
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      successResponse(res, { company });
    } catch (error) {
      errorResponse(res, 'Failed to fetch company details', 500);
    }
  }

  /**
   * Get companies by location
   * Public endpoint - no authentication required
   */
  public static async getCompaniesByLocation(req: Request, res: Response): Promise<void> {
    try {
      const { province, district } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const filter: any = {};

      if (province) {
        filter.province = { $regex: province, $options: 'i' };
      }

      if (district) {
        filter.district = { $regex: district, $options: 'i' };
      }

      const skip = (Number(page) - 1) * Number(limit);

      const companies = await Company.find(filter)
        .populate('plan', 'name price type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const total = await Company.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      successResponse(res, {
        companies,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      errorResponse(res, 'Failed to fetch companies by location', 500);
    }
  }

  /**
   * Get company statistics
   * Public endpoint - no authentication required
   */
  public static async getCompanyStats(_req: Request, res: Response): Promise<void> {
    try {
      const totalCompanies = await Company.countDocuments();

      const companiesBySize = await Company.aggregate([
        { $group: { _id: '$size', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const companiesByType = await Company.aggregate([
        { $group: { _id: '$typeCompany', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const companiesByLocation = await Company.aggregate([
        { $group: { _id: '$province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      const companiesByPlan = await Company.aggregate([
        {
          $lookup: {
            from: 'plans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planInfo',
          },
        },
        { $unwind: '$planInfo' },
        { $group: { _id: '$planInfo.type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      successResponse(res, {
        totalCompanies,
        companiesBySize,
        companiesByType,
        companiesByLocation,
        companiesByPlan,
      });
    } catch (error) {
      errorResponse(res, 'Failed to fetch company statistics', 500);
    }
  }

  /**
   * Search companies
   * Public endpoint - no authentication required
   */
  public static async searchCompanies(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit = 10 } = req.query;

      if (!q) {
        errorResponse(res, 'Search query is required', 400);
        return;
      }

      const filter = {
        status: 'approved', // Only show approved companies
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { taxCode: { $regex: q, $options: 'i' } },
          { province: { $regex: q, $options: 'i' } },
          { district: { $regex: q, $options: 'i' } },
        ],
      };

      const companies = await Company.find(filter)
        .populate('plan', 'name price type')
        .sort({ name: 1 })
        .limit(Number(limit))
        .lean();

      successResponse(res, { companies });
    } catch (error) {
      errorResponse(res, 'Failed to search companies', 500);
    }
  }

  /**
   * Submit partner request (Create company with pending status)
   * Protected endpoint - requires authentication
   */
  public static async submitPartnerRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Check if user already has a company request
      const existingCompany = await Company.findOne({ user: userId });
      if (existingCompany) {
        errorResponse(res, 'You already have a partner request', 400);
        return;
      }

      // Check if tax code already exists
      const { taxCode } = req.body;
      const existingTaxCode = await Company.findOne({ taxCode });
      if (existingTaxCode) {
        errorResponse(res, 'Company with this tax code already exists', 400);
        return;
      }

      // Create company with pending status
      const companyData = {
        ...req.body,
        user: userId,
        status: 'pending',
      };

      const company = await Company.create(companyData);

      successResponse(res, { 
        company,
        message: 'Partner request submitted successfully. Please wait for admin approval.' 
      }, 201);
    } catch (error: any) {
      console.error('Submit partner request error:', error);
      if (error.name === 'ValidationError') {
        errorResponse(res, error.message, 400);
      } else {
        errorResponse(res, 'Failed to submit partner request', 500);
      }
    }
  }

  /**
   * Get all partner requests (Admin only)
   * Protected endpoint - requires admin role
   */
  public static async getAllPartnerRequests(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filter: any = {};

      if (status) {
        filter.status = status;
      }

      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const skip = (Number(page) - 1) * Number(limit);

      const requests = await Company.find(filter)
        .populate('user', 'fullName email phone')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const total = await Company.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      successResponse(res, {
        requests,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      });
    } catch (error) {
      console.error('Get partner requests error:', error);
      errorResponse(res, 'Failed to fetch partner requests', 500);
    }
  }

  /**
   * Approve partner request (Admin only)
   * Protected endpoint - requires admin role
   * Assigns Free Plan template to the company
   */
  public static async approvePartnerRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { Plan, Transaction } = await import('../model');
      const { PLAN_TYPE } = await import('../const');

      const company = await Company.findById(id);

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      if (company.status !== 'pending') {
        errorResponse(res, 'Only pending requests can be approved', 400);
        return;
      }

      // Find Free Plan template (reference to existing plan in database)
      const freePlanTemplate = await Plan.findOne({
        isTemplate: true,
        type: PLAN_TYPE.FREE,
      });

      if (!freePlanTemplate) {
        errorResponse(res, 'Free Plan template not found in database.', 404);
        return;
      }

      // Create transaction for the free plan assignment
      const transaction = await Transaction.create({
        orderId: `FREE-${Date.now()}-${company._id}`,
        amount: 0,
        status: 'completed',
        description: 'Free Plan - Auto-assigned on approval',
        company: company._id,
        plan: freePlanTemplate._id,
      });

      // Update company status to approved and assign plan (reference to template)
      company.status = 'approved';
      company.plan = freePlanTemplate._id as any;
      await company.save();

      // Update user role to employer
      await User.findByIdAndUpdate(company.user, {
        role: USER_ROLES.EMPLOYER,
      });

      // Populate plan info for response
      const updatedCompany = await Company.findById(company._id)
        .populate('plan')
        .lean();

      successResponse(res, { 
        company: updatedCompany,
        message: 'Partner request approved successfully. Free Plan template has been assigned.' 
      });
    } catch (error: any) {
      console.error('Approve partner request error:', error);
      errorResponse(res, 'Failed to approve partner request', 500);
    }
  }

  /**
   * Reject partner request (Admin only)
   * Protected endpoint - requires admin role
   */
  public static async rejectPartnerRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      const company = await Company.findById(id);

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      if (company.status !== 'pending') {
        errorResponse(res, 'Only pending requests can be rejected', 400);
        return;
      }

      // Update company status to rejected
      company.status = 'rejected';
      if (rejectionReason) {
        company.rejectionReason = rejectionReason;
      }
      await company.save();

      successResponse(res, { 
        company,
        message: 'Partner request rejected' 
      });
    } catch (error) {
      console.error('Reject partner request error:', error);
      errorResponse(res, 'Failed to reject partner request', 500);
    }
  }

  /**
   * Get my company (for authenticated user)
   * Protected endpoint - requires authentication
   */
  public static async getMyCompany(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const company = await Company.findOne({ user: userId })
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      successResponse(res, { company });
    } catch (error) {
      console.error('Get my company error:', error);
      errorResponse(res, 'Failed to fetch company', 500);
    }
  }

  /**
   * Update my company profile (Employer only)
   * Protected endpoint - Employer can only update their own company
   * Cannot update: taxCode, status, user, plan
   */
  public static async updateMyCompany(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Find company owned by this user
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Extract update data, but exclude fields that shouldn't be updated
      const {
        name,
        avatarUrl,
        phone,
        workingTime,
        size,
        typeCompany,
        provinceCode,
        province,
        districtCode,
        district,
        wardCode,
        ward,
        description,
        website,
      } = req.body;

      // Build update object with only allowed fields
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      if (phone !== undefined) updateData.phone = phone;
      if (workingTime !== undefined) updateData.workingTime = workingTime;
      if (size !== undefined) updateData.size = size;
      if (typeCompany !== undefined) updateData.typeCompany = typeCompany;
      if (provinceCode !== undefined) updateData.provinceCode = provinceCode;
      if (province !== undefined) updateData.province = province;
      if (districtCode !== undefined) updateData.districtCode = districtCode;
      if (district !== undefined) updateData.district = district;
      if (wardCode !== undefined) updateData.wardCode = wardCode;
      if (ward !== undefined) updateData.ward = ward;
      if (description !== undefined) updateData.description = description;
      if (website !== undefined) updateData.website = website;

      // Update company
      const updatedCompany = await Company.findByIdAndUpdate(
        company._id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      if (!updatedCompany) {
        errorResponse(res, 'Failed to update company', 500);
        return;
      }

      successResponse(res, {
        company: updatedCompany,
        message: 'Company profile updated successfully',
      });
    } catch (error: any) {
      console.error('Update my company error:', error);
      if (error.name === 'ValidationError') {
        errorResponse(res, error.message, 400);
      } else {
        errorResponse(res, 'Failed to update company profile', 500);
      }
    }
  }

  /**
   * Upload company avatar (Employer only)
   * Protected endpoint - Employer can only upload avatar for their own company
   */
  public static async uploadCompanyAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const avatarFile = (req as any).file;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!avatarFile) {
        errorResponse(res, 'Avatar file is required', 400);
        return;
      }

      // Find company owned by this user
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Import path and fs
      const path = await import('path');
      const fs = await import('fs');

      // Create uploads/companies directory if it doesn't exist
      const uploadsDir = path.default.join(process.cwd(), 'uploads', 'companies');
      if (!fs.default.existsSync(uploadsDir)) {
        fs.default.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExtension = path.default.extname(avatarFile.originalname);
      const fileName = `${company._id}-${Date.now()}${fileExtension}`;
      const filePath = path.default.join(uploadsDir, fileName);

      // Save file
      fs.default.writeFileSync(filePath, avatarFile.buffer);

      // Generate URL
      const avatarUrl = `/uploads/companies/${fileName}`;

      // Update company avatar
      const updatedCompany = await Company.findByIdAndUpdate(
        company._id,
        { avatarUrl },
        { new: true, runValidators: true }
      )
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      if (!updatedCompany) {
        errorResponse(res, 'Failed to update company avatar', 500);
        return;
      }

      successResponse(res, {
        company: updatedCompany,
        avatarUrl,
        message: 'Company avatar uploaded successfully',
      });
    } catch (error: any) {
      console.error('Upload company avatar error:', error);
      errorResponse(res, `Failed to upload avatar: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Update company plan (Admin or Employer)
   * Protected endpoint - Admin can update any company, Employer can update their own company
   * Changes the plan reference for a company (upgrade/downgrade)
   */
  public static async updateCompanyPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params; // Company ID
      const { planType } = req.body; // Plan type: 'free', 'basic', 'expert'
      const { Plan, Transaction } = await import('../model');
      const { PLAN_TYPE, PLAN_TYPE_ARRAY, USER_ROLES } = await import('../const');

      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Find the company
      const company = await Company.findById(id);

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Check permissions: Admin can update any company, Employer can only update their own
      if (userRole !== USER_ROLES.ADMIN && company.user?.toString() !== userId) {
        errorResponse(res, 'You do not have permission to update this company plan', 403);
        return;
      }

      // Validate plan type
      if (!planType || !PLAN_TYPE_ARRAY.includes(planType)) {
        errorResponse(res, `Invalid plan type. Must be one of: ${PLAN_TYPE_ARRAY.join(', ')}`, 400);
        return;
      }

      // Find the plan template by type (reference to existing plan in database)
      const planTemplate = await Plan.findOne({
        isTemplate: true,
        type: planType,
      });

      if (!planTemplate) {
        errorResponse(res, `Plan template '${planType}' not found in database.`, 404);
        return;
      }

      // Don't create transaction if upgrading to free plan (it's free)
      // For paid plans, transaction should be created by payment system
      // For now, we'll create a transaction record for tracking
      let transaction = null;
      if (planType !== PLAN_TYPE.FREE) {
        transaction = await Transaction.create({
          orderId: `PLAN-${Date.now()}-${company._id}`,
          amount: planTemplate.price,
          status: 'completed', // In real app, this should be 'pending' until payment confirmed
          description: `Upgrade to ${planTemplate.name}`,
          company: company._id,
          plan: planTemplate._id,
        });
      } else {
        // For free plan, create a transaction record for tracking
        transaction = await Transaction.create({
          orderId: `FREE-${Date.now()}-${company._id}`,
          amount: 0,
          status: 'completed',
          description: `Downgrade to ${planTemplate.name}`,
          company: company._id,
          plan: planTemplate._id,
        });
      }

      // Update company plan reference (just change the reference, not create new plan)
      company.plan = planTemplate._id as any;
      await company.save();

      // Populate plan info for response
      const updatedCompany = await Company.findById(company._id)
        .populate('plan')
        .lean();

      successResponse(res, {
        company: updatedCompany,
        transaction: transaction,
        message: `Company plan updated to ${planTemplate.name} successfully.`,
      });
    } catch (error) {
      console.error('Update company plan error:', error);
      errorResponse(res, 'Failed to update company plan', 500);
    }
  }

  /**
   * Get all available plan templates
   * Public endpoint - no authentication required
   * Returns plans that exist in the database
   */
  public static async getPlanTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { Plan } = await import('../model');

      // Get all template plans from database
      const templates = await Plan.find({ isTemplate: true })
        .sort({ price: 1 })
        .select('-company -transaction -createdAt -updatedAt')
        .lean();

      if (!templates || templates.length === 0) {
        errorResponse(res, 'No plan templates found in database', 404);
        return;
      }

      successResponse(res, {
        plans: templates,
        message: 'Plan templates retrieved successfully',
      });
    } catch (error: any) {
      errorResponse(res, `Failed to retrieve plan templates: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get employer user from company ID
   * Public endpoint - no authentication required
   */
  public static async getEmployerUser(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;

      const company = await Company.findById(companyId)
        .populate('user', 'fullName email avatar')
        .select('user')
        .lean();

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      if (!company.user) {
        errorResponse(res, 'Employer user not found for this company', 404);
        return;
      }

      successResponse(res, { user: company.user });
    } catch (error: any) {
      console.error('Error getting employer user:', error);
      errorResponse(res, `Failed to get employer user: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Get admin dashboard overview statistics
   * Admin only endpoint
   */
  public static async getAdminOverviewStats(_req: Request, res: Response): Promise<void> {
    try {
      // Get all stats in parallel for better performance
      const [
        totalUsers,
        totalJobs,
        pendingPartners,
        totalBlogs,
        usersByRole,
      ] = await Promise.all([
        // Total users
        User.countDocuments({ isActive: true }),
        // Total jobs (posts)
        Post.countDocuments({ status: 'approved', isHidden: false }),
        // Pending partner requests
        Company.countDocuments({ status: PARTNER_REQUEST_STATUS.PENDING }),
        // Total blogs
        Blog.countDocuments({ status: 'approved' }),
        // Users by role
        User.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
      ]);

      // Format users by role
      const usersByRoleMap: Record<string, number> = {};
      usersByRole.forEach((item: any) => {
        usersByRoleMap[item._id] = item.count;
      });

      successResponse(res, {
        totalUsers,
        totalJobs,
        pendingPartners,
        totalBlogs,
        usersByRole: {
          admin: usersByRoleMap[USER_ROLES.ADMIN] || 0,
          employer: usersByRoleMap[USER_ROLES.EMPLOYER] || 0,
          candidate: usersByRoleMap[USER_ROLES.CANDIDATE] || 0,
        },
      });
    } catch (error: any) {
      console.error('Get admin overview stats error:', error);
      errorResponse(res, `Failed to fetch overview statistics: ${error.message || 'Unknown error'}`, 500);
    }
  }

  /**
   * Toggle company featured status (Admin only)
   * Protected endpoint - Admin can toggle featured status for any company
   */
  public static async toggleCompanyFeatured(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params; // Company ID
      const { isFeatured } = req.body; // Boolean value

      const company = await Company.findById(id);

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Check if trying to set as featured
      const willBeFeatured = isFeatured !== undefined ? isFeatured : !company.isFeatured;
      
      // If trying to set as featured, check if we've reached the limit (6)
      if (willBeFeatured && !company.isFeatured) {
        const featuredCount = await Company.countDocuments({ isFeatured: true, status: 'approved' });
        if (featuredCount >= 6) {
          errorResponse(res, 'Tối đa chỉ có 6 công ty nổi bật', 400);
          return;
        }
      }

      // Update featured status
      company.isFeatured = willBeFeatured;
      await company.save();

      const updatedCompany = await Company.findById(id)
        .populate('plan', 'name price type limit feature durationInDays')
        .lean();

      successResponse(res, {
        company: updatedCompany,
        message: `Company ${company.isFeatured ? 'đã được' : 'đã bỏ'} đánh dấu nổi bật`,
      });
    } catch (error: any) {
      console.error('Toggle company featured error:', error);
      errorResponse(res, 'Failed to toggle company featured status', 500);
    }
  }

  /**
   * Get featured companies (Public)
   * Public endpoint - no authentication required
   */
  public static async getFeaturedCompanies(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 6 } = req.query;
      const Post = (await import('../model/Job.model')).default;
      const POST_STATUS = (await import('../const')).POST_STATUS;

      const companies = await Company.find({
        status: 'approved',
        isFeatured: true,
      })
        .populate('plan', 'name price type')
        .select('name avatarUrl size typeCompany province district description website _id')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .lean();

      // Get job counts for each company
      const companiesWithJobCounts = await Promise.all(
        companies.map(async (company) => {
          const jobCount = await Post.countDocuments({
            company: company._id,
            status: POST_STATUS.APPROVED,
            isHidden: false,
          });
          return {
            ...company,
            jobCount,
          };
        })
      );

      successResponse(res, { companies: companiesWithJobCounts });
    } catch (error: any) {
      console.error('Get featured companies error:', error);
      errorResponse(res, 'Failed to fetch featured companies', 500);
    }
  }

}
