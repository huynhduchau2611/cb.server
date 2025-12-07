import { Router } from 'express';
import { ChatController } from '../controller/chat.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get or create a conversation
router.post(
  '/conversations',
  authenticateToken,
  ChatController.getOrCreateConversation
);

// Get all conversations for current user
router.get(
  '/conversations',
  authenticateToken,
  ChatController.getConversations
);

// Get messages for a conversation
router.get(
  '/conversations/:conversationId/messages',
  authenticateToken,
  ChatController.getMessages
);

// Mark messages as read
router.patch(
  '/conversations/:conversationId/read',
  authenticateToken,
  ChatController.markMessagesAsRead
);

// Get unread message count
router.get(
  '/unread-count',
  authenticateToken,
  ChatController.getUnreadCount
);

// Get user online status
router.get(
  '/users/:userId/online-status',
  authenticateToken,
  ChatController.getUserOnlineStatus
);

export default router;

