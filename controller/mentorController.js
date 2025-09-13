const prisma = require('../config/database');
const { generateReferralCode } = require('../utils/generatekeys');

// @desc    Get mentor dashboard
// @route   GET /api/mentor/dashboard
// @access  Private/Mentor
const getDashboard = async (req, res) => {
  try {
    const mentor = await prisma.mentor.findUnique({
      where: { userId: req.user.id },
      include: {
        vendor: { select: { companyName: true } },
        user: { select: { name: true, email: true } }
      }
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const totalStudents = await prisma.student.count({ where: { mentorId: mentor.id } });
    const enrolledStudents = await prisma.student.count({ where: { mentorId: mentor.id, isEnrolled: true } });
    const activeReferralCodes = await prisma.referralCode.count({ where: { mentorId: mentor.id, isActive: true } });
    const totalEnrollments = await prisma.enrollment.count({ where: { mentorId: mentor.id } });

    const referralCodes = await prisma.referralCode.findMany({
      where: { mentorId: mentor.id, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const students = await prisma.student.findMany({
      where: { mentorId: mentor.id },
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        enrolledCourses: { include: { course: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const recentEnrollments = await prisma.enrollment.findMany({
      where: { mentorId: mentor.id },
      include: {
        student: { include: { user: { select: { name: true } } } },
        course: { select: { title: true, price: true, duration: true, startDate: true, endDate: true } }
      },
      orderBy: { enrolledAt: 'desc' },
      take: 5
    });

    const courseStats = await prisma.enrollment.groupBy({
      by: ['courseId'],
      where: { mentorId: mentor.id },
      _count: {
        studentId: true
      }
    });

    const revenue = await prisma.enrollment.aggregate({
      where: { mentorId: mentor.id },
      _sum: { pricePaid: true }
    });

    const totalRevenue = revenue._sum.pricePaid || 0;

    return res.status(200).json({
      success: true,
      data: {
        mentor: {
          id: mentor.id,
          name: mentor.user.name,
          email: mentor.user.email,
          specialization: mentor.specialization,
          vendor: mentor.vendor.companyName,
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

    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const activeCodesCount = await prisma.referralCode.count({
      where: { mentorId: mentor.id, isActive: true }
    });

    const MAX_ACTIVE_CODES = 5;
    if (activeCodesCount >= MAX_ACTIVE_CODES) {
      return res.status(400).json({
        success: false,
        message: `You can only have ${MAX_ACTIVE_CODES} active referral codes at a time. Please deactivate old codes first.`
      });
    }

    let referralCode;
    let codeExists = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (codeExists && attempts < MAX_ATTEMPTS) {
      referralCode = generateReferralCode(req.user.name, mentor.id.toString());
      const existingCode = await prisma.referralCode.findFirst({ where: { code: referralCode } });
      codeExists = !!existingCode;
      attempts++;
    }

    if (codeExists) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique referral code. Please try again.'
      });
    }

    const newReferralCode = await prisma.referralCode.create({
      data: {
        code: referralCode,
        mentorId: mentor.id,
        vendorId: mentor.vendorId,
        maxUsage: maxUsage || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        usageCount: 0,
        createdAt: new Date()
      }
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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const referralCodes = await prisma.referralCode.findMany({
      where: { mentorId: mentor.id },
      orderBy: { createdAt: 'desc' }
    });

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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const students = await prisma.student.findMany({
      where: { mentorId: mentor.id },
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        enrolledCourses: { include: { course: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const referralCode = await prisma.referralCode.findFirst({
      where: {
        id: req.params.id,
        mentorId: mentor.id
      }
    });

    if (!referralCode) {
      return res.status(404).json({
        success: false,
        message: 'Referral code not found'
      });
    }

    await prisma.referralCode.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { mentorId: mentor.id },
      include: {
        student: { include: { user: { select: { name: true } } } },
        course: { select: { title: true, description: true, price: true, duration: true, startDate: true, endDate: true } },
        vendor: { select: { companyName: true } }
      },
      orderBy: { enrolledAt: 'desc' }
    });

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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const recentEnrollments = await prisma.enrollment.findMany({
      where: { mentorId: mentor.id },
      include: {
        student: { include: { user: { select: { name: true } } } },
        course: { select: { title: true } }
      },
      orderBy: { enrolledAt: 'desc' },
      take: 5
    });

    const recentStudents = await prisma.student.findMany({
      where: { mentorId: mentor.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const recentReferrals = await prisma.referralCode.findMany({
      where: { mentorId: mentor.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const activities = [
      ...recentEnrollments.map(enrollment => ({
        type: 'enrollment',
        title: 'New Course Enrollment',
        description: `${enrollment.student.user.name} enrolled in ${enrollment.course.title}`,
        time: enrollment.enrolledAt,
        data: enrollment
      })),
      ...recentStudents.map(student => ({
        type: 'student',
        title: 'New Student Registration',
        description: `${student.user.name} registered using your referral code`,
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
    const mentor = await prisma.mentor.findUnique({ where: { userId: req.user.id } });
    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found'
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { mentorId: mentor.id },
      select: { courseId: true },
      distinct: ['courseId']
    });

    const courseIds = enrollments.map(e => e.courseId);

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } }
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