const express = require('express');
const {
  registerVendor,
  registerMentor,
  registerStudent,
  verifyOTPAndActivate,
  login
} = require('../controller/authController');

const router = express.Router();

router.post('/register/vendor', registerVendor);
router.post('/register/mentor', registerMentor);
router.post('/register/student', registerStudent);
router.post('/verify-otp', verifyOTPAndActivate);
router.post('/login', login);

module.exports = router;