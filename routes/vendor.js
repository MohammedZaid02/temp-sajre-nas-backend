const express = require('express');
const {
  getDashboard,
  createMentor,
  getMentors,
  getStudents
} = require('../controller/vendorController');
const { getAllCourses } = require('../controller/adminController'); // Import getAllCourses
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rolecheck');

const router = express.Router();

// Apply authentication and vendor authorization to all routes
router.use(protect);
router.use(authorize('vendor'));

router.get('/dashboard', getDashboard);
router.post('/create-mentor', createMentor);
router.get('/mentors', getMentors);
router.get('/students', getStudents);

router.get('/courses', getAllCourses); // Add route for getting all courses

module.exports = router;
