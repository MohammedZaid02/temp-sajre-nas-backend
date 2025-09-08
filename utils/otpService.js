const OTP = require('../models/otp');
const { generateOTP } = require('./generatekeys');
const { sendOTPEmail } = require('./emailService');

const createAndSendOTP = async (email, type) => {
  try {
    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email, type });

    // Generate new OTP
    const otpCode = generateOTP();

    // Save OTP to database
    const otp = new OTP({
      email,
      otp: otpCode,
      type
    });
    await otp.save();

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
    const otpRecord = await OTP.findOne({ email, type });

    if (!otpRecord) {
      return {
        success: false,
        message: 'OTP not found or expired'
      };
    }

    const isMatch = await otpRecord.matchOTP(otpCode);

    if (!isMatch) {
      return {
        success: false,
        message: 'Invalid OTP'
      };
    }

    // Delete OTP after successful verification
    await OTP.deleteOne({ _id: otpRecord._id });

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
