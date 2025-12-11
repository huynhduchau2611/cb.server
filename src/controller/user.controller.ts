import { Request, Response, NextFunction } from 'express';
import User from '../model/User.model';
import bcrypt from 'bcryptjs';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const includeInactive = req.query.includeInactive === 'true';

    const query = includeInactive ? {} : { isActive: true };
    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.password;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'User deactivated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q, skills, location } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = { isActive: true };

    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      query.skills = { $in: skillsArray };
    }

    if (location) {
      query['address.city'] = { $regex: location, $options: 'i' };
    }

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.role;
    delete updateData.isActive;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true },
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const avatarFile = (req as any).file;

    if (!avatarFile) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Avatar file is required',
        },
      });
      return;
    }

    // Import path and fs
    const path = await import('path');
    const fs = await import('fs');

    // Create uploads/avatars directory if it doesn't exist
    const uploadsDir = path.default.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.default.existsSync(uploadsDir)) {
      fs.default.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.default.extname(avatarFile.originalname);
    const fileName = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.default.join(uploadsDir, fileName);

    // Save file
    fs.default.writeFileSync(filePath, avatarFile.buffer);

    // Generate URL
    const avatarUrl = `/uploads/avatars/${fileName}`;

    console.log(`[Upload Avatar] Updating user ${userId} with avatar: ${avatarUrl}`);

    // Update user's avatar in database - explicitly save to ensure it's persisted
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        avatar: avatarUrl,
        updatedAt: new Date(), // Explicitly update timestamp
      },
      { 
        new: true, 
        runValidators: true,
        upsert: false, // Don't create if doesn't exist
      },
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    // Verify avatar was saved by fetching user again
    const verifyUser = await User.findById(userId).select('avatar');
    console.log(`[Upload Avatar] Verified avatar in database: ${verifyUser?.avatar}`);
    console.log(`[Upload Avatar] Successfully updated user ${userId}. Avatar saved: ${user.avatar}`);

    res.json({
      success: true,
      data: {
        user,
        avatarUrl,
        message: 'Avatar uploaded successfully',
      },
    });
  } catch (error) {
    console.error('[Upload Avatar] Error:', error);
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Current password and new password are required',
        },
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Current password is incorrect',
        },
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true },
    );

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Account deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
        },
      });
      return;
    }

    // Prevent admin from locking themselves
    const currentUserId = (req as any).user?.id;
    if (currentUserId && currentUserId.toString() === id) {
      res.status(400).json({
        success: false,
        error: {
          message: 'You cannot lock your own account',
        },
      });
      return;
    }

    // Toggle isActive status
    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        message: user.isActive ? 'User account has been activated' : 'User account has been locked',
      },
    });
  } catch (error) {
    next(error);
  }
};
