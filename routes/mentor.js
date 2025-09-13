const express = require('express');
const {
  getDashboard,
  createReferralCode,
  getReferralCodes,
  getStudents,
  deactivateReferralCode,
  getMentorEnrollments,
  getRecentActivities,
  getMentorCourses
} = require('../controller/mentorController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rolecheck');

const router = express.Router();

// Apply authentication and mentor authorization to all routes
router.use(protect);
router.use(authorize('MENTOR'));

router.get('/dashboard', getDashboard);
router.post('/create-referral-code', createReferralCode);
router.get('/referral-codes', getReferralCodes);
router.get('/students', getStudents);
router.put('/referral-code/:id/deactivate', deactivateReferralCode);

router.get('/courses', getMentorCourses); // Route for getting mentor's courses
router.get('/enrollments', getMentorEnrollments); // Route for mentor enrollments
router.get('/recent-activities', getRecentActivities); // Route for recent activities

module.exports = router;