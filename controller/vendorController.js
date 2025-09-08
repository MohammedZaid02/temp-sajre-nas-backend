const User = require('../models/user');
const Vendor = require('../models/vendor');
const Mentor = require('../models/mentor');
const Student = require('../models/student');
const Course = require('../models/course');
const Enrollment = require('../models/enrollment');
const { generateMentorKey } = require('../utils/generatekeys');
const ReferralCode = require('../models/referralcode');

// @desc    Generate Mentor Referral Code
// @route   POST /api/vendor/generate-mentor-referral
// @access  Private/Vendor
const generateMentorReferral = async (req, res) => {
  try {
    const { maxUses = 1 } = req.body;
    
    const referralCode = await ReferralCode.create({
      code: await generateMentorReferralCode(),
      type: 'mentor',
      createdBy: req.user._id,
      maxUses,
      usedCount: 0
    });

    res.status(201).json({
      success: true,
      data: referralCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get vendor dashboard
// @route   GET /api/vendor/dashboard
// @access  Private/Vendor
const getDashboard = async (req, res) => {
  try {
    console.log("Vendor Dashboard: Logged in user ID:", req.user._id);

    // Find vendor record for current user
    const vendor = await Vendor.findOne({ userId: req.user._id });
    console.log("Vendor Dashboard: Found vendor:", vendor);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // 1. COUNTS
    const totalMentors = await Mentor.countDocuments({ vendorId: vendor._id });
    const studentCountResult = await Student.aggregate([
        { $lookup: { from: 'mentors', localField: 'mentorId', foreignField: '_id', as: 'mentor' } },
        { $match: { 'mentor.vendorId': vendor._id } },
        { $group: { _id: null, total: { $sum: 1 }, enrolled: { $sum: { $cond: [{ $eq: ['$isEnrolled', true] }, 1, 0] } } } }
    ]);
    const studentsData = studentCountResult[0] || { total: 0, enrolled: 0 };

    // 2. MENTORS LIST
    const mentors = await Mentor.find({ vendorId: vendor._id })
      .populate('userId', 'name email isActive createdAt')
      .sort({ createdAt: -1 });
    console.log("Vendor Dashboard: Found mentors count:", mentors.length);

    const mentorsWithCounts = await Promise.all(
      mentors.map(async (mentor) => {
        const studentCount = await Student.countDocuments({ mentorId: mentor._id });
        return {
          ...mentor.toObject(),
          studentCount,
        };
      })
    );

    // 3. STUDENTS LIST
    const students = await Student.find({ mentorId: { $in: mentors.map(m => m._id) } })
        .populate({
            path: 'userId',
            select: 'name email'
        })
        .populate({
            path: 'mentorId',
            select: 'userId',
            populate: {
                path: 'userId',
                select: 'name'
            }
        });
    console.log("Vendor Dashboard: Found students count:", students.length);

    // 4. REVENUE DATA (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Enrollment.aggregate([
      { $match: { vendorId: vendor._id, enrolledAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$enrolledAt' }, month: { $month: '$enrolledAt' } },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const revenueData = monthlyRevenue.map(item => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      revenue: item.totalRevenue
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
    const oldMentors = await Mentor.countDocuments({ vendorId: vendor._id, createdAt: { $lte: threeMonthsAgo } });
    const oldActiveMentors = await Mentor.countDocuments({ vendorId: vendor._id, createdAt: { $lte: threeMonthsAgo }, 'userId.isActive': true });
    const mentorRetention = oldMentors > 0 ? (oldActiveMentors / oldMentors) * 100 : 100;

    // Calculate Course Completion Rate
    const totalEnrollments = await Enrollment.countDocuments({ vendorId: vendor._id });
    const completedEnrollments = await Enrollment.countDocuments({ vendorId: vendor._id, isCompleted: true });
    const courseCompletion = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0;

    const performanceMetrics = {
      revenueGrowth: revenueGrowth.toFixed(1),
      mentorRetention: mentorRetention.toFixed(1),
      courseCompletion: courseCompletion.toFixed(1),
      studentSatisfaction: 92, // Hardcoded for now, requires feedback system
    };

    // 6. ANALYTICS DATA (last 6 months)
    const monthlyNewStudents = await Student.aggregate([
      { $lookup: { from: 'mentors', localField: 'mentorId', foreignField: '_id', as: 'mentor' } },
      { $match: { 'mentor.vendorId': vendor._id, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthlyNewCourses = await Course.aggregate([
      { $match: { vendorId: vendor._id, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const analyticsData = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i)); // Go back 5 months from current, then iterate forward
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // Month is 0-indexed

      const monthName = monthNames[month - 1];
      const users = monthlyNewStudents.find(item => item._id.year === year && item._id.month === month)?.count || 0;
      const courses = monthlyNewCourses.find(item => item._id.year === year && item._id.month === month)?.count || 0;

      analyticsData.push({
        name: `${monthName} ${year}`,
        users,
        courses
      });
    }

    // 7. RECENT ACTIVITIES
    const recentActivities = [
      ...mentors.slice(0, 2).map(m => ({ type: 'mentor', title: 'New Mentor Onboarded', description: `${m.userId?.name || 'A new mentor'} joined`, time: m.createdAt })),
      ...students.slice(0, 0).map(s => ({ type: 'student', title: 'New Student Registered', description: `${s.userId?.name || 'A new student'} registered`, time: s.createdAt })) // Limit students to 0 for now, as admin dashboard has 3
    ].sort((a, b) => b.time - a.time).slice(0, 5);

    const totalCourses = await Course.countDocuments({ vendorId: vendor._id });

    res.status(200).json({
      success: true,
      data: {
        vendor: {
          companyName: vendor.companyName,
          description: vendor.description
        },
        counts: {
          totalMentors,
          totalStudents: studentsData.total,
          enrolledStudents: studentsData.enrolled,
          registeredStudents: studentsData.total - studentsData.enrolled,
          totalCourses // Added totalCourses
        },
        mentors: mentorsWithCounts,
        students,
        revenueData,
        performanceMetrics,
        recentActivities,
        analyticsData // Added analyticsData
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
    const vendor = await Vendor.findOne({ userId: req.user._id });
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
      const existingMentor = await Mentor.findOne({ mentorKey });
      keyExists = !!existingMentor;
    }

    // Create mentor record (without userId initially)
    const mentor = await Mentor.create({
      mentorKey,
      vendorId: vendor._id,
      specialization,
      createdBy: req.user._id
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
    const vendor = await Vendor.findOne({ userId: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    const mentors = await Mentor.find({ vendorId: vendor._id })
      .populate('userId', 'name email isActive createdAt')
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

// @desc    Get vendor's students
// @route   GET /api/vendor/students
// @access  Private/Vendor
const getStudents = async (req, res) => {
  try {
    // Find vendor record for current user
    const vendor = await Vendor.findOne({ userId: req.user._id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    // Get all students under this vendor's mentors
    const students = await Student.aggregate([
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
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mentor.userId',
          foreignField: '_id',
          as: 'mentorUser'
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ['$user.name', 0] },
          email: { $arrayElemAt: ['$user.email', 0] },
          isEnrolled: 1,
          referralCode: 1,
          createdAt: 1,
          mentorName: { $arrayElemAt: ['$mentorUser.name', 0] }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

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

module.exports = {
  getDashboard,
  createMentor,
  getMentors,
  getStudents
};