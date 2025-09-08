const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const Course = require('./models/course');

// Connect to database
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.log('MongoDB connection error:', err);
  process.exit(1);
});

const createTestCourse = async () => {
  try {
    // Check if course with this ID already exists
    const existingCourse = await Course.findById('652a7771c81222a07011c111');
    
    if (existingCourse) {
      console.log('Test course already exists:', existingCourse.title);
      return;
    }

    // Create a new course with the specific ID that was failing
    const testCourse = new Course({
      _id: new mongoose.Types.ObjectId('652a7771c81222a07011c111'),
      title: 'Premium Web Development Course',
      description: 'Complete full-stack web development course with React, Node.js, and MongoDB',
      category: 'Web Development',
      level: 'Intermediate',
      price: 6999,
      discountPrice: 5999,
      duration: '40 hours',
      maxStudents: 50,
      isActive: true
    });

    await testCourse.save();
    console.log('Test course created successfully:', testCourse.title);
    
  } catch (error) {
    console.error('Error creating test course:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestCourse();
