const prisma = require('../config/database');

const enrollStudentInCourse = async (studentId, courseId, referralCode) => {
    let referralCodeUsed = null;
    let referredByMentorId = null;

    if (referralCode) {
      const foundReferralCode = await prisma.referralCode.findUnique({ where: { code: referralCode } });

      if (!foundReferralCode) {
        throw new Error('Invalid referral code');
      }

      if (!foundReferralCode.isActive) {
        throw new Error('Referral code is not active');
      }

      if (foundReferralCode.expiresAt && new Date() > foundReferralCode.expiresAt) {
        throw new Error('Referral code has expired');
      }

      if (foundReferralCode.maxUsage && foundReferralCode.usageCount >= foundReferralCode.maxUsage) {
        throw new Error('Referral code has reached its maximum usage');
      }

      referralCodeUsed = foundReferralCode.code;
      referredByMentorId = foundReferralCode.mentorId;

      // Increment usage count
      await prisma.referralCode.update({
        where: { id: foundReferralCode.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    // Find student record for current user
    const student = await prisma.student.findUnique({ 
        where: { id: studentId },
        include: { mentor: true, enrolledCourses: true }
    });

    if (!student) {
        throw new Error('Student profile not found');
    }

    // Find course
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
        throw new Error('Course not found');
    }

    // Check if already enrolled in this course
    const alreadyEnrolled = student.enrolledCourses.some(
      enrolled => enrolled.courseId === courseId
    );

    if (alreadyEnrolled) {
      throw new Error('Already enrolled in this course');
    }

    // Add course to student's enrolled courses
    await prisma.enrolledCourse.create({
        data: {
            studentId: student.id,
            courseId: course.id
        }
    });

    // Mark student as enrolled if first course
    if (!student.isEnrolled) {
      await prisma.student.update({ 
          where: { id: student.id },
          data: { isEnrolled: true }
        });
    }

    // Create enrollment record
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        mentorId: student.mentor.id,
        vendorId: student.mentor.vendorId,
        pricePaid: course.discountPrice || course.price,
        referralCodeUsed,
        referredByMentorId
      }
    });

    return {
        success: true,
        message: 'Successfully enrolled in course',
        data: {
            courseTitle: course.title,
            pricePaid: course.discountPrice || course.price
        }
    };
}

// @desc    Get student dashboard
// @route   GET /api/student/dashboard
// @access  Private/Student
const getDashboard = async (req, res) => {
  try {
    // Find student record for current user
    const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
        include: {
            user: true,
            mentor: { include: { user: true, vendor: true } },
            enrolledCourses: { include: { course: true } }
        }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get available courses from student's mentor's vendor
    const availableCourses = await prisma.course.findMany({
      where: {
        vendorId: student.mentor.vendorId,
        isActive: true
      }
    });

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: student.user.name,
          email: student.user.email,
          isEnrolled: student.isEnrolled,
          referralCode: student.referralCode,
          mentor: {
            name: student.mentor.user.name,
            specialization: student.mentor.specialization
          },
          vendor: {
            name: student.mentor.vendor.companyName
          }
        },
        enrolledCourses: student.enrolledCourses,
        availableCourses
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Enroll in course
// @route   POST /api/student/enroll/:courseId
// @access  Private/Student
const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { referralCode } = req.body;
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const result = await enrollStudentInCourse(student.id, courseId, referralCode);

    res.status(200).json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student's enrolled courses
// @route   GET /api/student/courses
// @access  Private/Student
const getEnrolledCourses = async (req, res) => {
  try {
    // Find student record for current user
    const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
        include: { enrolledCourses: { include: { course: true } } }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student.enrolledCourses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get available courses for student
// @route   GET /api/student/available-courses
// @access  Private/Student
const getAvailableCourses = async (req, res) => {
  try {
    // Find student record for current user
    const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
        include: { mentor: { include: { vendor: true } }, enrolledCourses: true }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get available courses from student's mentor's vendor
    const availableCourses = await prisma.course.findMany({
      where: {
        vendorId: student.mentor.vendorId,
        isActive: true
      }
    });

    // Filter out already enrolled courses
    const enrolledCourseIds = student.enrolledCourses.map(
      enrolled => enrolled.courseId
    );

    const filteredCourses = availableCourses.filter(
      course => !enrolledCourseIds.includes(course.id)
    );

    res.status(200).json({
      success: true,
      data: filteredCourses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Process a dummy payment
// @route   POST /api/student/dummy-payment
// @access  Private/Student
const dummyPayment = async (req, res) => {
  try {
    const { paymentDetails, amount, courseId, referralCode } = req.body;
    const student = await prisma.student.findUnique({ 
        where: { userId: req.user.id },
        include: { mentor: true }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const newPayment = await prisma.payment.create({
      data: {
        studentId: student.id,
        courseId,
        mentorId: student.mentor ? student.mentor.id : undefined,
        vendorId: student.mentor ? student.mentor.vendorId : undefined,
        amount,
        paymentMethod: paymentDetails.paymentMethod,
        paymentStatus: 'SUCCESS',
        transactionId: `DUMMY-${Date.now()}`,
        paymentGateway: 'dummy',
        paymentDetails: {
          cardNumber: paymentDetails.cardNumber,
          cardHolderName: paymentDetails.cardHolder,
          upiId: paymentDetails.upiId,
          walletName: paymentDetails.selectedWallet,
          bankName: paymentDetails.selectedBank,
        },
      }
    });

    await enrollStudentInCourse(student.id, courseId, referralCode);

    res.status(201).json({
      success: true,
      message: 'Dummy payment recorded successfully',
      data: newPayment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDashboard,
  enrollInCourse,
  getEnrolledCourses,
  getAvailableCourses,
  dummyPayment
};