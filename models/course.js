const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  category: { // New field
    type: String,
    required: true
  },
  level: { // New field
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'], // Example enum values
    default: 'Beginner'
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  duration: String, // This will now be duration in hours
  maxStudents: { // New field
    type: Number,
    default: 0
  },
  startDate: { // New field
    type: Date
  },
  endDate: { // New field
    type: Date
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', courseSchema);