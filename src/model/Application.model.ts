import mongoose, { Document, Schema } from 'mongoose';
import {
  APPLICATION_TYPE_ARRAY,
  APPLICATION_STATUS_ARRAY,
  DEFAULT_VALUES,
  ApplicationType,
  ApplicationStatus,
} from '../const';

export interface IApplication extends Document {
  type: ApplicationType;
  cvUrl?: string;
  status: ApplicationStatus;
  formData?: {
    phone: string;
    skills: string;
    experience: string;
    availability: string;
    additionalInfo?: string;
  };
  user: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema: Schema = new Schema({
  type: {
    type: String,
    enum: APPLICATION_TYPE_ARRAY,
    required: [true, 'Application type is required'],
  },
  cvUrl: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: APPLICATION_STATUS_ARRAY,
    default: DEFAULT_VALUES.APPLICATION_STATUS,
  },
  formData: {
    phone: {
      type: String,
      trim: true,
    },
    skills: {
      type: String,
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
    },
    availability: {
      type: String,
      trim: true,
    },
    additionalInfo: {
      type: String,
      trim: true,
    },
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'Post is required'],
  },
}, {
  timestamps: true,
});

// Index for better query performance
ApplicationSchema.index({ user: 1 });
ApplicationSchema.index({ post: 1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ type: 1 });
ApplicationSchema.index({ createdAt: -1 });

// Compound index to prevent duplicate applications
ApplicationSchema.index({ post: 1, user: 1 }, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
