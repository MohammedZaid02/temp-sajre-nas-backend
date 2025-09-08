const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'wallet', 'netbanking'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'success' // For dummy payments, always success
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  paymentGateway: {
    type: String,
    default: 'dummy' // Indicates this is a dummy payment
  },
  paymentDetails: {
    // Store payment method specific details
    cardNumber: String, // Last 4 digits only for security
    upiId: String,
    walletName: String,
    bankName: String,
    cardHolderName: String
  },
  referralCodeUsed: {
    type: String,
    required: false
  },
  referredByMentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: false
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate transaction ID
paymentSchema.pre('save', function(next) {
  if (!this.transactionId) {
    this.transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
