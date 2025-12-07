// User Enums
export const USER_ROLES = {
    ADMIN: 'admin',
    EMPLOYER: 'employer',
    CANDIDATE: 'candidate',
  } as const;
  
  export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
  
  // Post Enums
  export const POST_WORK_TYPES = {
    FULL_TIME: 'full-time',
    PART_TIME: 'part-time',
    CONTRACT: 'contract',
    INTERNSHIP: 'internship',
    REMOTE: 'remote',
    HYBRID: 'hybrid',
  } as const;
  
  export type PostWorkType = typeof POST_WORK_TYPES[keyof typeof POST_WORK_TYPES];
  
  export const POST_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
  } as const;
  
  export type PostStatus = typeof POST_STATUS[keyof typeof POST_STATUS];
  
  // Company Enums
  export const COMPANY_WORKING_TIME = {
    MONDAY_TO_FRIDAY: 'monday-to-friday',
    MONDAY_TO_SATURDAY: 'monday-to-saturday',
  } as const;
  
  export type CompanyWorkingTime = typeof COMPANY_WORKING_TIME[keyof typeof COMPANY_WORKING_TIME];
  
  export const COMPANY_SIZE = {
    SIZE_1_50: '1-50',
    SIZE_51_200: '51-200',
    SIZE_201_500: '201-500',
    SIZE_501_1000: '501-1000',
    SIZE_1000_PLUS: '1000+',
  } as const;
  
  export type CompanySize = typeof COMPANY_SIZE[keyof typeof COMPANY_SIZE];
  
  export const COMPANY_TYPE = {
    TECHNOLOGY: 'technology',
    FINANCE: 'finance',
    HEALTHCARE: 'healthcare',
    EDUCATION: 'education',
    RETAIL: 'retail',
    MANUFACTURING: 'manufacturing',
    CONSULTING: 'consulting',
    MEDIA: 'media',
    REAL_ESTATE: 'real-estate',
    TRANSPORTATION: 'transportation',
    ENERGY: 'energy',
    GOVERNMENT: 'government',
    NON_PROFIT: 'non-profit',
    STARTUP: 'startup',
    OTHER: 'other',
  } as const;
  
  export type CompanyType = typeof COMPANY_TYPE[keyof typeof COMPANY_TYPE];
  
  // Plan Enums
  export const PLAN_TYPE = {
    FREE: 'free',
    BASIC: 'basic',
    EXPERT: 'expert',
  } as const;
  
  export type PlanType = typeof PLAN_TYPE[keyof typeof PLAN_TYPE];
  
  // Transaction Enums
  export const TRANSACTION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAIL: 'fail',
  } as const;
  
  export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];
  
  // Application Enums
  export const APPLICATION_TYPE = {
    CV: 'cv',
    FORM: 'form',
  } as const;
  
  export type ApplicationType = typeof APPLICATION_TYPE[keyof typeof APPLICATION_TYPE];
  
  export const APPLICATION_STATUS = {
    APPLIED: 'applied',
    REVIEWING: 'reviewing',
    SHORTLISTED: 'shortlisted',
    INTERVIEWED: 'interviewed',
    HIRED: 'hired',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn',
  } as const;
  
  export type ApplicationStatus = typeof APPLICATION_STATUS[keyof typeof APPLICATION_STATUS];
  
  // Partner Request Enums
  export const PARTNER_REQUEST_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  } as const;
  
  export type PartnerRequestStatus = typeof PARTNER_REQUEST_STATUS[keyof typeof PARTNER_REQUEST_STATUS];
  
  // Common Arrays for validation
  export const USER_ROLE_ARRAY = Object.values(USER_ROLES);
  export const POST_WORK_TYPE_ARRAY = Object.values(POST_WORK_TYPES);
  export const POST_STATUS_ARRAY = Object.values(POST_STATUS);
  export const COMPANY_WORKING_TIME_ARRAY = Object.values(COMPANY_WORKING_TIME);
  export const COMPANY_SIZE_ARRAY = Object.values(COMPANY_SIZE);
  export const COMPANY_TYPE_ARRAY = Object.values(COMPANY_TYPE);
  export const PLAN_TYPE_ARRAY = Object.values(PLAN_TYPE);
  export const TRANSACTION_STATUS_ARRAY = Object.values(TRANSACTION_STATUS);
  export const APPLICATION_TYPE_ARRAY = Object.values(APPLICATION_TYPE);
  export const APPLICATION_STATUS_ARRAY = Object.values(APPLICATION_STATUS);
  export const PARTNER_REQUEST_STATUS_ARRAY = Object.values(PARTNER_REQUEST_STATUS);
  
  // Default values
  export const DEFAULT_VALUES = {
    USER_ROLE: USER_ROLES.CANDIDATE,
    POST_STATUS: POST_STATUS.PENDING,
    TRANSACTION_STATUS: TRANSACTION_STATUS.PENDING,
    APPLICATION_STATUS: APPLICATION_STATUS.APPLIED,
    PARTNER_REQUEST_STATUS: PARTNER_REQUEST_STATUS.PENDING,
  } as const;
  