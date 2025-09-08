const express = require('express');
const {
  getDashboard,
  enrollInCourse,
  getEnrolledCourses,
  getAvailableCourses,
  dummyPayment
} = require('../controller/studentController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rolecheck');

const router = express.Router();

// Apply authentication and student authorization to all routes
router.use(protect);
router.use(authorize('student', 'admin'));

router.get('/dashboard', getDashboard);
router.post('/enroll/:courseId', enrollInCourse);
router.get('/courses', getEnrolledCourses);
router.get('/available-courses', getAvailableCourses);
router.post('/dummy-payment', dummyPayment);

module.exports = router;