import { Router } from 'express';
import { PaymentController } from '../controller/payment.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { USER_ROLES } from '../const';

const router = Router();

// Create payment link for plan upgrade
// Protected endpoint - Employer only
router.post(
  '/create-payment',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PaymentController.createPaymentLink
);

// PayOS webhook handler (public endpoint, called by PayOS)
router.post(
  '/webhook',
  PaymentController.handlePayOSWebhook
);

// Get payment status
// Protected endpoint - Employer only
router.get(
  '/status/:transactionId',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PaymentController.getPaymentStatus
);

// Get all transactions for current company
// Protected endpoint - Employer only
router.get(
  '/transactions',
  authenticateToken,
  authorizeRoles(USER_ROLES.EMPLOYER),
  PaymentController.getMyTransactions
);

export default router;

