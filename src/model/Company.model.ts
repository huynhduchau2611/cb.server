import mongoose, { Document, Schema } from 'mongoose';
import {
  COMPANY_WORKING_TIME_ARRAY,
  COMPANY_SIZE_ARRAY,
  COMPANY_TYPE_ARRAY,
  PARTNER_REQUEST_STATUS_ARRAY,
  CompanyWorkingTime,
  CompanySize,
  CompanyType,
  PartnerRequestStatus,
  DEFAULT_VALUES,
} from '../const';

export interface ICompany extends Document {
  name: string;
  avatarUrl?: string;
  phone?: string;
  taxCode: string;
  workingTime: CompanyWorkingTime;
  size: CompanySize;
  typeCompany: CompanyType;
  provinceCode: string;
  province: string;
  districtCode: string;
  district: string;
  wardCode: string;
  ward: string;
  description?: string;
  website?: string;
  status: PartnerRequestStatus;
  user: mongoose.Types.ObjectId;
  plan?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  isFeatured?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters'],
  },
  avatarUrl: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  taxCode: {
    type: String,
    required: [true, 'Tax code is required'],
    unique: true,
    trim: true,
    match: [/^\d{10,13}$/, 'Tax code must be 10-13 digits'],
  },
  workingTime: {
    type: String,
    enum: COMPANY_WORKING_TIME_ARRAY,
    required: [true, 'Working time is required'],
  },
  size: {
    type: String,
    enum: COMPANY_SIZE_ARRAY,
    required: [true, 'Company size is required'],
  },
  typeCompany: {
    type: String,
    enum: COMPANY_TYPE_ARRAY,
    required: [true, 'Company type is required'],
  },
  provinceCode: {
    type: String,
    required: [true, 'Province code is required'],
    trim: true,
  },
  province: {
    type: String,
    required: [true, 'Province is required'],
    trim: true,
  },
  districtCode: {
    type: String,
    required: [true, 'District code is required'],
    trim: true,
  },
  district: {
    type: String,
    required: [true, 'District is required'],
    trim: true,
  },
  wardCode: {
    type: String,
    required: [true, 'Ward code is required'],
    trim: true,
  },
  ward: {
    type: String,
    required: [true, 'Ward is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  website: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: PARTNER_REQUEST_STATUS_ARRAY,
    default: DEFAULT_VALUES.PARTNER_REQUEST_STATUS,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  plan: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Index for better query performance
CompanySchema.index({ name: 1 });
CompanySchema.index({ taxCode: 1 });
CompanySchema.index({ workingTime: 1 });
CompanySchema.index({ size: 1 });
CompanySchema.index({ typeCompany: 1 });
CompanySchema.index({ provinceCode: 1 });
CompanySchema.index({ districtCode: 1 });
CompanySchema.index({ plan: 1 });
CompanySchema.index({ status: 1 });
CompanySchema.index({ user: 1 });
CompanySchema.index({ isFeatured: 1 });

export default mongoose.model<ICompany>('Company', CompanySchema);
