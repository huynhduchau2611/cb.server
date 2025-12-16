import mongoose, { Document, Schema } from 'mongoose';
import {
  POST_WORK_TYPE_ARRAY,
  POST_STATUS_ARRAY,
  DEFAULT_VALUES,
  PostWorkType,
  PostStatus,
} from '../const';

export interface IPost extends Document {
  title: string;
  description: string;
  salary: number;
  techStack: string[];
  typeWork: PostWorkType;
  candidateCount: number;
  candidateApplied: number;
  status: PostStatus;
  company: mongoose.Types.ObjectId;
  isHidden: boolean;
  hiddenAt?: Date | null;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema: Schema = new Schema({
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [100, 'Post title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Post description is required'],
    trim: true,
  },
  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: [0, 'Salary cannot be negative'],
  },
  techStack: [{
    type: String,
    trim: true,
  }],
  typeWork: {
    type: String,
    enum: POST_WORK_TYPE_ARRAY,
    required: [true, 'Work type is required'],
  },
  candidateCount: {
    type: Number,
    required: [true, 'Candidate count is required'],
    min: [1, 'Candidate count must be at least 1'],
  },
  candidateApplied: {
    type: Number,
    default: 0,
    min: [0, 'Candidate applied cannot be negative'],
  },
  isHidden: {
    type: Boolean,
    default: false,
  },
  hiddenAt: {
    type: Date,
    default: null,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: POST_STATUS_ARRAY,
    default: DEFAULT_VALUES.POST_STATUS,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required'],
  },
}, {
  timestamps: true,
});

// Index for better query performance
PostSchema.index({ title: 'text', description: 'text', techStack: 'text' });
PostSchema.index({ company: 1 });
PostSchema.index({ status: 1 });
PostSchema.index({ typeWork: 1 });
PostSchema.index({ techStack: 1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ candidateApplied: -1 });
PostSchema.index({ isHidden: 1 });
PostSchema.index({ isFeatured: 1 });

export default mongoose.model<IPost>('Post', PostSchema);

