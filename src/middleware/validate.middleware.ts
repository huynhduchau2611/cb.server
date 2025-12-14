import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('=== VALIDATION MIDDLEWARE ===');
    console.log('Validating request body:', req.body);
    console.log('Schema being used:', schema.describe());
    
    const { error } = schema.validate(req.body);

    if (error) {
      console.log('Validation failed:', error.details);
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation Error',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        },
      });
      return;
    }

    console.log('Validation passed successfully');
    console.log('=== VALIDATION MIDDLEWARE END ===');
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Query Validation Error',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        },
      });
      return;
    }

    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Parameter Validation Error',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        },
      });
      return;
    }

    next();
  };
};
