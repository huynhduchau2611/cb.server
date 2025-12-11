import { Request, Response } from 'express';
import { Company, Plan, Transaction } from '../model';
import { successResponse, errorResponse } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';
import { TRANSACTION_STATUS, PLAN_TYPE } from '../const';
import crypto from 'crypto';

// PayOS API base URL
const PAYOS_API_BASE = 'https://api-merchant.payos.vn';

// PayOS API response types
interface PayOSErrorResponse {
  message?: string;
  desc?: string;
  code?: number;
}

interface PayOSSuccessResponse {
  code: string | number; // PayOS returns "00" as string for success
  desc: string;
  data: {
    checkoutUrl: string; // PayOS returns checkoutUrl, not paymentLink
    orderCode: number;
    paymentLinkId?: string;
    qrCode?: string;
  };
}

/**
 * Generate HMAC SHA256 signature for PayOS webhook verification
 */
function generateHMAC(data: string, key: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Create payment link using PayOS API v2
 */
async function createPayOSPaymentLink(orderData: {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ paymentLink: string; orderCode: number }> {
  const { clientId, apiKey, checksumKey, returnUrl, cancelUrl, webhookUrl } = config.payos;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('PayOS credentials are not configured. Please check your .env file.');
  }

  // PayOS v2 API structure
  // According to PayOS docs, signature is calculated from: amount, orderCode, description, returnUrl, cancelUrl
  // Items are included in request but NOT in signature calculation
  
  const returnUrlValue = orderData.returnUrl || returnUrl;
  const cancelUrlValue = orderData.cancelUrl || cancelUrl;
  
  // Data for signature calculation (only these fields)
  const signatureData = {
    amount: orderData.amount,
    cancelUrl: cancelUrlValue,
    description: orderData.description,
    orderCode: orderData.orderCode,
    returnUrl: returnUrlValue,
  };

  // Generate checksum (HMAC SHA256) from signature data only
  // PayOS requires: sort keys alphabetically, create query string format: key1=value1&key2=value2
  const sortedKeys = Object.keys(signatureData).sort();
  
  // Create query string format for signature calculation
  const dataString = sortedKeys
    .map(key => `${key}=${signatureData[key as keyof typeof signatureData]}`)
    .join('&');
  
  const checksum = generateHMAC(dataString, checksumKey);

  // Full request body with items and signature
  // Note: PayOS API v2 does NOT accept webhookUrl in request body
  // Webhook URL must be configured in PayOS Dashboard
  const requestBody = {
    orderCode: orderData.orderCode,
    amount: orderData.amount,
    description: orderData.description,
    items: [
      {
        name: orderData.description,
        quantity: 1,
        price: orderData.amount,
      },
    ],
    returnUrl: returnUrlValue,
    cancelUrl: cancelUrlValue,
    signature: checksum,
  };
  
  // Log webhook URL info (for reference only, not sent to PayOS)
  if (webhookUrl) {
    console.log('📡 Webhook URL (configure in PayOS Dashboard):', webhookUrl);
  } else {
    console.warn('⚠️  PAYOS_WEBHOOK_URL not set. Make sure to configure webhook URL in PayOS Dashboard.');
  }

  const response = await fetch(`${PAYOS_API_BASE}/v2/payment-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorData: PayOSErrorResponse = {};
    try {
      errorData = JSON.parse(responseText) as PayOSErrorResponse;
    } catch (e) {
      errorData = { message: responseText };
    }
    console.error('PayOS API error:', errorData);
    throw new Error(errorData?.message || errorData?.desc || `PayOS API error: ${response.statusText}`);
  }

  let result: PayOSSuccessResponse;
  try {
    result = JSON.parse(responseText) as PayOSSuccessResponse;
  } catch (e) {
    throw new Error(`Invalid PayOS response: ${responseText}`);
  }
  
  // PayOS returns code as "00" (string) for success, or number 0
  const isSuccess = result.code === 0 || result.code === '00';
  
  if (!isSuccess) {
    throw new Error(result.desc || 'Failed to create payment link');
  }

  // PayOS returns checkoutUrl in data
  return {
    paymentLink: result.data.checkoutUrl,
    orderCode: result.data.orderCode,
  };
}

/**
 * Verify PayOS webhook signature
 */
function verifyPayOSWebhook(data: any, signature: string): boolean {
  const { checksumKey } = config.payos;
  const dataString = JSON.stringify(data);
  const expectedSignature = generateHMAC(dataString, checksumKey);
  return expectedSignature === signature;
}

export class PaymentController {
  /**
   * Create payment link for plan upgrade
   * Protected endpoint - Employer only
   */
  public static async createPaymentLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { planType } = req.body; // 'basic' or 'expert'

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!planType) {
        errorResponse(res, 'Plan type is required', 400);
        return;
      }

      // Find the company associated with the user
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found. Please create a company profile first.', 404);
        return;
      }

      // Check if company is approved
      if (company.status !== 'approved') {
        errorResponse(res, 'Your company profile must be approved before upgrading plan.', 403);
        return;
      }

      // Find the plan template (use lean() to get fresh data from DB, not cached)
      // Sort by updatedAt desc to get the most recently updated plan if multiple exist
      const planTemplate = await Plan.findOne({
        isTemplate: true,
        type: planType,
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (!planTemplate) {
        errorResponse(res, `Plan template '${planType}' not found.`, 404);
        return;
      }

      // Debug: Log plan template price to verify it's correct
      console.log(`[Payment] Plan template found: ${planTemplate.name}, Type: ${planTemplate.type}, Price: ${planTemplate.price}`);

      // Don't allow free plan upgrade (it's free, no payment needed)
      if (planType === PLAN_TYPE.FREE) {
        errorResponse(res, 'Free plan does not require payment. Please use the plan update endpoint.', 400);
        return;
      }

      // Generate unique order code (PayOS requires integer between 1 and 9007199254740991)
      // Use timestamp + random number to ensure uniqueness
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const orderCode = (timestamp + random) % 9007199254740991;

      // Create payment link via PayOS
      // PayOS requires description max 25 characters
      const shortDescription = planTemplate.name.length > 25 
        ? planTemplate.name.substring(0, 22) + '...'
        : planTemplate.name;
      
      const { paymentLink, orderCode: payosOrderCode } = await createPayOSPaymentLink({
        orderCode,
        amount: planTemplate.price,
        description: shortDescription,
        returnUrl: config.payos.returnUrl,
        cancelUrl: config.payos.cancelUrl,
      });

      // Create transaction record
      const transaction = await Transaction.create({
        orderId: `PAYOS-${orderCode}-${company._id}`,
        amount: planTemplate.price,
        status: TRANSACTION_STATUS.PENDING,
        description: `Nâng cấp gói ${planTemplate.name}`,
        company: company._id,
        plan: planTemplate._id,
        paymentLink,
        payosOrderCode,
      });

      successResponse(res, {
        paymentLink,
        transaction: {
          id: transaction._id,
          orderId: transaction.orderId,
          amount: transaction.amount,
          status: transaction.status,
          plan: planTemplate.name,
        },
        message: 'Payment link created successfully. Please complete the payment to upgrade your plan.',
      });
    } catch (error: any) {
      console.error('Create payment link error:', error);
      errorResponse(res, error.message || 'Failed to create payment link', 500);
    }
  }

  /**
   * PayOS webhook handler
   * Public endpoint - called by PayOS after payment
   * PayOS v2 webhook format: { code, desc, data: { orderCode, amount, ... } }
   */
  public static async handlePayOSWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔔 PAYOS WEBHOOK RECEIVED');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📥 Request Method:', req.method);
      console.log('📥 Request URL:', req.url);
      console.log('📥 Request Headers:', JSON.stringify(req.headers, null, 2));
      console.log('📥 Request Body:', JSON.stringify(req.body, null, 2));
      console.log('═══════════════════════════════════════════════════════════');
      
      const webhookData = req.body;
      
      // PayOS v2 sends webhook with signature in header or body
      // For security, verify the webhook data
      const { code, desc, data } = webhookData;
      
      console.log('📦 Parsed webhook data:');
      console.log('   Code:', code);
      console.log('   Desc:', desc);
      console.log('   Data:', JSON.stringify(data, null, 2));

      // PayOS webhook response structure
      // code: 0 or "00" = success, other = error
      // data contains: orderCode, amount, description, accountNumber, transactionDateTime, etc.
      
      // PayOS returns code as "00" (string) for success, or number 0
      const isSuccess = code === 0 || code === "00" || code === "0";
      
      if (!isSuccess) {
        console.error('❌ PayOS webhook error code:', code);
        console.error('❌ Error description:', desc);
        // Still return success to PayOS to acknowledge receipt
        res.status(200).json({
          code: 0,
          desc: 'OK',
          data: null,
        });
        console.log('✅ Response sent to PayOS (error acknowledged)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      
      console.log('✅ Webhook code indicates success (code:', code, '), processing payment...');

      if (!data) {
        console.error('❌ Webhook data is missing!');
        res.status(200).json({
          code: 0,
          desc: 'OK',
          data: null,
        });
        console.log('✅ Response sent to PayOS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      
      const { orderCode, amount } = data;
      
      console.log('🔍 Processing payment:');
      console.log('   Order Code:', orderCode);
      console.log('   Amount:', amount);
      console.log('   Looking for transaction with payosOrderCode:', orderCode);

      // Find transaction by PayOS order code
      const transaction = await Transaction.findOne({
        payosOrderCode: orderCode,
      }).populate('company plan');

      if (!transaction) {
        console.error('❌ Transaction not found for orderCode:', orderCode);
        console.error('   Searching all transactions...');
        const allTransactions = await Transaction.find({}).select('payosOrderCode orderId amount status').limit(10).lean();
        console.error('   Available transactions:', JSON.stringify(allTransactions, null, 2));
        // Still return success to PayOS
        res.status(200).json({
          code: 0,
          desc: 'OK',
          data: null,
        });
        console.log('✅ Response sent to PayOS (transaction not found)');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      
      console.log('✅ Transaction found:');
      console.log('   Transaction ID:', transaction._id);
      console.log('   PayOS Order Code:', transaction.payosOrderCode);
      console.log('   Transaction Amount:', transaction.amount);
      console.log('   Current Status:', transaction.status);
      console.log('   Company ID:', transaction.company);
      console.log('   Plan ID:', transaction.plan);

      // Check if transaction is already processed
      if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
        console.log('⚠️  Transaction already processed:', transaction._id);
        console.log('   Skipping update...');
        res.status(200).json({
          code: 0,
          desc: 'OK',
          data: null,
        });
        console.log('✅ Response sent to PayOS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        return;
      }

      // Verify amount matches
      console.log('💰 Verifying amount:');
      console.log('   Transaction amount:', transaction.amount);
      console.log('   Webhook amount:', amount);
      if (transaction.amount !== amount) {
        console.error('❌ Amount mismatch!');
        console.error('   Transaction:', transaction.amount);
        console.error('   Webhook:', amount);
        // Mark as failed
        transaction.status = TRANSACTION_STATUS.FAIL;
        await transaction.save();
        console.log('   Transaction marked as FAIL');
        res.status(200).json({
          code: 0,
          desc: 'OK',
          data: null,
        });
        console.log('✅ Response sent to PayOS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        return;
      }
      console.log('✅ Amount matches!');

      // Update transaction status to completed
      console.log('🔄 Updating transaction status to COMPLETED...');
      transaction.status = TRANSACTION_STATUS.COMPLETED;
      transaction.payosCode = data.transactionDateTime || data.code || String(orderCode);
      await transaction.save();
      console.log('✅ Transaction status updated to COMPLETED');

      // Update company plan - upgrade from free to basic/expert
      const company = transaction.company as any;
      const plan = transaction.plan as any;
      
      console.log('🔄 Updating company plan...');
      console.log('   Company:', company ? `${company.name} (${company._id})` : 'NOT FOUND');
      console.log('   Plan:', plan ? `${plan.name} (${plan._id})` : 'NOT FOUND');
      
      if (company && plan) {
        const oldPlanId = company.plan ? String(company.plan._id || company.plan) : 'none';
        const newPlanId = String(plan._id || plan);
        
        // Update company plan
        company.plan = plan._id || plan;
        await company.save();
        
        // Verify the update
        const updatedCompany = await Company.findById(company._id).populate('plan');
        console.log('✅ Payment successful!');
        console.log(`   Company: ${updatedCompany?.name} (${updatedCompany?._id})`);
        console.log(`   Plan upgraded: ${oldPlanId} → ${newPlanId}`);
        console.log(`   New plan: ${updatedCompany?.plan ? (updatedCompany.plan as any).name : 'NOT SET'}`);
        console.log(`   Transaction: ${transaction._id}`);
      } else {
        console.error('❌ Missing company or plan data:', {
          hasCompany: !!company,
          hasPlan: !!plan,
          transactionId: transaction._id,
          companyId: transaction.company,
          planId: transaction.plan,
        });
      }

      // Return success response to PayOS (required format)
      console.log('✅ Sending success response to PayOS...');
      res.status(200).json({
        code: 0,
        desc: 'OK',
        data: null,
      });
      console.log('✅ Response sent to PayOS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
    } catch (error: any) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('❌ PAYOS WEBHOOK ERROR');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      console.error('═══════════════════════════════════════════════════════════');
      // Always return success to PayOS to acknowledge receipt
      res.status(200).json({
        code: 0,
        desc: 'OK',
        data: null,
      });
      console.log('✅ Response sent to PayOS (error acknowledged)');
      console.log('');
    }
  }

  /**
   * Get payment status
   * Protected endpoint - Employer only
   */
  public static async getPaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { transactionId } = req.params;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Find company
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Find transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        company: company._id,
      }).populate('plan');

      if (!transaction) {
        errorResponse(res, 'Transaction not found', 404);
        return;
      }

      successResponse(res, {
        transaction: {
          id: transaction._id,
          orderId: transaction.orderId,
          amount: transaction.amount,
          status: transaction.status,
          description: transaction.description,
          plan: transaction.plan,
          paymentLink: transaction.paymentLink,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Get payment status error:', error);
      errorResponse(res, 'Failed to get payment status', 500);
    }
  }

  /**
   * Get all transactions for current company
   * Protected endpoint - Employer only
   */
  public static async getMyTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10, status } = req.query;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      // Find company
      const company = await Company.findOne({ user: userId });

      if (!company) {
        errorResponse(res, 'Company not found', 404);
        return;
      }

      // Build filter
      const filter: any = { company: company._id };
      if (status) {
        filter.status = status;
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Get transactions
      const transactions = await Transaction.find(filter)
        .populate('plan', 'name price type limit feature durationInDays')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      // Get total count
      const total = await Transaction.countDocuments(filter);
      const totalPages = Math.ceil(total / Number(limit));

      successResponse(res, {
        transactions,
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number(limit),
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1,
        },
      });
    } catch (error: any) {
      console.error('Get my transactions error:', error);
      errorResponse(res, 'Failed to get transactions', 500);
    }
  }
}

