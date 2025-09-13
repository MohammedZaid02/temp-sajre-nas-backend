const prisma = require('../config/database');
const { generateOTP } = require('./generatekeys');
const { sendOTPEmail } = require('./emailService');

const createAndSendOTP = async (email, type) => {
  try {
    // Delete any existing OTPs for this email
    await prisma.otp.deleteMany({ where: { email, type } });

    // Generate new OTP
    const otpCode = generateOTP();

    // Save OTP to database
    await prisma.otp.create({
      data: {
        email,
        otp: otpCode,
        type
      }
    });

    // Send OTP via email
    const emailSent = await sendOTPEmail(email, otpCode, type);

    if (!emailSent) {
      throw new Error('Failed to send OTP email');
    }

    return {
      success: true,
      message: 'OTP sent successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

const verifyOTP = async (email, otpCode, type) => {
  try {
    const otpRecord = await prisma.otp.findFirst({
      where: { email, type }
    });

    if (!otpRecord) {
      return {
        success: false,
        message: 'OTP not found or expired'
      };
    }

    const isMatch = otpRecord.otp === otpCode;

    if (!isMatch) {
      return {
        success: false,
        message: 'Invalid OTP'
      };
    }

    // Delete OTP after successful verification
    await prisma.otp.delete({ where: { id: otpRecord.id } });

    return {
      success: true,
      message: 'OTP verified successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: error.message
    };
  }
};

module.exports = {
  createAndSendOTP,
  verifyOTP
};