import Joi from 'joi';

export const commonValidationSchemas = {
  // ObjectId validation
  objectId: Joi.string().hex().length(24).required(),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  // Email validation
  email: Joi.string().email().required().lowercase().trim(),

  // Password validation
  password: Joi.string().min(6).required(),

  // Name validation
  name: Joi.string().trim().min(1).max(50).required(),

  // Phone validation
  phone: Joi.string().trim().pattern(/^[+]?[1-9][\d]{0,15}$/).optional(),

  // Date validation
  date: Joi.date().max('now').optional(),

  // URL validation
  url: Joi.string().uri().optional(),

  // Skills array validation
  skills: Joi.array().items(Joi.string().trim()).optional(),

  // Address validation
  address: Joi.object({
    street: Joi.string().trim().optional(),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    zipCode: Joi.string().trim().optional(),
    country: Joi.string().trim().optional(),
  }).optional(),

  // Experience validation
  experience: Joi.array().items(Joi.object({
    company: Joi.string().required().trim(),
    position: Joi.string().required().trim(),
    startDate: Joi.date().required(),
    endDate: Joi.date().optional(),
    description: Joi.string().trim().optional(),
  })).optional(),

  // Education validation
  education: Joi.array().items(Joi.object({
    institution: Joi.string().required().trim(),
    degree: Joi.string().required().trim(),
    fieldOfStudy: Joi.string().required().trim(),
    startDate: Joi.date().required(),
    endDate: Joi.date().optional(),
    gpa: Joi.number().min(0).max(4).optional(),
  })).optional(),
};

export const validateObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
