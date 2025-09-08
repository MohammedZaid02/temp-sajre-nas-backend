const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Vendor = require('../models/vendor');
const Mentor = require('../models/mentor');
const Student = require('../models/student');
const ReferralCode = require('../models/referralcode');
const { createAndSendOTP, verifyOTP } = require('../utils/otpService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register vendor with vendor key
// @route   POST /api/auth/register/vendor
// @access  Public
const registerVendor = async (req, res) => {
  try {
    const { name, email, password, phone, vendorKey } = req.body;

    // Check if vendor key exists and is not expired
    const vendor = await Vendor.findOne({ vendorKey });

    if (!vendor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor key'
      });
    }

    if (vendor.userId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor account already exists for this key'
      });
    }

    if (vendor.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vendor key has expired'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'vendor'
    });

    // Update vendor with userId
    vendor.userId = user._id;
    await vendor.save();

    // Send OTP for email verification
    await createAndSendOTP(email, 'registration');

    res.status(201).json({
      success: true,
      message: 'Vendor registered successfully. Please verify your email with OTP.',
      userId: user._id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register mentor with mentor key
// @route   POST /api/auth/register/mentor
// @access  Public
const registerMentor = async (req, res) => {
  try {
    const { name, email, password, phone, mentorKey, specialization, bio } = req.body;

    // Check if mentor key exists
    const mentor = await Mentor.findOne({ mentorKey });
    if (!mentor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mentor key'
      });
    }

    // Check if mentor already has a user account
    if (mentor.userId) {
      return res.status(400).json({
        success: false,
        message: 'Mentor account already exists for this key'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'mentor'
    });

    // Update mentor with userId
    mentor.userId = user._id;
    mentor.specialization = specialization;
    mentor.bio = bio;
    await mentor.save();

    // Send OTP for email verification
    await createAndSendOTP(email, 'registration');

    res.status(201).json({
      success: true,
      message: 'Mentor registered successfully. Please verify your email with OTP.',
      userId: user._id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register student with referral code
// @route   POST /api/auth/register/student
// @access  Public
const registerStudent = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body;

    // Check if referral code exists and is active
    const referral = await ReferralCode.findOne({ 
      code: referralCode, 
      isActive: true 
    });
    
    if (!referral) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive referral code'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'student'
    });

    // Create student record
    const student = await Student.create({
      userId: user._id,
      mentorId: referral.mentorId,
      referralCode: referralCode
    });

    // Update referral code usage
    referral.usageCount += 1;
    await referral.save();

    // Send OTP for email verification
    await createAndSendOTP(email, 'registration');

    res.status(201).json({
      success: true,
      message: 'Student registered successfully. Please verify your email with OTP.',
      userId: user._id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify OTP and activate account
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTPAndActivate = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Verify OTP
    const otpResult = await verifyOTP(email, otp, 'registration');
    
    if (!otpResult.success) {
      return res.status(400).json(otpResult);
    }

    // Find and activate user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = true;
    user.isEmailVerified = true;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');

    // Check if this is admin login first
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      // Find or create admin user
      let admin = await User.findOne({ email, role: 'admin' });
      
      if (!admin) {
        // Create admin user if doesn't exist
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        admin = await User.create({
          name: 'Platform Admin',
          email,
          password: hashedPassword,
          role: 'admin',
          isActive: true,
          isEmailVerified: true
        });
      }

      // Generate token
      const token = generateToken(admin._id);

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please verify your email.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // For students, add isEnrolled status to the response
    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id });
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEnrolled: student ? student.isEnrolled : false
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  registerVendor,
  registerMentor,
  registerStudent,
  verifyOTPAndActivate,
  login
};

// Dev-only: force activate a user (protected by ADMIN_PASSWORD). Not for production use.
const forceActivate = async (req, res) => {
  try {
    const { email, adminPassword } = req.body;

    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Forbidden in production' });
    }

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Invalid admin password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = true;
    user.isEmailVerified = true;
    await user.save();

    return res.status(200).json({ success: true, message: 'User activated', userId: user._id });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// export dev helper
module.exports.forceActivate = forceActivate;