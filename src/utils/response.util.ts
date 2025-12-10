import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class ResponseUtil {
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };
    res.status(statusCode).json(response);
  }

  static error(res: Response, message: string, statusCode: number = 400, details?: any): void {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        ...(details && { details }),
      },
    };
    res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    },
    statusCode: number = 200,
  ): void {
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      pagination,
    };
    res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T): void {
    this.success(res, data, 201);
  }

  static notFound(res: Response, message: string = 'Resource not found'): void {
    this.error(res, message, 404);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): void {
    this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): void {
    this.error(res, message, 403);
  }

  static serverError(res: Response, message: string = 'Internal server error'): void {
    this.error(res, message, 500);
  }
}

// Export individual functions for easier use
export const successResponse = <T>(res: Response, data: T, statusCode: number = 200): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
};

export const errorResponse = (res: Response, message: string, statusCode: number = 400, details?: any): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  };
  res.status(statusCode).json(response);
};
