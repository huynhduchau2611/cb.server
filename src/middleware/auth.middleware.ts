import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Access token is required',
      },
    });
    return;
  }

  jwt.verify(token, config.jwt.secret, (err: any, user: any) => {
    if (err) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
        },
      });
      return;
    }

    req.user = user;
    next();
  });
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      const roleNames: Record<string, string> = {
        employer: 'nhà tuyển dụng',
        admin: 'quản trị viên',
        candidate: 'ứng viên',
      };
      const requiredRoleName = roleNames[roles[0]] || roles[0];
      res.status(403).json({
        success: false,
        error: {
          message: `Chức năng này chỉ dành cho ${requiredRoleName}. Vui lòng đăng ký trở thành đối tác nếu bạn muốn sử dụng dịch vụ này.`,
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRole: roles[0],
          currentRole: req.user.role,
        },
      });
      return;
    }

    next();
  };
};
