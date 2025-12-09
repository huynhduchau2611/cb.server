/**
 * Fraud detection utility
 * Checks for suspicious/scam content in job postings
 */

// List of suspicious keywords and phrases that indicate potential fraud
const FRAUD_KEYWORDS = [
  // Money-related scams
  'đầu tư',
  'đầu tư online',
  'làm giàu nhanh',
  'kiếm tiền online',
  'kiếm tiền tại nhà',
  'thu nhập thụ động',
  'lương cao không cần kinh nghiệm',
  'lương triệu đô',
  'nhận tiền trước',
  'đóng phí',
  'phí đăng ký',
  'phí ứng tuyển',
  'phí tuyển dụng',
  'phí tham gia',
  'đặt cọc',
  'tiền cọc',
  'tiền bảo lãnh',
  
  // MLM/Pyramid schemes
  'bán hàng đa cấp',
  'kinh doanh đa cấp',
  'tuyển dụng đa cấp',
  'nhà phân phối',
  'đại lý',
  'cộng tác viên bán hàng',
  'tuyển cộng tác viên',
  
  // Suspicious job offers
  'không cần kinh nghiệm',
  'không cần bằng cấp',
  'làm tại nhà',
  'làm online',
  'thời gian linh hoạt',
  'lương thưởng cao',
  'thu nhập không giới hạn',
  'cơ hội làm giàu',
  
  // Phishing/Identity theft
  'cung cấp thông tin cá nhân',
  'gửi cmnd',
  'gửi căn cước',
  'gửi thẻ ngân hàng',
  'gửi mã otp',
  'xác minh tài khoản',
  'xác minh danh tính',
  
  // Cryptocurrency scams
  'bitcoin',
  'crypto',
  'tiền ảo',
  'đào coin',
  'trading',
  'forex',
  'chứng khoán',
  
  // Other suspicious terms
  'làm việc nước ngoài',
  'xuất khẩu lao động',
  'du học',
  'vừa học vừa làm',
  'tuyển gấp',
  'cần gấp',
  'không cần phỏng vấn',
  'nhận việc ngay',
];

/**
 * Check if text contains fraud keywords
 * @param text - Text to check
 * @returns Object with isFraud flag and matched keywords
 */
export function detectFraudContent(text: string): {
  isFraud: boolean;
  matchedKeywords: string[];
} {
  if (!text || typeof text !== 'string') {
    return { isFraud: false, matchedKeywords: [] };
  }

  const normalizedText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchedKeywords: string[] = [];

  for (const keyword of FRAUD_KEYWORDS) {
    const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedText.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);
    }
  }

  return {
    isFraud: matchedKeywords.length > 0,
    matchedKeywords,
  };
}

/**
 * Check multiple fields for fraud content
 * @param fields - Object with field names and their values
 * @returns Object with isFraud flag, matched fields, and all matched keywords
 */
export function checkJobPostingForFraud(fields: {
  title?: string;
  description?: string;
  techStack?: string[];
  [key: string]: any;
}): {
  isFraud: boolean;
  matchedFields: Record<string, string[]>;
  allMatchedKeywords: string[];
} {
  const matchedFields: Record<string, string[]> = {};
  const allMatchedKeywords: string[] = [];

  // Check title
  if (fields.title) {
    const titleCheck = detectFraudContent(fields.title);
    if (titleCheck.isFraud) {
      matchedFields.title = titleCheck.matchedKeywords;
      allMatchedKeywords.push(...titleCheck.matchedKeywords);
    }
  }

  // Check description
  if (fields.description) {
    const descCheck = detectFraudContent(fields.description);
    if (descCheck.isFraud) {
      matchedFields.description = descCheck.matchedKeywords;
      allMatchedKeywords.push(...descCheck.matchedKeywords);
    }
  }

  // Check techStack (array of strings)
  if (fields.techStack && Array.isArray(fields.techStack)) {
    const techStackText = fields.techStack.join(' ');
    const techCheck = detectFraudContent(techStackText);
    if (techCheck.isFraud) {
      matchedFields.techStack = techCheck.matchedKeywords;
      allMatchedKeywords.push(...techCheck.matchedKeywords);
    }
  }

  // Check other string fields
  Object.keys(fields).forEach((key) => {
    if (key !== 'title' && key !== 'description' && key !== 'techStack') {
      const value = fields[key];
      if (typeof value === 'string' && value.trim()) {
        const fieldCheck = detectFraudContent(value);
        if (fieldCheck.isFraud) {
          matchedFields[key] = fieldCheck.matchedKeywords;
          allMatchedKeywords.push(...fieldCheck.matchedKeywords);
        }
      }
    }
  });

  // Remove duplicates from allMatchedKeywords
  const uniqueKeywords = Array.from(new Set(allMatchedKeywords));

  return {
    isFraud: uniqueKeywords.length > 0,
    matchedFields,
    allMatchedKeywords: uniqueKeywords,
  };
}

