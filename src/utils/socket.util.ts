import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { Conversation, Message, User } from '@/model';
import mongoose from 'mongoose';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private messageRateLimit: Map<string, { count: number; resetTime: number }> = new Map(); // userId -> rate limit data

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: function (origin, callback) {
          const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            process.env.CLIENT_URL || 'http://localhost:3000',
          ];

          // Allow requests with no origin (like mobile apps)
          if (!origin) {
            return callback(null, true);
          }

          // Allow all ngrok.io and ngrok-free.app domains
          if (origin && (origin.includes('.ngrok.io') || origin.includes('.ngrok-free.app'))) {
            return callback(null, true);
          }

          if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    // Store instance reference for access from controllers
    (this.io as any).socketService = this;
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        jwt.verify(token, config.jwt.secret, (err: any, decoded: any) => {
          if (err) {
            return next(new Error('Invalid or expired token'));
          }

          socket.user = decoded;
          socket.userId = decoded.id;
          next();
        });
      } catch (error: any) {
        next(new Error('Authentication failed: ' + error.message));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId;
      if (!userId) {
        socket.disconnect();
        return;
      }


      // Track user's socket connections
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Handle joining conversation room
      socket.on('join_conversation', async (data: { conversationId: string }) => {
        try {
          const { conversationId } = data;

          // Verify user is part of the conversation
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const userIds = conversation.users.map((id) => String(id));
          if (!userIds.includes(userId)) {
            socket.emit('error', { message: 'Access denied. You are not part of this conversation' });
            return;
          }

          // Join conversation room
          socket.join(`conversation:${conversationId}`);

          socket.emit('joined_conversation', { conversationId });
        } catch (error: any) {
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle leaving conversation room
      socket.on('leave_conversation', (data: { conversationId: string }) => {
        const { conversationId } = data;
        socket.leave(`conversation:${conversationId}`);
      });

      // Handle sending message
      socket.on('send_message', async (data: { conversationId: string; content: string }) => {
        try {
          const { conversationId, content } = data;

          if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Message content cannot be empty' });
            return;
          }

          if (content.length > 5000) {
            socket.emit('error', { message: 'Message content cannot exceed 5000 characters' });
            return;
          }

          // Rate limiting: Max 10 messages per 60 seconds
          const now = Date.now()
          const rateLimitData = this.messageRateLimit.get(userId)
          if (rateLimitData) {
            if (now < rateLimitData.resetTime) {
              if (rateLimitData.count >= 10) {
                socket.emit('error', { message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng đợi một chút.' })
                return
              }
              rateLimitData.count++
            } else {
              // Reset rate limit
              this.messageRateLimit.set(userId, { count: 1, resetTime: now + 60000 })
            }
          } else {
            this.messageRateLimit.set(userId, { count: 1, resetTime: now + 60000 })
          }

          // Validate: Check for links
          const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[a-z]{2,})/gi
          if (urlPattern.test(content)) {
            socket.emit('error', { message: 'Không được phép gửi link trong tin nhắn' })
            return
          }

          // Validate: Check for phone numbers
          const phonePattern = /(\+84|0)[0-9]{9,10}|[0-9]{3,4}[-\s]?[0-9]{3,4}[-\s]?[0-9]{3,4}/g
          if (phonePattern.test(content)) {
            socket.emit('error', { message: 'Không được phép gửi số điện thoại trong tin nhắn' })
            return
          }

          // Verify user is part of the conversation
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const userIds = conversation.users.map((id) => String(id));
          if (!userIds.includes(userId)) {
            socket.emit('error', { message: 'Access denied. You are not part of this conversation' });
            return;
          }

          // Create message
          const message = await Message.create({
            conversation: conversationId,
            sender: userId,
            content: content.trim(),
            isRead: false,
          });

          // Populate message with sender info
          await message.populate('sender', 'fullName email avatar');

          // Update conversation's last message
          conversation.lastMessage = message._id as mongoose.Types.ObjectId;
          conversation.lastMessageAt = new Date();
          await conversation.save();

          // Emit message to all users in the conversation room
          this.io.to(`conversation:${conversationId}`).emit('new_message', {
            message: message.toObject(),
            conversationId,
          });

          // Notify other users in the conversation (if they're not in the room)
          const otherUserIds = userIds.filter((id) => id !== userId);
          otherUserIds.forEach((otherUserId) => {
            this.io.to(`user:${otherUserId}`).emit('message_notification', {
              conversationId,
              message: message.toObject(),
            });
          });

        } catch (error: any) {
          socket.emit('error', { message: 'Failed to send message: ' + error.message });
        }
      });

      // Handle marking messages as read
      socket.on('mark_read', async (data: { conversationId: string }) => {
        try {
          const { conversationId } = data;

          // Verify user is part of the conversation
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const userIds = conversation.users.map((id) => String(id));
          if (!userIds.includes(userId)) {
            socket.emit('error', { message: 'Access denied. You are not part of this conversation' });
            return;
          }

          // Mark all unread messages in this conversation as read (except messages sent by current user)
          await Message.updateMany(
            {
              conversation: conversationId,
              sender: { $ne: userId },
              isRead: false,
            },
            {
              isRead: true,
              readAt: new Date(),
            }
          );

          // Notify other users that messages were read
          this.io.to(`conversation:${conversationId}`).emit('messages_read', {
            conversationId,
            readBy: userId,
          });

        } catch (error: any) {
          socket.emit('error', { message: 'Failed to mark messages as read' });
        }
      });

      // Handle typing indicator
      socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
        const { conversationId, isTyping } = data;
        socket.to(`conversation:${conversationId}`).emit('user_typing', {
          userId,
          conversationId,
          isTyping,
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {

        // Remove socket from user's socket set
        const userSockets = this.userSockets.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public getUserSockets(userId: string): Set<string> {
    return this.userSockets.get(userId) || new Set();
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
