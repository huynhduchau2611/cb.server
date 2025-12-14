import { Request, Response, NextFunction } from 'express';
import { POST_WORK_TYPE_ARRAY } from '../const';

export interface JobCreateValidationRequest extends Request {
  body: {
    title?: string;
    description?: string;
    salary?: number;
    techStack?: string[];
    typeWork?: string;
    candidateCount?: number;
  };
}

/**
 * Middleware to validate job creation request
 */
export const validateJobCreation = (
  req: JobCreateValidationRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { title, description, salary, techStack, typeWork, candidateCount } = req.body;
  const errors: string[] = [];

  // Validate title
  if (!title || typeof title !== 'string') {
    errors.push('Title is required and must be a string');
  } else if (title.trim().length === 0) {
    errors.push('Title cannot be empty');
  } else if (title.length > 100) {
    errors.push('Title cannot exceed 100 characters');
  }

  // Validate description
  if (!description || typeof description !== 'string') {
    errors.push('Description is required and must be a string');
  } else if (description.trim().length === 0) {
    errors.push('Description cannot be empty');
  } else if (description.length < 50) {
    errors.push('Description must be at least 50 characters');
  }

  // Validate salary
  if (salary === undefined || salary === null) {
    errors.push('Salary is required');
  } else if (typeof salary !== 'number' || isNaN(salary)) {
    errors.push('Salary must be a valid number');
  } else if (salary < 0) {
    errors.push('Salary cannot be negative');
  } else if (salary < 1000000) {
    errors.push('Salary must be at least 1,000,000 VND');
  }

  // Validate techStack
  if (!techStack || !Array.isArray(techStack)) {
    errors.push('TechStack is required and must be an array');
  } else if (techStack.length === 0) {
    errors.push('TechStack must contain at least one technology');
  } else if (techStack.length > 20) {
    errors.push('TechStack cannot contain more than 20 technologies');
  } else {
    // Validate each tech in stack
    const invalidTechs = techStack.filter(
      (tech) => typeof tech !== 'string' || tech.trim().length === 0,
    );
    if (invalidTechs.length > 0) {
      errors.push('All technologies in techStack must be non-empty strings');
    }
  }

  // Validate typeWork
  if (!typeWork || typeof typeWork !== 'string') {
    errors.push('TypeWork is required and must be a string');
  } else if (!POST_WORK_TYPE_ARRAY.includes(typeWork as any)) {
    errors.push(
      `TypeWork must be one of: ${POST_WORK_TYPE_ARRAY.join(', ')}`,
    );
  }

  // Validate candidateCount
  if (candidateCount === undefined || candidateCount === null) {
    errors.push('CandidateCount is required');
  } else if (typeof candidateCount !== 'number' || isNaN(candidateCount)) {
    errors.push('CandidateCount must be a valid number');
  } else if (candidateCount < 1) {
    errors.push('CandidateCount must be at least 1');
  } else if (candidateCount > 100) {
    errors.push('CandidateCount cannot exceed 100');
  } else if (!Number.isInteger(candidateCount)) {
    errors.push('CandidateCount must be an integer');
  }

  // If there are validation errors, return 400
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors,
      },
    });
    return;
  }

  // Sanitize data
  if (title) req.body.title = title.trim();
  if (description) req.body.description = description.trim();
  if (techStack) req.body.techStack = techStack.map((tech: string) => tech.trim());

  next();
};

/**
 * Middleware to validate job update request
 */
export const validateJobUpdate = (
  req: JobCreateValidationRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { title, description, salary, techStack, typeWork, candidateCount } = req.body;
  const errors: string[] = [];

  // For updates, all fields are optional, but if provided, they must be valid

  // Validate title if provided
  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push('Title must be a string');
    } else if (title.trim().length === 0) {
      errors.push('Title cannot be empty');
    } else if (title.length > 100) {
      errors.push('Title cannot exceed 100 characters');
    }
  }

  // Validate description if provided
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('Description must be a string');
    } else if (description.trim().length === 0) {
      errors.push('Description cannot be empty');
    } else if (description.length < 50) {
      errors.push('Description must be at least 50 characters');
    }
  }

  // Validate salary if provided
  if (salary !== undefined) {
    if (typeof salary !== 'number' || isNaN(salary)) {
      errors.push('Salary must be a valid number');
    } else if (salary < 0) {
      errors.push('Salary cannot be negative');
    } else if (salary < 1000000) {
      errors.push('Salary must be at least 1,000,000 VND');
    }
  }

  // Validate techStack if provided
  if (techStack !== undefined) {
    if (!Array.isArray(techStack)) {
      errors.push('TechStack must be an array');
    } else if (techStack.length === 0) {
      errors.push('TechStack must contain at least one technology');
    } else if (techStack.length > 20) {
      errors.push('TechStack cannot contain more than 20 technologies');
    } else {
      const invalidTechs = techStack.filter(
        (tech) => typeof tech !== 'string' || tech.trim().length === 0,
      );
      if (invalidTechs.length > 0) {
        errors.push('All technologies in techStack must be non-empty strings');
      }
    }
  }

  // Validate typeWork if provided
  if (typeWork !== undefined) {
    if (typeof typeWork !== 'string') {
      errors.push('TypeWork must be a string');
    } else if (!POST_WORK_TYPE_ARRAY.includes(typeWork as any)) {
      errors.push(
        `TypeWork must be one of: ${POST_WORK_TYPE_ARRAY.join(', ')}`,
      );
    }
  }

  // Validate candidateCount if provided
  if (candidateCount !== undefined) {
    if (typeof candidateCount !== 'number' || isNaN(candidateCount)) {
      errors.push('CandidateCount must be a valid number');
    } else if (candidateCount < 1) {
      errors.push('CandidateCount must be at least 1');
    } else if (candidateCount > 100) {
      errors.push('CandidateCount cannot exceed 100');
    } else if (!Number.isInteger(candidateCount)) {
      errors.push('CandidateCount must be an integer');
    }
  }

  // If there are validation errors, return 400
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors,
      },
    });
    return;
  }

  // Sanitize data
  if (title) req.body.title = title.trim();
  if (description) req.body.description = description.trim();
  if (techStack) req.body.techStack = techStack.map((tech: string) => tech.trim());

  next();
};

