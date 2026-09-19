/**
 * Aarogya Input Validation Utilities
 * Lightweight validation helpers for request bodies
 */

/**
 * Validate an Indian mobile phone number (10 digits starting with 6-9)
 */
const isValidIndianPhone = (phone) => {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Validate an ABHA (Ayushman Bharat Health Account) number (14 digits)
 */
const isValidAbhaNumber = (abha) => {
  if (!abha) return false;
  const cleaned = String(abha).replace(/\D/g, '');
  return cleaned.length === 14;
};

/**
 * Validate MongoDB ObjectId format
 */
const isValidObjectId = (id) => {
  return /^[a-f\d]{24}$/i.test(String(id || ''));
};

/**
 * Validate a date string in YYYY-MM-DD format
 */
const isValidDateString = (date) => {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && !isNaN(new Date(date).getTime());
};

/**
 * Sanitize and trim a string value
 */
const sanitizeString = (value, maxLength = 500) => {
  if (!value) return '';
  return String(value).trim().substring(0, maxLength);
};

/**
 * Validate a token number format (alphanumeric, 1-20 chars)
 */
const isValidTokenNumber = (tokenNum) => {
  if (!tokenNum) return false;
  return /^[A-Z0-9\-]{1,20}$/i.test(String(tokenNum).trim());
};

/**
 * Validate required fields exist in a request body object
 * Returns array of missing field names
 */
const validateRequired = (body, requiredFields) => {
  const missing = [];
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  return missing;
};

module.exports = {
  isValidIndianPhone,
  isValidAbhaNumber,
  isValidObjectId,
  isValidDateString,
  sanitizeString,
  isValidTokenNumber,
  validateRequired
};
