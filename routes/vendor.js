const express = require('express');
const {
  getDashboard,
  createMentor,
  getMentors,
  getStudents,
  approveMentor,
  rejectMentor,
  suspendMentor
} = require('../controller/vendorController');
const { getAllCourses } = require('../controller/adminController'); // Import getAllCourses
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rolecheck');

const router = express.Router();

// Apply authentication and vendor authorization to all routes
router.use(protect);
router.use(authorize('VENDOR'));

router.get('/dashboard', getDashboard);
router.post('/create-mentor', createMentor);
router.get('/mentors', getMentors);
router.get('/students', getStudents);

// Mentor approval routes
router.put('/mentor/:id/approve', approveMentor);
router.put('/mentor/:id/reject', rejectMentor);
router.put('/mentor/:id/suspend', suspendMentor);

router.get('/courses', getAllCourses); // Add route for getting all courses

module.exports = router;
