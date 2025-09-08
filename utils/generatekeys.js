const crypto = require('crypto');

const generateVendorKey = () => {
  return 'VND_' + crypto.randomBytes(8).toString('hex').toUpperCase();
};

const generateMentorKey = () => {
  return 'MNT_' + crypto.randomBytes(8).toString('hex').toUpperCase();
};

const generateReferralCode = (mentorName, mentorId) => {
  // Clean the mentor name (remove spaces and special characters)
  const cleanName = mentorName.replace(/[^a-zA-Z0-9]/g, '');
  
  // Get first 3 characters of mentor name, or pad with 'X' if too short
  const namePrefix = (cleanName.substring(0, 3) + 'XXX').substring(0, 3).toUpperCase();
  
  // Get last 3 characters of mentorId
  const idSuffix = mentorId.toString().slice(-3).toUpperCase();
  
  // Generate 4 random characters
  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  // Current timestamp in milliseconds, last 3 digits
  const timestamp = Date.now().toString().slice(-3);
  
  // Combine all parts: NAME_ID_RANDOM_TIME
  return `${namePrefix}${idSuffix}${randomPart}${timestamp}`;
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  generateVendorKey,
  generateMentorKey,
  generateReferralCode,
  generateOTP
};