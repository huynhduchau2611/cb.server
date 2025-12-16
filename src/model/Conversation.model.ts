import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  users: mongoose.Types.ObjectId[]; // Array of user IDs participating in the conversation
  job?: mongoose.Types.ObjectId; // Optional: link to a job if conversation is about a job
  lastMessage?: mongoose.Types.ObjectId; // Reference to the last message
  lastMessageAt?: Date; // Timestamp of last message
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema({
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  job: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  lastMessageAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for better query performance
ConversationSchema.index({ users: 1 });
ConversationSchema.index({ job: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ createdAt: -1 });

// Compound index for query performance (not unique to allow multiple conversations per user pair)
// Uniqueness will be enforced in application logic
// Note: If there's an old unique index in the database, it needs to be dropped manually:
// db.conversations.dropIndex("users_1_job_1")
ConversationSchema.index({ users: 1, job: 1 });

export default mongoose.model<IConversation>('Conversation', ConversationSchema);

