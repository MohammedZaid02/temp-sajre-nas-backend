const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
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
  pricePaid: {
    type: Number,
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  referralCodeUsed: {
    type: String,
    required: false
  },
  referredByMentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentor',
    required: false
  }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);