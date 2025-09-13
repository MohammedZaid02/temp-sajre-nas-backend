const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const { createAndSendOTP, verifyOTP } = require('../utils/otpService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register vendor with or without vendor key
// @route   POST /api/auth/register/vendor
// @access  Public
const registerVendor = async (req, res) => {
  try {
    const { name, email, password, phone, vendorKey } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'VENDOR'
      }
    });

    let vendor;
    let status = 'PENDING';
    let message = 'Vendor registered successfully. Please verify your email with OTP. Your account is pending admin approval.';

    if (vendorKey) {
      // Check if vendor key exists and is not expired
      vendor = await prisma.vendor.findUnique({ where: { vendorKey } });

      if (vendor && !vendor.userId && (!vendor.expiresAt || vendor.expiresAt > new Date())) {
        // Valid vendor key - auto approve
        status = 'APPROVED';
        message = 'Vendor registered successfully with valid key. Please verify your email with OTP.';
        
        // Update existing vendor with userId
        vendor = await prisma.vendor.update({
          where: { id: vendor.id },
          data: { 
            userId: user.id,
            status: 'APPROVED',
            approvedBy: 'SYSTEM',
            approvedAt: new Date()
          }
        });
      } else {
        // Invalid or expired vendor key - create new vendor record
        const { generateVendorKey } = require('../utils/generatekeys');
        let newVendorKey;
        let keyExists = true;

        while (keyExists) {
          newVendorKey = generateVendorKey();
          const existingVendor = await prisma.vendor.findFirst({ where: { vendorKey: newVendorKey } });
          keyExists = !!existingVendor;
        }

        vendor = await prisma.vendor.create({
          data: {
            vendorKey: newVendorKey,
            companyName: `${name}'s Company`,
            description: 'Self-registered vendor',
            createdBy: user.id, // Self-created
            userId: user.id,
            status: 'PENDING'
          }
        });
      }
    } else {
      // No vendor key provided - create new vendor record for approval
      const { generateVendorKey } = require('../utils/generatekeys');
      let newVendorKey;
      let keyExists = true;

      while (keyExists) {
        newVendorKey = generateVendorKey();
        const existingVendor = await prisma.vendor.findFirst({ where: { vendorKey: newVendorKey } });
        keyExists = !!existingVendor;
      }

      vendor = await prisma.vendor.create({
        data: {
          vendorKey: newVendorKey,
          companyName: `${name}'s Company`,
          description: 'Self-registered vendor',
          createdBy: user.id, // Self-created
          userId: user.id,
          status: 'PENDING'
        }
      });
    }

    // Send OTP for email verification
    await createAndSendOTP(email, 'REGISTRATION');

    res.status(201).json({
      success: true,
      message,
      userId: user.id,
      vendorStatus: status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Register mentor with or without mentor key
// @route   POST /api/auth/register/mentor
// @access  Public
const registerMentor = async (req, res) => {
  try {
    const { name, email, password, phone, mentorKey, specialization, bio } = req.body;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'MENTOR'
      }
    });

    let mentor;
    let status = 'PENDING';
    let message = 'Mentor registered successfully. Please verify your email with OTP. Your account is pending vendor approval.';

    if (mentorKey) {
      // Check if mentor key exists
      mentor = await prisma.mentor.findUnique({ where: { mentorKey } });
      
      if (mentor && !mentor.userId) {
        // Valid mentor key - auto approve
        status = 'APPROVED';
        message = 'Mentor registered successfully with valid key. Please verify your email with OTP.';
        
        // Update existing mentor with userId
        mentor = await prisma.mentor.update({
          where: { id: mentor.id },
          data: {
            userId: user.id,
            specialization,
            bio,
            status: 'APPROVED',
            approvedBy: 'SYSTEM',
            approvedAt: new Date()
          }
        });
      } else {
        // Invalid mentor key - create new mentor record
        const { generateMentorKey } = require('../utils/generatekeys');
        let newMentorKey;
        let keyExists = true;

        while (keyExists) {
          newMentorKey = generateMentorKey();
          const existingMentor = await prisma.mentor.findFirst({ where: { mentorKey: newMentorKey } });
          keyExists = !!existingMentor;
        }

        // Find a default vendor or create one
        let defaultVendor = await prisma.vendor.findFirst({ where: { status: 'APPROVED' } });
        if (!defaultVendor) {
          // Create a default vendor for self-registered mentors
          const { generateVendorKey } = require('../utils/generatekeys');
          let vendorKey;
          let vendorKeyExists = true;

          while (vendorKeyExists) {
            vendorKey = generateVendorKey();
            const existingVendor = await prisma.vendor.findFirst({ where: { vendorKey } });
            vendorKeyExists = !!existingVendor;
          }

          defaultVendor = await prisma.vendor.create({
            data: {
              vendorKey,
              companyName: 'Default Company',
              description: 'Default vendor for self-registered mentors',
              createdBy: user.id,
              status: 'APPROVED',
              approvedBy: 'SYSTEM',
              approvedAt: new Date()
            }
          });
        }

        mentor = await prisma.mentor.create({
          data: {
            mentorKey: newMentorKey,
            vendorId: defaultVendor.id,
            createdBy: user.id,
            userId: user.id,
            specialization,
            bio,
            status: 'PENDING'
          }
        });
      }
    } else {
      // No mentor key provided - create new mentor record for approval
      const { generateMentorKey } = require('../utils/generatekeys');
      let newMentorKey;
      let keyExists = true;

      while (keyExists) {
        newMentorKey = generateMentorKey();
        const existingMentor = await prisma.mentor.findFirst({ where: { mentorKey: newMentorKey } });
        keyExists = !!existingMentor;
      }

      // Find a default vendor or create one
      let defaultVendor = await prisma.vendor.findFirst({ where: { status: 'APPROVED' } });
      if (!defaultVendor) {
        // Create a default vendor for self-registered mentors
        const { generateVendorKey } = require('../utils/generatekeys');
        let vendorKey;
        let vendorKeyExists = true;

        while (vendorKeyExists) {
          vendorKey = generateVendorKey();
          const existingVendor = await prisma.vendor.findFirst({ where: { vendorKey } });
          vendorKeyExists = !!existingVendor;
        }

        defaultVendor = await prisma.vendor.create({
          data: {
            vendorKey,
            companyName: 'Default Company',
            description: 'Default vendor for self-registered mentors',
            createdBy: user.id,
            status: 'APPROVED',
            approvedBy: 'SYSTEM',
            approvedAt: new Date()
          }
        });
      }

      mentor = await prisma.mentor.create({
        data: {
          mentorKey: newMentorKey,
          vendorId: defaultVendor.id,
          createdBy: user.id,
          userId: user.id,
          specialization,
          bio,
          status: 'PENDING'
        }
      });
    }

    // Send OTP for email verification
    await createAndSendOTP(email, 'REGISTRATION');

    res.status(201).json({
      success: true,
      message,
      userId: user.id,
      mentorStatus: status
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
    const referral = await prisma.referralCode.findFirst({
      where: {
        code: referralCode,
        isActive: true
      }
    });

    if (!referral) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive referral code'
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'STUDENT'
      }
    });

    // Create student record
    await prisma.student.create({
      data: {
        userId: user.id,
        mentorId: referral.mentorId,
        referralCode: referralCode
      }
    });

    // Update referral code usage
    await prisma.referralCode.update({
      where: { id: referral.id },
      data: { usageCount: { increment: 1 } }
    });

    // Send OTP for email verification
    await createAndSendOTP(email, 'REGISTRATION');

    res.status(201).json({
      success: true,
      message: 'Student registered successfully. Please verify your email with OTP.',
      userId: user.id
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
    const otpResult = await verifyOTP(email, otp, 'REGISTRATION');

    if (!otpResult.success) {
      return res.status(400).json(otpResult);
    }

    // Find and activate user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, isEmailVerified: true }
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
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

    // Check if this is admin login first - check Admin table
    const admin = await prisma.admin.findUnique({ 
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        isActive: true,
        isEmailVerified: true
      }
    });

    if (admin) {
      // Check if admin is active
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Admin account is not active'
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login time
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() }
      });

      // Generate token
      const token = generateToken(admin.id);

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'ADMIN'
        }
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
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
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    // For students, add isEnrolled status to the response
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({ where: { userId: user.id } });
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
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
        id: user.id,
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