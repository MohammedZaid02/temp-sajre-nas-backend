const mongoose = require('mongoose');

const mentorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  mentorKey: {
    type: String,
    required: true,
    unique: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  specialization: String,
  bio: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Vendor who created this mentor
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Mentor', mentorSchema);