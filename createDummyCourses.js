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

const createDummyCourses = async () => {
  try {
    // Clear existing courses first (optional)
    await Course.deleteMany({});
    console.log('Cleared existing courses');

    // Create the 5 dummy courses matching frontend
    const courses = [
      {
        title: 'Digital Marketing',
        description: 'Learn SEO, social media marketing, Google Ads, and strategies to grow businesses online. This course covers advanced SEO techniques, PPC strategies, and social media growth hacks. Perfect for entrepreneurs and marketers.',
        category: 'Marketing',
        level: 'Intermediate',
        price: 8999,
        discountPrice: 7199, // 20% OFF
        duration: '35 hours',
        maxStudents: 100,
        isActive: true
      },
      {
        title: 'Fashion Designing',
        description: 'Unleash your creativity with sketching, textile design, and modern fashion trends. Dive into the world of fashion design, garment making, and branding. Includes hands-on projects and portfolio development.',
        category: 'Design',
        level: 'Beginner',
        price: 12999,
        discountPrice: 9749, // 25% OFF
        duration: '45 hours',
        maxStudents: 50,
        isActive: true
      },
      {
        title: 'Web Designing',
        description: 'Master UI/UX design, responsive layouts, and front-end development for stunning websites. From HTML, CSS, and JavaScript to advanced responsive design and accessibility. Build stunning real-world projects.',
        category: 'Web Development',
        level: 'Intermediate',
        price: 9999,
        discountPrice: 8999, // 10% OFF
        duration: '40 hours',
        maxStudents: 80,
        isActive: true
      },
      {
        title: 'Cyber Security',
        description: 'Understand network security, penetration testing, and defense strategies against threats. Hands-on learning in threat detection, ethical hacking basics, and network defense. Includes lab simulations.',
        category: 'Security',
        level: 'Advanced',
        price: 15999,
        discountPrice: 13599, // 15% OFF
        duration: '50 hours',
        maxStudents: 40,
        isActive: true
      },
      {
        title: 'Ethical Hacking',
        description: 'Gain hands-on skills in ethical hacking, vulnerability analysis, and digital forensics. Learn to identify vulnerabilities, penetration testing methods, and safeguard systems ethically.',
        category: 'Security',
        level: 'Advanced',
        price: 18999,
        discountPrice: 13299, // 30% OFF
        duration: '60 hours',
        maxStudents: 30,
        isActive: true
      }
    ];

    const createdCourses = await Course.insertMany(courses);
    
    console.log('Successfully created 5 dummy courses:');
    createdCourses.forEach((course, index) => {
      console.log(`${index + 1}. ${course.title} (ID: ${course._id})`);
      console.log(`   Price: ₹${course.price} -> ₹${course.discountPrice}`);
    });
    
  } catch (error) {
    console.error('Error creating courses:', error);
  } finally {
    mongoose.connection.close();
  }
};

createDummyCourses();
