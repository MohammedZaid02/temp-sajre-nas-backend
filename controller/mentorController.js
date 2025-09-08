const User = require('../models/user');
const Mentor = require('../models/mentor');
const Student = require('../models/student');
const ReferralCode = require('../models/referralcode');
const Course = require('../models/course');
const Enrollment = require('../models/enrollment');
const { generateReferralCode } = require('../utils/generatekeys');

// @desc    Get mentor dashboard
// @route   GET /api/mentor/dashboard
// @access  Private/Mentor
const getDashboard = async (req, res) => {
  try {
    console.log("Mentor Dashboard: Logged in user ID:", req.user._id);

    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id })
      .populate('vendorId', 'companyName')
      .populate('userId', 'name email');
    
    console.log("Found mentor:", mentor);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    // Debug: Check for any students in the system
    const totalStudentsInSystem = await Student.countDocuments();
    console.log("Total students in system:", totalStudentsInSystem);
    
    // Debug: List a few students to check their mentorId
    const sampleStudents = await Student.find().limit(3);
    console.log("Sample students:", sampleStudents);

    console.log("Mentor ID for student query:", mentor._id);
    
    // 1. Get all counts
    const totalStudents = await Student.countDocuments({ mentorId: mentor._id });
    console.log("Total students found:", totalStudents);
    
    // Debug: List all students to verify the query
    const allStudents = await Student.find({ mentorId: mentor._id });
    console.log("All students:", allStudents);
    
    const enrolledStudents = await Student.countDocuments({ 
      mentorId: mentor._id, 
      isEnrolled: true 
    });
    console.log("Enrolled students found:", enrolledStudents);
    
    const activeReferralCodes = await ReferralCode.countDocuments({
      mentorId: mentor._id,
      isActive: true
    });
    console.log("Active referral codes found:", activeReferralCodes);
    const totalEnrollments = await Enrollment.countDocuments({ mentorId: mentor._id });

    // 2. Get all active referral codes with usage stats
    const referralCodes = await ReferralCode.find({ 
      mentorId: mentor._id,
      isActive: true 
    }).sort({ createdAt: -1 });

    // 3. Get recent students with detailed info
    const students = await Student.find({ mentorId: mentor._id })
      .populate('userId', 'name email isActive createdAt')
      .populate({
        path: 'enrolledCourses.courseId',
        select: 'title price duration startDate endDate'
      })
      .sort({ createdAt: -1 })
      .limit(10);

    // 4. Get recent enrollments
    const recentEnrollments = await Enrollment.find({ mentorId: mentor._id })
      .populate('studentId', 'name')
      .populate('courseId', 'title price duration startDate endDate')
      .sort({ enrolledAt: -1 })
      .limit(5);

    // 5. Get course statistics
    const courseStats = await Enrollment.aggregate([
      { $match: { mentorId: mentor._id } },
      { $group: {
        _id: '$courseId',
        studentCount: { $sum: 1 }
      }},
      { $lookup: {
        from: 'courses',
        localField: '_id',
        foreignField: '_id',
        as: 'courseDetails'
      }},
      { $unwind: '$courseDetails' },
      { $project: {
        title: '$courseDetails.title',
        studentCount: 1
      }}
    ]);

    // 6. Calculate revenue (if price data is available)
    const revenue = await Enrollment.aggregate([
      { $match: { mentorId: mentor._id } },
      { $lookup: {
        from: 'courses',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course'
      }},
      { $unwind: '$course' },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$course.price' }
      }}
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].totalRevenue : 0;

    res.status(200).json({
      success: true,
      data: {
        mentor: {
          id: mentor._id,
          name: mentor.userId.name,
          email: mentor.userId.email,
          specialization: mentor.specialization,
          vendor: mentor.vendorId.companyName,
          joinedAt: mentor.createdAt
        },
        stats: {
          totalStudents,
          enrolledStudents,
          registeredStudents: totalStudents - enrolledStudents,
          activeReferralCodes,
          totalEnrollments,
          totalRevenue
        },
        referralCodes,
        recentStudents: students,
        recentEnrollments,
        courseStats
      }
    });

  } catch (error) {
    console.error("Mentor Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create referral code
// @route   POST /api/mentor/create-referral-code
// @access  Private/Mentor
const createReferralCode = async (req, res) => {
  try {
    const { maxUsage, expiresAt } = req.body;

    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    // Get active referral codes count for this mentor
    const activeCodesCount = await ReferralCode.countDocuments({
      mentorId: mentor._id,
      isActive: true
    });

    // Check if mentor has reached maximum active codes (e.g., limit of 5)
    const MAX_ACTIVE_CODES = 5;
    if (activeCodesCount >= MAX_ACTIVE_CODES) {
      return res.status(400).json({
        success: false,
        message: `You can only have ${MAX_ACTIVE_CODES} active referral codes at a time. Please deactivate old codes first.`
      });
    }

    // Generate unique referral code with improved format
    let referralCode;
    let codeExists = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (codeExists && attempts < MAX_ATTEMPTS) {
      referralCode = generateReferralCode(req.user.name, mentor._id.toString());
      const existingCode = await ReferralCode.findOne({ code: referralCode });
      codeExists = !!existingCode;
      attempts++;
    }

    if (codeExists) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique referral code. Please try again.'
      });
    }

    // Create referral code with additional fields
    const newReferralCode = await ReferralCode.create({
      code: referralCode,
      mentorId: mentor._id,
      vendorId: mentor.vendorId,
      maxUsage: maxUsage || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      usageCount: 0,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Referral code created successfully',
      data: newReferralCode
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get mentor's referral codes
// @route   GET /api/mentor/referral-codes
// @access  Private/Mentor
const getReferralCodes = async (req, res) => {
  try {
    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const referralCodes = await ReferralCode.find({ mentorId: mentor._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: referralCodes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get mentor's students
// @route   GET /api/mentor/students
// @access  Private/Mentor
const getStudents = async (req, res) => {
  try {
    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const students = await Student.find({ mentorId: mentor._id })
      .populate('userId', 'name email isActive createdAt')
      .populate('enrolledCourses.courseId', 'title price')
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

// @desc    Deactivate referral code
// @route   PUT /api/mentor/referral-code/:id/deactivate
// @access  Private/Mentor
const deactivateReferralCode = async (req, res) => {
  try {
    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const referralCode = await ReferralCode.findOne({
      _id: req.params.id,
      mentorId: mentor._id
    });

    if (!referralCode) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found'
      });
    }

    referralCode.isActive = false;
    await referralCode.save();

    res.status(200).json({
      success: true,
      message: 'Referral code deactivated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get mentor's enrollments
// @route   GET /api/mentor/enrollments
// @access  Private/Mentor
const getMentorEnrollments = async (req, res) => {
  try {
    // Find mentor record for current user
    const mentor = await Mentor.findOne({ userId: req.user._id });
    
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    // Get all enrollments for this mentor
    const enrollments = await Enrollment.find({ mentorId: mentor._id })
      .populate('studentId', 'name')
      .populate({
        path: 'courseId',
        select: 'title description price duration startDate endDate'
      })
      .populate('vendorId', 'companyName')
      .sort({ enrolledAt: -1 });

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

// @desc    Get recent activities for mentor
// @route   GET /api/mentor/recent-activities
// @access  Private/Mentor
// @desc    Get mentor's recent activities
// @route   GET /api/mentor/activities/recent
// @access  Private/Mentor
const getRecentActivities = async (req, res) => {
  try {
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    // Get recent enrollments
    const recentEnrollments = await Enrollment.find({ mentorId: mentor._id })
      .populate('studentId', 'name')
      .populate('courseId', 'title')
      .sort({ enrolledAt: -1 })
      .limit(5);

    // Get recent student registrations
    const recentStudents = await Student.find({ mentorId: mentor._id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent referral code creations
    const recentReferrals = await ReferralCode.find({ mentorId: mentor._id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Format activities
    const activities = [
      ...recentEnrollments.map(enrollment => ({
        type: 'enrollment',
        title: 'New Course Enrollment',
        description: `${enrollment.studentId.name} enrolled in ${enrollment.courseId.title}`,
        time: enrollment.enrolledAt,
        data: enrollment
      })),
      ...recentStudents.map(student => ({
        type: 'student',
        title: 'New Student Registration',
        description: `${student.userId.name} registered using your referral code`,
        time: student.createdAt,
        data: student
      })),
      ...recentReferrals.map(referral => ({
        type: 'referral',
        title: 'Referral Code Created',
        description: `New referral code ${referral.code} created`,
        time: referral.createdAt,
        data: referral
      }))
    ];

    // Sort by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities',
      error: error.message
    });
  }
};

// @desc    Get mentor's courses
// @route   GET /api/mentor/courses
// @access  Private/Mentor
const getMentorCourses = async (req, res) => {
  try {
    const mentor = await Mentor.findOne({ userId: req.user._id });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    // Get all enrollments for this mentor to find associated courses
    const enrollments = await Enrollment.find({ mentorId: mentor._id })
      .distinct('courseId');

    // Get course details
    const courses = await Course.find({ 
      _id: { $in: enrollments }
    });

    res.status(200).json({
      success: true,
      data: courses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching mentor courses',
      error: error.message
    });
  }
};

module.exports = {
  getDashboard,
  createReferralCode,
  getReferralCodes,
  getStudents,
  deactivateReferralCode,
  getMentorEnrollments,
  getRecentActivities,
  getMentorCourses
};