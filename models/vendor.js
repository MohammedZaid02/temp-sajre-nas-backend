const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  vendorKey: {
    type: String,
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true
  },
  description: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin who created this vendor
    required: true
  },
    createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);