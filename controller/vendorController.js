const prisma = require('../config/database');
const { generateMentorKey } = require('../utils/generatekeys');

// @desc    Get vendor dashboard
// @route   GET /api/vendor/dashboard
// @access  Private/Vendor
const getDashboard = async (req, res) => {
  try {
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // 1. COUNTS
    const totalMentors = await prisma.mentor.count({ where: { vendorId: vendor.id } });
    const totalStudents = await prisma.student.count({ where: { mentor: { vendorId: vendor.id } } });
    const enrolledStudents = await prisma.student.count({ where: { mentor: { vendorId: vendor.id }, isEnrolled: true } });
    const totalCourses = await prisma.course.count({ where: { vendorId: vendor.id } });

    // 2. MENTORS LIST with status information
    const mentors = await prisma.mentor.findMany({
      where: { vendorId: vendor.id },
      include: { 
          user: { select: { name: true, email: true, isActive: true, createdAt: true } },
          _count: { select: { students: true, enrollments: true, referralCodes: true, payments: true } }
        },
      orderBy: { createdAt: 'desc' }
    });

    // Get mentor status counts for this vendor
    const pendingMentors = await prisma.mentor.count({ 
      where: { vendorId: vendor.id, status: 'PENDING' } 
    });
    const approvedMentors = await prisma.mentor.count({ 
      where: { vendorId: vendor.id, status: 'APPROVED' } 
    });
    const rejectedMentors = await prisma.mentor.count({ 
      where: { vendorId: vendor.id, status: 'REJECTED' } 
    });
    const suspendedMentors = await prisma.mentor.count({ 
      where: { vendorId: vendor.id, status: 'SUSPENDED' } 
    });

    // 3. STUDENTS LIST
    const students = await prisma.student.findMany({
        where: { mentor: { vendorId: vendor.id } },
        include: {
            user: { select: { name: true, email: true } },
            mentor: { include: { user: { select: { name: true } } } }
        }
    });

    // 4. REVENUE DATA (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await prisma.enrollment.groupBy({
      by: ['enrolledAt'],
      where: { vendorId: vendor.id, enrolledAt: { gte: sixMonthsAgo } },
      _sum: { pricePaid: true },
      orderBy: { enrolledAt: 'asc' }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueData = monthlyRevenue.map(item => ({
      month: `${monthNames[new Date(item.enrolledAt).getMonth()]} ${new Date(item.enrolledAt).getFullYear()}`,
      revenue: item._sum.pricePaid
    }));

    // 5. PERFORMANCE METRICS
    let revenueGrowth = 0;
    if (revenueData.length >= 2) {
      const lastMonthRevenue = revenueData[revenueData.length - 1].revenue;
      const prevMonthRevenue = revenueData[revenueData.length - 2].revenue;
      if (prevMonthRevenue > 0) {
        revenueGrowth = ((lastMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
      }
    }
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oldMentors = await prisma.mentor.count({ where: { vendorId: vendor.id, createdAt: { lte: threeMonthsAgo } } });
    const oldActiveMentors = await prisma.mentor.count({ where: { vendorId: vendor.id, createdAt: { lte: threeMonthsAgo }, user: { isActive: true } } });
    const mentorRetention = oldMentors > 0 ? (oldActiveMentors / oldMentors) * 100 : 100;

    // Calculate Course Completion Rate
    const totalEnrollments = await prisma.enrollment.count({ where: { vendorId: vendor.id } });
    const completedEnrollments = await prisma.enrollment.count({ where: { vendorId: vendor.id, course: { enrollments: { every: { student: { isEnrolled: false } } } } } });
    const courseCompletion = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;

    const performanceMetrics = {
      revenueGrowth: revenueGrowth.toFixed(1),
      mentorRetention: mentorRetention.toFixed(1),
      courseCompletion: courseCompletion.toFixed(1),
      studentSatisfaction: 92, // Hardcoded for now, requires feedback system
    };

    // 6. ANALYTICS DATA (last 6 months)
    const monthlyNewStudents = await prisma.student.groupBy({
        by: ['createdAt'],
        where: { mentor: { vendorId: vendor.id }, createdAt: { gte: sixMonthsAgo } },
        _count: { _all: true },
        orderBy: { createdAt: 'asc' }
    });

    const monthlyNewCourses = await prisma.course.groupBy({
        by: ['createdAt'],
        where: { vendorId: vendor.id, createdAt: { gte: sixMonthsAgo } },
        _count: { _all: true },
        orderBy: { createdAt: 'asc' }
    });

    const analyticsData = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i)); // Go back 5 months from current, then iterate forward
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // Month is 0-indexed

      const monthName = monthNames[month - 1];
      const users = monthlyNewStudents.find(item => new Date(item.createdAt).getFullYear() === year && new Date(item.createdAt).getMonth() + 1 === month)?._count._all || 0;
      const courses = monthlyNewCourses.find(item => new Date(item.createdAt).getFullYear() === year && new Date(item.createdAt).getMonth() + 1 === month)?._count._all || 0;

      analyticsData.push({
        name: `${monthName} ${year}`,
        users,
        courses
      });
    }

    // 7. RECENT ACTIVITIES
    const recentMentors = await prisma.mentor.findMany({
        where: { vendorId: vendor.id },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 2
    });

    const recentStudents = await prisma.student.findMany({
        where: { mentor: { vendorId: vendor.id } },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    const recentActivities = [
      ...recentMentors.map(m => ({ type: 'mentor', title: 'New Mentor Onboarded', description: `${m.user?.name || 'A new mentor'} joined`, time: m.createdAt })),
      ...recentStudents.map(s => ({ type: 'student', title: 'New Student Registered', description: `${s.user?.name || 'A new student'} registered`, time: s.createdAt }))
    ].sort((a, b) => b.time - a.time).slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        vendor: {
          companyName: vendor.companyName,
          description: vendor.description
        },
        counts: {
          totalMentors,
          totalStudents,
          enrolledStudents,
          registeredStudents: totalStudents - enrolledStudents,
          totalCourses,
          // Mentor status counts
          pendingMentors,
          approvedMentors,
          rejectedMentors,
          suspendedMentors
        },
        mentors,
        students,
        revenueData,
        performanceMetrics,
        recentActivities,
        analyticsData
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create mentor
// @route   POST /api/vendor/create-mentor
// @access  Private/Vendor
const createMentor = async (req, res) => {
  try {
    const { specialization, mentorName } = req.body;

    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Generate unique mentor key
    let mentorKey;
    let keyExists = true;

    while (keyExists) {
      mentorKey = generateMentorKey();
      const existingMentor = await prisma.mentor.findUnique({ where: { mentorKey } });
      keyExists = !!existingMentor;
    }

    // Create mentor record (without userId initially)
    const mentor = await prisma.mentor.create({
      data: {
        mentorKey,
        vendorId: vendor.id,
        specialization,
        createdBy: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Mentor created successfully',
      data: {
        mentorKey,
        specialization,
        message: 'Share this mentor key with the mentor for registration'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get vendor's mentors
// @route   GET /api/vendor/mentors
// @access  Private/Vendor
const getMentors = async (req, res) => {
  try {
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const mentors = await prisma.mentor.findMany({
      where: { vendorId: vendor.id },
      include: { 
          user: { select: { name: true, email: true, isActive: true, createdAt: true } },
          _count: { select: { students: true, enrollments: true } }
        },
      orderBy: { createdAt: 'desc' }
    });

    const mentorsWithCounts = mentors.map(mentor => ({
        ...mentor,
        studentCount: mentor._count.students,
        enrolledCount: mentor._count.enrollments,
        registeredCount: mentor._count.students - mentor._count.enrollments
    }));

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

// @desc    Get vendor's students
// @route   GET /api/vendor/students
// @access  Private/Vendor
const getStudents = async (req, res) => {
  try {
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Get all students under this vendor's mentors
    const students = await prisma.student.findMany({
        where: { mentor: { vendorId: vendor.id } },
        include: {
            user: { select: { name: true, email: true } },
            mentor: { include: { user: { select: { name: true } } } }
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

// @desc    Approve mentor
// @route   PUT /api/vendor/mentor/:id/approve
// @access  Private/Vendor
const approveMentor = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Check if mentor belongs to this vendor
    const mentor = await prisma.mentor.findFirst({
      where: { id, vendorId: vendor.id }
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found or not under your vendor account'
      });
    }

    const updatedMentor = await prisma.mentor.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null
      },
      include: {
        user: { select: { name: true, email: true } },
        vendor: { select: { companyName: true } }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Mentor approved successfully',
      data: updatedMentor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject mentor
// @route   PUT /api/vendor/mentor/:id/reject
// @access  Private/Vendor
const rejectMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Check if mentor belongs to this vendor
    const mentor = await prisma.mentor.findFirst({
      where: { id, vendorId: vendor.id }
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found or not under your vendor account'
      });
    }

    const updatedMentor = await prisma.mentor.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason || 'No reason provided',
        approvedBy: null,
        approvedAt: null
      },
      include: {
        user: { select: { name: true, email: true } },
        vendor: { select: { companyName: true } }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Mentor rejected successfully',
      data: updatedMentor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Suspend mentor
// @route   PUT /api/vendor/mentor/:id/suspend
// @access  Private/Vendor
const suspendMentor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Find vendor record for current user
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Check if mentor belongs to this vendor
    const mentor = await prisma.mentor.findFirst({
      where: { id, vendorId: vendor.id }
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found or not under your vendor account'
      });
    }

    const updatedMentor = await prisma.mentor.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        rejectionReason: reason || 'Suspended by vendor'
      },
      include: {
        user: { select: { name: true, email: true } },
        vendor: { select: { companyName: true } }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Mentor suspended successfully',
      data: updatedMentor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getDashboard,
  createMentor,
  getMentors,
  getStudents,
  approveMentor,
  rejectMentor,
  suspendMentor
};