import mongoose, { Document, Schema } from 'mongoose';
import { PLAN_TYPE_ARRAY, PlanType } from '../const';

export interface IPlan extends Document {
  name: string;
  price: number;
  durationInDays: number;
  limit: {
    limitPost: number;
    postDuration: number;
  };
  feature: {
    highlightBadge: boolean;
    urgentBadge: boolean;
    trainingSupport: boolean;
  };
  type: PlanType;
  isTemplate: boolean; // true for template plans (shared), false for company-specific plans
  company?: mongoose.Types.ObjectId; // Optional - only for company-specific plans
  transaction?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [100, 'Plan name cannot exceed 100 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  durationInDays: {
    type: Number,
    required: [true, 'Duration in days is required'],
    min: [1, 'Duration must be at least 1 day'],
  },
  limit: {
    limitPost: {
      type: Number,
      required: [true, 'Post limit is required'],
      min: [0, 'Post limit cannot be negative'],
    },
    postDuration: {
      type: Number,
      required: [true, 'Post duration is required'],
      min: [1, 'Post duration must be at least 1 day'],
    },
  },
  feature: {
    highlightBadge: {
      type: Boolean,
      default: false,
    },
    urgentBadge: {
      type: Boolean,
      default: false,
    },
    trainingSupport: {
      type: Boolean,
      default: false,
    },
  },
  type: {
    type: String,
    enum: PLAN_TYPE_ARRAY,
    required: [true, 'Plan type is required'],
  },
  isTemplate: {
    type: Boolean,
    default: false,
    required: true,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: false, // Optional - only for company-specific plans
  },
  transaction: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    required: false,
  },
}, {
  timestamps: true,
});

// Index for better query performance
PlanSchema.index({ name: 1 });
PlanSchema.index({ type: 1 });
PlanSchema.index({ price: 1 });
PlanSchema.index({ company: 1 });
PlanSchema.index({ transaction: 1 });
PlanSchema.index({ isTemplate: 1 });
PlanSchema.index({ isTemplate: 1, type: 1 }); // Composite index for finding template plans by type

export default mongoose.model<IPlan>('Plan', PlanSchema);
