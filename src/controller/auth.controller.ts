import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '@/model/User.model';
import { config } from '@/config';
import { successResponse, errorResponse } from '@/utils/response.util';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fullName, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errorResponse(res, 'User already exists with this email', 400);
      return;
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      password,
      role: role || 'candidate',
    });

    await user.save();

    // Generate JWT token
    const signOptions = {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions;
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret as string,
      signOptions,
    );

    const responseData = {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
      },
      token,
    };
    
    successResponse(res, responseData, 201);
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      errorResponse(res, 'Account is deactivated', 401);
      return;
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Generate JWT token
    const signOptions = {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions;
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret as string,
      signOptions,
    );

    successResponse(res, {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    // Get latest user data from database
    const user = await User.findById(userId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    if (!user.isActive) {
      errorResponse(res, 'Account is deactivated', 401);
      return;
    }

    // Generate new JWT token with updated role
    const signOptions = {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions;
    const newToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role, // This will be the updated role from database
      },
      config.jwt.secret as string,
      signOptions,
    );

    successResponse(res, {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
      },
      token: newToken,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user.id;

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
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};
