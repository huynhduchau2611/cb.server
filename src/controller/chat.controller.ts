import { Request, Response } from 'express';
import { Conversation, Message, User, Post } from '@/model';
import { successResponse, errorResponse } from '@/utils/response.util';
import { AuthRequest } from '@/middleware/auth.middleware';
import mongoose from 'mongoose';

export class ChatController {
  /**
   * Get or create a conversation between current user and another user
   * If jobId is provided, create conversation linked to that job
   */
  public static async getOrCreateConversation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      const { userId, jobId } = req.body;

      if (!currentUserId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!userId) {
        errorResponse(res, 'userId is required', 400);
        return;
      }

      // Don't allow user to create conversation with themselves
      if (currentUserId === userId) {
        errorResponse(res, 'Cannot create conversation with yourself', 400);
        return;
      }

      // Verify the other user exists
      const otherUser = await User.findById(userId);
      if (!otherUser) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      // If jobId is provided, verify job exists
      if (jobId) {
        const job = await Post.findById(jobId);
        if (!job) {
          errorResponse(res, 'Job not found', 404);
          return;
        }
      }

      // Sort user IDs to ensure consistent conversation lookup
      const userIds = [new mongoose.Types.ObjectId(currentUserId), new mongoose.Types.ObjectId(userId)].sort();

      // Build query for finding existing conversation
      // Use $all to match conversations that contain both users
      // Note: Don't use $size: 2 as it might not work with the old unique index
      // We'll filter by exact user count in memory if needed
      const query: any = {
        users: { $all: userIds }
      };
      
      if (jobId) {
        query.job = new mongoose.Types.ObjectId(jobId);
      } else {
        // Match conversations where job is null
        query.job = null;
      }

      // Try to find existing conversation
      // Query all conversations with these users, then filter by exact match and job
      // This works better with the old unique index that might index users differently
      let allMatchingConversations = await Conversation.find(query)
        .populate('users', 'fullName email avatar')
        .populate('job', 'title company')
        .populate({
          path: 'lastMessage',
          select: 'content sender createdAt',
          populate: {
            path: 'sender',
            select: 'fullName email avatar',
          },
        });
      
      // Filter to find conversation with exactly 2 users matching our userIds
      let conversation = allMatchingConversations.find((conv: any) => {
        const convUserIds = conv.users.map((u: any) => {
          const id = u._id ? String(u._id) : String(u);
          return id;
        }).sort();
        
        const targetUserIds = userIds.map(id => String(id)).sort();
        
        // Must have exactly 2 users and they must match
        return convUserIds.length === 2 && 
               convUserIds[0] === targetUserIds[0] && 
               convUserIds[1] === targetUserIds[1];
      }) || null;

      // Track if this is a newly created conversation
      let isNewConversation = false;

      // If conversation doesn't exist, try to create it
      // Double-check before creating to avoid duplicates (application-level uniqueness)
      if (!conversation) {
        // Double-check: query again to make sure it wasn't created between the first query and now
        const doubleCheckConversations = await Conversation.find(query)
          .populate('users', 'fullName email avatar')
          .populate('job', 'title company')
          .populate({
            path: 'lastMessage',
            select: 'content sender createdAt',
            populate: {
              path: 'sender',
              select: 'fullName email avatar',
            },
          });
        
        const doubleCheck = doubleCheckConversations.find((conv: any) => {
          const convUserIds = conv.users.map((u: any) => {
            const id = u._id ? String(u._id) : String(u);
            return id;
          }).sort();
          
          const targetUserIds = userIds.map(id => String(id)).sort();
          
          return convUserIds.length === 2 && 
                 convUserIds[0] === targetUserIds[0] && 
                 convUserIds[1] === targetUserIds[1];
        });
        
        if (doubleCheck) {
          conversation = doubleCheck;
        } else {
          // Create new conversation
          try {
            conversation = await Conversation.create({
              users: userIds,
              job: jobId ? new mongoose.Types.ObjectId(jobId) : null,
            });
            
            // Mark as newly created
            isNewConversation = true;

            // Populate the new conversation
            conversation = await Conversation.findById(conversation._id)
              .populate('users', 'fullName email avatar')
              .populate('job', 'title company')
              .populate({
                path: 'lastMessage',
                select: 'content sender createdAt',
                populate: {
                  path: 'sender',
                  select: 'fullName email avatar',
                },
              });
          } catch (createError: any) {
          // If duplicate key error (E11000), another request created it first
          // Retry query with increasing delays to ensure the document is committed
          if (createError.code === 11000 || createError.message?.includes('duplicate key')) {
            console.log('Duplicate key error caught, retrying query...', { 
              userIds: userIds.map(id => id.toString()), 
              jobId,
              error: createError.message 
            });
            
            // Retry with increasing delays (500ms, 1000ms, 1500ms) to ensure transaction is committed
            let retries = 3;
            let delay = 500;
            
            while (retries > 0 && !conversation) {
              await new Promise(resolve => setTimeout(resolve, delay));
              
              // Try querying with the exact query that should match
              // Don't use $size: 2 as it might not work with the old unique index
              if (jobId) {
                conversation = await Conversation.findOne({
                  users: { $all: userIds },
                  job: new mongoose.Types.ObjectId(jobId)
                })
                  .populate('users', 'fullName email avatar')
                  .populate('job', 'title company')
                  .populate({
                    path: 'lastMessage',
                    select: 'content sender createdAt',
                    populate: {
                      path: 'sender',
                      select: 'fullName email avatar',
                    },
                  });
              } else {
                // For null job, try multiple ways
                conversation = await Conversation.findOne({
                  users: { $all: userIds },
                  job: null
                })
                  .populate('users', 'fullName email avatar')
                  .populate('job', 'title company')
                  .populate({
                    path: 'lastMessage',
                    select: 'content sender createdAt',
                    populate: {
                      path: 'sender',
                      select: 'fullName email avatar',
                    },
                  });
              }
              
              // If still not found, try querying all conversations with these users
              // Filter by exact user match and job in memory
              if (!conversation) {
                const allConversations = await Conversation.find({
                  users: { $all: userIds }
                })
                  .sort({ createdAt: -1 }) // Get most recent first
                  .populate('users', 'fullName email avatar')
                  .populate('job', 'title company')
                  .populate({
                    path: 'lastMessage',
                    select: 'content sender createdAt',
                    populate: {
                      path: 'sender',
                      select: 'fullName email avatar',
                    },
                  });
                
                console.log(`Retry ${4 - retries}: Found ${allConversations.length} conversations with these users`);
                
                // Filter by exact user match (exactly 2 users) and job in memory
                conversation = allConversations.find((conv: any) => {
                  // First, check if conversation has exactly 2 users and they match
                  const convUserIds = conv.users.map((u: any) => {
                    const id = u._id ? String(u._id) : String(u);
                    return id;
                  }).sort();
                  
                  const targetUserIds = userIds.map(id => String(id)).sort();
                  
                  // Must have exactly 2 users and they must match
                  if (convUserIds.length !== 2 || 
                      convUserIds[0] !== targetUserIds[0] || 
                      convUserIds[1] !== targetUserIds[1]) {
                    return false;
                  }
                  
                  // Then check job match
                  let convJobId: string | null = null;
                  if (conv.job) {
                    if (conv.job._id) {
                      convJobId = String(conv.job._id);
                    } else if (typeof conv.job === 'string') {
                      convJobId = conv.job;
                    } else if (conv.job.toString) {
                      convJobId = String(conv.job);
                    }
                  }
                  
                  const targetJobId = jobId ? String(jobId) : null;
                  
                  if (targetJobId) {
                    return convJobId === targetJobId;
                  } else {
                    // For null job, check if job is null, undefined, or not populated
                    return !convJobId && (!conv.job || conv.job === null || conv.job === undefined);
                  }
                }) || null;
              }
              
              if (!conversation) {
                delay += 500;
                retries--;
                console.log(`Conversation not found, retrying in ${delay}ms... (${retries} retries left)`);
              } else {
                console.log('Successfully found conversation after duplicate key error');
                break;
              }
            }
            
            if (!conversation) {
              console.error('Duplicate key error but conversation not found after all retry attempts:', {
                error: createError.message,
                userIds: userIds.map(id => id.toString()),
                jobId,
                errorCode: createError.code
              });
              errorResponse(res, 'Failed to get or create conversation: conversation not found after duplicate key error', 500);
              return;
            }
          } else {
            // Log and re-throw other errors
            console.error('Error creating conversation:', createError);
            throw createError;
          }
          }
        }
      }

      if (!conversation) {
        console.error('Conversation is null after all attempts');
        errorResponse(res, 'Failed to get or create conversation', 500);
        return;
      }

      // If this is a new conversation, emit socket event to notify the other user
      if (isNewConversation) {
        try {
          const socketService = (global as any).socketService;
          if (socketService) {
            // Emit to the other user's room
            const otherUserId = String(userId);
            
            // Convert conversation to plain object with all populated fields
            let conversationData: any;
            if (conversation.toObject) {
              conversationData = conversation.toObject();
            } else if (conversation.toJSON) {
              conversationData = conversation.toJSON();
            } else {
              conversationData = JSON.parse(JSON.stringify(conversation));
            }
            
            // Ensure all fields are properly serialized
            if (conversationData.users) {
              conversationData.users = conversationData.users.map((u: any) => ({
                _id: String(u._id || u),
                fullName: u.fullName || '',
                email: u.email || '',
                avatar: u.avatar || '',
              }));
            }
            
            if (conversationData.job && conversationData.job._id) {
              conversationData.job = {
                _id: String(conversationData.job._id),
                title: conversationData.job.title || '',
                company: conversationData.job.company || '',
              };
            }
            
            socketService.getIO().to(`user:${otherUserId}`).emit('new_conversation', {
              conversation: conversationData,
            });
            console.log(`✅ Emitted new_conversation event to user:${otherUserId}`, {
              conversationId: conversationData._id,
              users: conversationData.users?.map((u: any) => u._id),
            });
          } else {
            console.warn('⚠️ SocketService not available, cannot emit new_conversation event');
          }
        } catch (socketError) {
          // Don't fail the request if socket emit fails
          console.error('❌ Error emitting new_conversation event:', socketError);
        }
      }

      successResponse(res, conversation, 200);
    } catch (error: any) {
      console.error('Error in getOrCreateConversation:', error);
      errorResponse(res, error.message || 'Failed to get or create conversation', 500);
    }
  }

  /**
   * Get all conversations for the current user
   */
  public static async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const conversations = await Conversation.find({
        users: currentUserId,
      })
        .populate('users', 'fullName email avatar')
        .populate('job', 'title company')
        .populate({
          path: 'lastMessage',
          populate: {
            path: 'sender',
            select: 'fullName email avatar',
          },
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .lean();

      // Format conversations to include other user info
      const formattedConversations = conversations.map((conv: any) => {
        const otherUser = conv.users.find(
          (u: any) => String(u._id) !== String(currentUserId)
        );
        return {
          ...conv,
          otherUser,
        };
      });

      successResponse(res, formattedConversations, 200);
    } catch (error: any) {
      errorResponse(res, error.message || 'Failed to get conversations', 500);
    }
  }

  /**
   * Get messages for a specific conversation
   */
  public static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      if (!currentUserId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Verify user is part of the conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        errorResponse(res, 'Conversation not found', 404);
        return;
      }

      const userIds = conversation.users.map((id) => String(id));
      if (!userIds.includes(currentUserId)) {
        errorResponse(res, 'Access denied. You are not part of this conversation', 403);
        return;
      }

      // Get messages with pagination
      const skip = (Number(page) - 1) * Number(limit);
      const messages = await Message.find({
        conversation: conversationId,
      })
        .populate('sender', 'fullName email avatar')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .lean();

      // Reverse to show oldest first
      messages.reverse();

      successResponse(res, messages, 200);
    } catch (error: any) {
      errorResponse(res, error.message || 'Failed to get messages', 500);
    }
  }

  /**
   * Mark messages as read
   */
  public static async markMessagesAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;
      const { conversationId } = req.params;

      if (!currentUserId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Verify user is part of the conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        errorResponse(res, 'Conversation not found', 404);
        return;
      }

      const userIds = conversation.users.map((id) => String(id));
      if (!userIds.includes(currentUserId)) {
        errorResponse(res, 'Access denied. You are not part of this conversation', 403);
        return;
      }

      // Mark all unread messages in this conversation as read (except messages sent by current user)
      const result = await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: currentUserId },
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      successResponse(res, { updatedCount: result.modifiedCount }, 200);
    } catch (error: any) {
      errorResponse(res, error.message || 'Failed to mark messages as read', 500);
    }
  }

  /**
   * Get unread message count for current user
   */
  public static async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Get all conversations for current user
      const conversations = await Conversation.find({
        users: currentUserId,
      }).select('_id');

      const conversationIds = conversations.map((conv) => conv._id);

      // Count unread messages (messages not sent by current user)
      const unreadCount = await Message.countDocuments({
        conversation: { $in: conversationIds },
        sender: { $ne: currentUserId },
        isRead: false,
      });

      successResponse(res, { unreadCount }, 200);
    } catch (error: any) {
      errorResponse(res, error.message || 'Failed to get unread count', 500);
    }
  }

  /**
   * Get user online status
   * Protected endpoint - requires authentication
   */
  public static async getUserOnlineStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        errorResponse(res, 'userId is required', 400);
        return;
      }

      // Get socket service from global
      const socketService = (global as any).socketService;
      const isOnline = socketService?.isUserOnline(userId) || false;

      // Get user's last seen time
      // Note: lastSeen field needs to be added to User model in production
      // For now, we'll return null
      const lastSeen = null;

      successResponse(res, { isOnline, lastSeen }, 200);
    } catch (error: any) {
      errorResponse(res, error.message || 'Failed to get user online status', 500);
    }
  }
}

