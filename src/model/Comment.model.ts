import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  user: mongoose.Types.ObjectId; // Người comment
  targetType: 'user' | 'company'; // Loại đối tượng được comment
  targetId: mongoose.Types.ObjectId; // ID của user hoặc company được comment
  pros: string; // Ưu điểm
  cons: string; // Nhược điểm
  upCount: number; // Số lượt vote hữu ích
  upvotedBy: mongoose.Types.ObjectId[]; // Danh sách user đã vote
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  targetType: {
    type: String,
    enum: ['user', 'company'],
    required: [true, 'Target type is required'],
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Target ID is required'],
  },
  pros: {
    type: String,
    required: [true, 'Pros is required'],
    trim: true,
    maxlength: [1000, 'Pros cannot exceed 1000 characters'],
  },
  cons: {
    type: String,
    required: [true, 'Cons is required'],
    trim: true,
    maxlength: [1000, 'Cons cannot exceed 1000 characters'],
  },
  upCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  upvotedBy: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

// Index for better query performance
CommentSchema.index({ targetType: 1, targetId: 1 });
CommentSchema.index({ user: 1 });
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ upCount: -1 });

// Compound index to prevent duplicate comments from same user on same target
CommentSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

export default mongoose.model<IComment>('Comment', CommentSchema);

