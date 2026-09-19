/**
 * Aarogya Date & Time Utilities
 * All time operations use IST (Asia/Kolkata UTC+05:30)
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get today's date string in YYYY-MM-DD format in IST
 */
const getTodayIST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // en-CA gives YYYY-MM-DD
};

/**
 * Format a Date object to IST time string (HH:MM AM/PM)
 */
const toISTTimeString = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE
  });
};

/**
 * Format a Date object to full IST datetime string
 */
const toISTDateTimeString = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE
  });
};

/**
 * Get elapsed minutes since a given date (e.g., consultation started)
 */
const getElapsedMinutes = (startDate) => {
  if (!startDate) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 60000));
};

/**
 * Add minutes to a date
 */
const addMinutes = (date, minutes) => {
  return new Date(new Date(date).getTime() + minutes * 60000);
};

/**
 * Check if a date is in the past
 */
const isPast = (date) => {
  return date && new Date(date).getTime() < Date.now();
};

/**
 * Get the upcoming N-minute boundary rounded timestamp (e.g., next 5 min mark)
 */
const roundToNextNMinutes = (n = 5) => {
  const now = Date.now();
  return new Date(Math.ceil(now / (n * 60000)) * (n * 60000));
};

module.exports = {
  TIMEZONE,
  getTodayIST,
  toISTTimeString,
  toISTDateTimeString,
  getElapsedMinutes,
  addMinutes,
  isPast,
  roundToNextNMinutes
};
