const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['registration', 'login', 'password_reset'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // OTP expires in 10 minutes
  }
});

// Hash OTP before saving
otpSchema.pre('save', async function(next) {
  if (!this.isModified('otp')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.otp = await bcrypt.hash(this.otp, salt);
});

// Match OTP
otpSchema.methods.matchOTP = async function(enteredOTP) {
  return await bcrypt.compare(enteredOTP, this.otp);
};

module.exports = mongoose.model('OTP', otpSchema);