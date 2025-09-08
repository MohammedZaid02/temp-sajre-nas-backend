const User = require('../models/user');
const Vendor = require('../models/vendor');
const Mentor = require('../models/mentor');
const Student = require('../models/student');
const Course = require('../models/course');
const Enrollment = require('../models/enrollment');
const ReferralCode = require('../models/referralcode');
const { generateVendorKey } = require('../utils/generatekeys');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Admin Login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if matches environment variables
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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

    res.status(200).json({
      success: true,
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboard = async (req, res) => {
  try {
    // Get counts
    const totalVendors = await Vendor.countDocuments();
    const totalMentors = await Mentor.countDocuments();
    const totalStudents = await Student.countDocuments();
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await Enrollment.countDocuments();
    
    // Get registered vs enrolled students
    const registeredStudents = await Student.countDocuments({ isEnrolled: false });
    const enrolledStudents = await Student.countDocuments({ isEnrolled: true });

    // Get recent activities
    const recentVendors = await Vendor.find()
      .populate('userId', 'name email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentMentors = await Mentor.find()
      .populate('userId', 'name email')
      .populate('vendorId', 'companyName')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentStudents = await Student.find()
      .populate('userId', 'name email')
      .populate({
        path: 'mentorId',
        populate: {
          path: 'userId',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .limit(5);

    // Revenue data (total)
    const totalRevenue = await Enrollment.aggregate([
      { $group: { _id: null, total: { $sum: '$pricePaid' } } }
    ]);

    // --- Dynamic Data for Charts (Last 4 Days) ---
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // Daily Revenue
    const dailyRevenue = await Enrollment.aggregate([
      { $match: { createdAt: { $gte: fourDaysAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Daily Users (all roles combined)
    const dailyUsers = await User.aggregate([
      { $match: { createdAt: { $gte: fourDaysAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Daily Courses
    const dailyCourses = await Course.aggregate([
      { $match: { createdAt: { $gte: fourDaysAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Format data for frontend (fill in missing days with 0)
    const formattedAnalyticsData = [];
    let currentDate = new Date(fourDaysAgo.getFullYear(), fourDaysAgo.getMonth(), fourDaysAgo.getDate());

    for (let i = 0; i < 5; i++) { // Loop for 5 days (today + last 4 days)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // Month is 1-indexed
      const day = currentDate.getDate();

      const revenueEntry = dailyRevenue.find(item => item._id.year === year && item._id.month === month && item._id.day === day);
      const usersEntry = dailyUsers.find(item => item._id.year === year && item._id.month === month && item._id.day === day);
      const coursesEntry = dailyCourses.find(item => item._id.year === year && item._id.month === month && item._id.day === day);

      formattedAnalyticsData.push({
        name: `${month}/${day}`, // e.g., 09/04
        revenue: revenueEntry ? revenueEntry.totalRevenue : 0,
        users: usersEntry ? usersEntry.count : 0,
        courses: coursesEntry ? coursesEntry.count : 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }


    res.status(200).json({
      success: true,
      data: {
        counts: {
          totalVendors,
          totalMentors,
          totalStudents,
          totalCourses,
          totalEnrollments,
          registeredStudents,
          enrolledStudents
        },
        recentActivities: {
          vendors: recentVendors,
          mentors: recentMentors,
          students: recentStudents
        },
        revenue: totalRevenue[0]?.total || 0,
        analyticsData: formattedAnalyticsData // Add formatted analytics data
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Internal helper to generate a referral code
const generateReferralCodeInternal = async (vendorId, maxUsage) => {
  try {
    // Check if vendor exists (optional, as it should be called after vendor creation)
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      console.error(`Referral code generation failed: Vendor with ID ${vendorId} not found.`);
      return null;
    }

    // Generate unique referral code
    let referralCode;
    let codeExists = true;

    while (codeExists) {
      referralCode = generateVendorKey(); // Using vendor key generation for simplicity
      const existingCode = await ReferralCode.findOne({ code: referralCode });
      codeExists = !!existingCode;
    }

    // Create new referral code
    const newReferralCode = await ReferralCode.create({
      code: referralCode,
      vendorId,
      maxUsage
    });

    return newReferralCode;

  } catch (error) {
    console.error('Error generating referral code internally:', error);
    return null;
  }
};

// @desc    Create vendor
// @route   POST /api/admin/create-vendor
// @access  Private/Admin
const createVendor = async (req, res) => {
  try {
    const { companyName, description } = req.body;

    // Generate unique vendor key
    let vendorKey;
    let keyExists = true;

    while (keyExists) {
      vendorKey = generateVendorKey();
      const existingVendor = await Vendor.findOne({ vendorKey });
      keyExists = !!existingVendor;
    }

    // Create vendor record (without userId initially)
    const vendor = await Vendor.create({
      vendorKey,
      companyName,
      description,
      createdBy: req.user._id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });

    // Automatically generate a referral code for the new vendor
    const defaultMaxUsage = 10; // You can make this configurable if needed
    const newReferralCode = await generateReferralCodeInternal(vendor._id, defaultMaxUsage);

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        vendorKey,
        companyName,
        description,
        message: 'Share this vendor key with the vendor for registration',
        referralCode: newReferralCode ? newReferralCode.code : null // Include the generated referral code
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all vendors
// @route   GET /api/admin/vendors
// @access  Private/Admin
const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find()
      .populate('userId', 'name email isActive createdAt')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get mentor counts for each vendor
    const vendorsWithCounts = await Promise.all(
      vendors.map(async (vendor) => {
        const mentorCount = await Mentor.countDocuments({ vendorId: vendor._id });
        const studentCount = await Student.aggregate([
          {
            $lookup: {
              from: 'mentors',
              localField: 'mentorId',
              foreignField: '_id',
              as: 'mentor'
            }
          },
          {
            $match: {
              'mentor.vendorId': vendor._id
            }
          },
          {
            $count: 'total'
          }
        ]);

        return {
          ...vendor.toObject(),
          mentorCount,
          studentCount: studentCount[0]?.total || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: vendorsWithCounts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update vendor
// @route   PUT /api/admin/vendor/:id
// @access  Private/Admin
const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (req.body.isActive !== undefined && vendor.userId) {
      await User.findByIdAndUpdate(vendor.userId, { isActive: req.body.isActive });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor updated successfully',
      data: vendor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete vendor
// @route   DELETE /api/admin/vendor/:id
// @access  Private/Admin
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Optional: Add logic to handle related mentors, students, courses, etc.
    // For example, you might want to delete them or reassign them.
    // For now, we'll just delete the vendor and their user account.

    if (vendor.userId) {
      await User.findByIdAndDelete(vendor.userId);
    }
    await vendor.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all mentors
// @route   GET /api/admin/mentors
// @access  Private/Admin
const getAllMentors = async (req, res) => {
  try {
    const mentors = await Mentor.find()
      .populate('userId', 'name email isActive createdAt')
      .populate('vendorId', 'companyName')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get student counts for each mentor
    const mentorsWithCounts = await Promise.all(
      mentors.map(async (mentor) => {
        const studentCount = await Student.countDocuments({ mentorId: mentor._id });
        const enrolledCount = await Student.countDocuments({ 
          mentorId: mentor._id, 
          isEnrolled: true 
        });

        return {
          ...mentor.toObject(),
          studentCount,
          enrolledCount,
          registeredCount: studentCount - enrolledCount
        };
      })
    );

    res.status(200).json({
      success: true,
      data: mentorsWithCounts
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update mentor
// @route   PUT /api/admin/mentor/:id
// @access  Private/Admin
const updateMentor = async (req, res) => {
  try {
    const mentor = await Mentor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    if (req.body.isActive !== undefined && mentor.userId) {
      await User.findByIdAndUpdate(mentor.userId, { isActive: req.body.isActive });
    }

    res.status(200).json({
      success: true,
      message: 'Mentor updated successfully',
      data: mentor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete mentor
// @route   DELETE /api/admin/mentor/:id
// @access  Private/Admin
const deleteMentor = async (req, res) => {
  try {
    const mentor = await Mentor.findById(req.params.id);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    if (mentor.userId) {
      await User.findByIdAndDelete(mentor.userId);
    }
    await mentor.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Mentor deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private/Admin
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate('userId', 'name email isActive createdAt')
      .populate({
        path: 'mentorId',
        populate: [
          { path: 'userId', select: 'name' },
          { path: 'vendorId', select: 'companyName' }
        ]
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: students
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update student
// @route   PUT /api/admin/student/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (req.body.isActive !== undefined && student.userId) {
      await User.findByIdAndUpdate(student.userId, { isActive: req.body.isActive });
    }

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/admin/student/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (student.userId) {
      await User.findByIdAndDelete(student.userId);
    }
    await student.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// @desc    Generate referral code for a vendor
// @route   POST /api/admin/referral/generate
// @access  Private/Admin
const generateReferralCode = async (req, res) => {
  try {
    const { vendorId, maxUsage } = req.body;

    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const newReferralCode = await generateReferralCodeInternal(vendorId, maxUsage);

    if (newReferralCode) {
      res.status(201).json({
        success: true,
        message: 'Referral code generated successfully',
        data: newReferralCode
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate referral code.'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create course
// @route   POST /api/admin/create-course
// @access  Private/Admin
const createCourse = async (req, res) => {
  try {
    const { title, description, price, discountPrice, duration, vendorId, category, level, maxStudents, startDate, endDate } = req.body;

    console.log('createCourse - req.body:', req.body); // Debugging line
    console.log('createCourse - vendorId:', vendorId); // Debugging line

    const course = await Course.create({
      title,
      description,
      price,
      discountPrice,
      duration,
      vendorId: vendorId || null, // Set to null if not provided
      category,
      level,
      maxStudents,
      startDate,
      endDate
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all courses
// @route   GET /api/admin/courses
// @access  Private/Admin
const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('vendorId', 'companyName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: courses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update course
// @route   PUT /api/admin/course/:id
// @access  Private/Admin
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete course
// @route   DELETE /api/admin/course/:id
// @access  Private/Admin
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await course.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete enrollment
// @route   DELETE /api/admin/enrollment/:id
// @access  Private/Admin
const deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Enrollment deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update enrollment
// @route   PUT /api/admin/enrollment/:id
// @access  Private/Admin
const updateEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Enrollment updated successfully',
      data: enrollment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all enrollments
// @route   GET /api/admin/enrollments
// @access  Private/Admin
const getAllEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate({ path: 'studentId', populate: { path: 'userId', select: 'name email' } })
      .populate('courseId', 'title')
      .populate({ path: 'mentorId', populate: { path: 'userId', select: 'name' } })
      .populate('vendorId', 'companyName');

    res.status(200).json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching enrollments',
      error: error.message
    });
  }
};

module.exports = {
  adminLogin,
  getDashboard,
  createVendor,
  getAllVendors,
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
};