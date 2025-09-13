const prisma = require('../config/database');
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

    // Find admin in the Admin table
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

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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

    res.status(200).json({
      success: true,
      token,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'ADMIN'
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
    const totalVendors = await prisma.vendor.count();
    const totalMentors = await prisma.mentor.count();
    const totalStudents = await prisma.student.count();
    const totalCourses = await prisma.course.count();
    const totalEnrollments = await prisma.enrollment.count();

    // Get registered vs enrolled students
    const registeredStudents = await prisma.student.count({ where: { isEnrolled: false } });
    const enrolledStudents = await prisma.student.count({ where: { isEnrolled: true } });

    // Get vendor status counts
    const pendingVendors = await prisma.vendor.count({ where: { status: 'PENDING' } });
    const approvedVendors = await prisma.vendor.count({ where: { status: 'APPROVED' } });
    const rejectedVendors = await prisma.vendor.count({ where: { status: 'REJECTED' } });
    const suspendedVendors = await prisma.vendor.count({ where: { status: 'SUSPENDED' } });

    // Get mentor status counts
    const pendingMentors = await prisma.mentor.count({ where: { status: 'PENDING' } });
    const approvedMentors = await prisma.mentor.count({ where: { status: 'APPROVED' } });
    const rejectedMentors = await prisma.mentor.count({ where: { status: 'REJECTED' } });
    const suspendedMentors = await prisma.mentor.count({ where: { status: 'SUSPENDED' } });

    // Get recent activities with full vendor and mentor details
    const recentVendors = await prisma.vendor.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { 
        user: { select: { name: true, email: true, createdAt: true } },
        _count: { select: { mentors: true } }
      }
    });

    const recentMentors = await prisma.mentor.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        vendor: { 
          select: { 
            companyName: true,
            status: true
          } 
        }
      }
    });

    const recentStudents = await prisma.student.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        mentor: { 
          include: { 
            user: { select: { name: true } },
            vendor: { select: { companyName: true } }
          } 
        }
      }
    });

    // Get vendors with their mentors for admin overview
    const vendorsWithMentors = await prisma.vendor.findMany({
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        creator: { select: { name: true, email: true } },
        mentors: {
          include: {
            user: { select: { name: true, email: true, isActive: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { 
          select: { 
            mentors: true, 
            referralCodes: true, 
            courses: true, 
            enrollments: true, 
            payments: true 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Revenue data (total)
    const totalRevenue = await prisma.enrollment.aggregate({
      _sum: { pricePaid: true }
    });

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
          enrolledStudents,
          // Status counts
          pendingVendors,
          approvedVendors,
          rejectedVendors,
          suspendedVendors,
          pendingMentors,
          approvedMentors,
          rejectedMentors,
          suspendedMentors
        },
        recentActivities: {
          vendors: recentVendors,
          mentors: recentMentors,
          students: recentStudents
        },
        vendorsWithMentors,
        revenue: totalRevenue._sum.pricePaid || 0,
        analyticsData: [] // Placeholder for now
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
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      console.error(`Referral code generation failed: Vendor with ID ${vendorId} not found.`);
      return null;
    }

    // Generate unique referral code
    let referralCode;
    let codeExists = true;

    while (codeExists) {
      referralCode = generateVendorKey(); // Using vendor key generation for simplicity
      const existingCode = await prisma.referralCode.findFirst({ where: { code: referralCode } });
      codeExists = !!existingCode;
    }

    // Create new referral code
    const newReferralCode = await prisma.referralCode.create({
      data: {
        code: referralCode,
        vendorId,
        maxUsage
      }
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
      const existingVendor = await prisma.vendor.findFirst({ where: { vendorKey } });
      keyExists = !!existingVendor;
    }

    // Create vendor record (without userId initially)
    const vendor = await prisma.vendor.create({
      data: {
        vendorKey,
        companyName,
        description,
        createdBy: req.user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      }
    });

    // Automatically generate a referral code for the new vendor
    const defaultMaxUsage = 10; // You can make this configurable if needed
    const newReferralCode = await generateReferralCodeInternal(vendor.id, defaultMaxUsage);

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
    const vendors = await prisma.vendor.findMany({
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        creator: { select: { name: true, email: true } },
        _count: { 
          select: { 
            mentors: true, 
            referralCodes: true, 
            courses: true, 
            enrollments: true, 
            payments: true 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      data: vendors
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve vendor
// @route   PUT /api/admin/vendor/:id/approve
// @access  Private/Admin
const approveVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendor = await prisma.vendor.update({
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
        creator: { select: { name: true, email: true } }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vendor approved successfully',
      data: vendor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Reject vendor
// @route   PUT /api/admin/vendor/:id/reject
// @access  Private/Admin
const rejectVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const vendor = await prisma.vendor.update({
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
        creator: { select: { name: true, email: true } }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor rejected successfully',
      data: vendor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Suspend vendor
// @route   PUT /api/admin/vendor/:id/suspend
// @access  Private/Admin
const suspendVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        rejectionReason: reason || 'Suspended by admin'
      },
      include: {
        user: { select: { name: true, email: true } },
        creator: { select: { name: true, email: true } }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor suspended successfully',
      data: vendor
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
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: req.body
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (req.body.isActive !== undefined && vendor.userId) {
      await prisma.user.update({ where: { id: vendor.userId }, data: { isActive: req.body.isActive } });
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
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    if (vendor.userId) {
      await prisma.user.delete({ where: { id: vendor.userId } });
    }
    await prisma.vendor.delete({ where: { id: req.params.id } });

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
    const mentors = await prisma.mentor.findMany({
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        vendor: { select: { companyName: true } },
        creator: { select: { name: true, email: true } },
        _count: { select: { students: true, enrollments: true, referralCodes: true, payments: true } }
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

// @desc    Update mentor
// @route   PUT /api/admin/mentor/:id
// @access  Private/Admin
const updateMentor = async (req, res) => {
  try {
    const mentor = await prisma.mentor.update({
      where: { id: req.params.id },
      data: req.body
    });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    if (req.body.isActive !== undefined && mentor.userId) {
      await prisma.user.update({ where: { id: mentor.userId }, data: { isActive: req.body.isActive } });
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
    const mentor = await prisma.mentor.findUnique({ where: { id: req.params.id } });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    if (mentor.userId) {
      await prisma.user.delete({ where: { id: mentor.userId } });
    }
    await prisma.mentor.delete({ where: { id: req.params.id } });

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
    const students = await prisma.student.findMany({
      include: {
        user: { select: { name: true, email: true, isActive: true, createdAt: true } },
        mentor: {
          include: {
            user: { select: { name: true } },
            vendor: { select: { companyName: true } }
          }
        }
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

// @desc    Update student
// @route   PUT /api/admin/student/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
  try {
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: req.body
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (req.body.isActive !== undefined && student.userId) {
      await prisma.user.update({ where: { id: student.userId }, data: { isActive: req.body.isActive } });
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
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (student.userId) {
      await prisma.user.delete({ where: { id: student.userId } });
    }
    await prisma.student.delete({ where: { id: req.params.id } });

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
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
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

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price,
        discountPrice,
        duration,
        vendorId: vendorId || null,
        category,
        level,
        maxStudents,
        startDate,
        endDate
      }
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
    const courses = await prisma.course.findMany({
      include: { vendor: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' }
    });

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
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: req.body
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
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    await prisma.course.delete({ where: { id: req.params.id } });

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
    const enrollment = await prisma.enrollment.findUnique({ where: { id: req.params.id } });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    await prisma.enrollment.delete({ where: { id: req.params.id } });

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
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: req.body
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
    const enrollments = await prisma.enrollment.findMany({
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        course: { select: { title: true } },
        mentor: { include: { user: { select: { name: true } } } },
        vendor: { select: { companyName: true } }
      }
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

module.exports = {
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
};