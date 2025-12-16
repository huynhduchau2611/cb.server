import mongoose, { Document, Schema } from 'mongoose';
import { TRANSACTION_STATUS_ARRAY, DEFAULT_VALUES, TransactionStatus } from '../const';

export interface ITransaction extends Document {
  orderId: string;
  amount: number;
  status: TransactionStatus;
  description: string;
  company: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;
  paymentLink?: string; // PayOS payment link
  payosOrderCode?: number; // PayOS order code
  payosCode?: string; // PayOS transaction code
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema({
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  status: {
    type: String,
    enum: TRANSACTION_STATUS_ARRAY,
    default: DEFAULT_VALUES.TRANSACTION_STATUS,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required'],
  },
  plan: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    required: [true, 'Plan is required'],
  },
  paymentLink: {
    type: String,
    trim: true,
  },
  payosOrderCode: {
    type: Number,
  },
  payosCode: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Index for better query performance
TransactionSchema.index({ orderId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ company: 1 });
TransactionSchema.index({ plan: 1 });
TransactionSchema.index({ createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
