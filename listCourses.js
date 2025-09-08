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

const listCourses = async () => {
  try {
    const courses = await Course.find({});
    console.log(`Found ${courses.length} courses:`);
    courses.forEach((course, index) => {
      console.log(`${index + 1}. ID: ${course._id}`);
      console.log(`   Title: ${course.title}`);
      console.log(`   Price: ₹${course.price}`);
      console.log(`   Discount Price: ₹${course.discountPrice || 'None'}`);
      console.log(`   Active: ${course.isActive}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error listing courses:', error);
  } finally {
    mongoose.connection.close();
  }
};

listCourses();
