const express = require('express');
const {
  adminLogin,
  getDashboard,
  createVendor,
  getAllVendors,
  approveVendor,
  rejectVendor,
  suspendVendor,
  updateVendor,
  deleteVendor,
  getAllMentors,
  updateMentor,
  deleteMentor,
  getAllStudents,
  updateStudent,
  deleteStudent,
  generateReferralCode,
  createCourse,
  getAllCourses,
  updateCourse,
  deleteCourse,
  getAllEnrollments,
  deleteEnrollment,
  updateEnrollment
} = require('../controller/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rolecheck');

const router = express.Router();

// Public route for admin login
router.post('/login', adminLogin);

// Protected routes
router.use(protect);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboard);

// Vendor routes
router.post('/create-vendor', createVendor);
router.get('/vendors', getAllVendors);
router.put('/vendor/:id/approve', approveVendor);
router.put('/vendor/:id/reject', rejectVendor);
router.put('/vendor/:id/suspend', suspendVendor);
router.put('/vendor/:id', updateVendor);
router.delete('/vendor/:id', deleteVendor);

// Mentor routes
router.get('/mentors', getAllMentors);
router.put('/mentor/:id', updateMentor);
router.delete('/mentor/:id', deleteMentor);

// Student routes
router.get('/students', getAllStudents);
router.put('/student/:id', updateStudent);
router.delete('/student/:id', deleteStudent);

// Course routes
router.post('/create-course', createCourse);
router.get('/courses', getAllCourses);
router.put('/course/:id', updateCourse);
router.delete('/course/:id', deleteCourse);

router.get('/enrollments', getAllEnrollments);
router.delete('/enrollment/:id', deleteEnrollment);
router.put('/enrollment/:id', updateEnrollment);

router.post('/referral/generate', generateReferralCode);

module.exports = router;