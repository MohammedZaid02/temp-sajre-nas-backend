const User = require('../models/user');
const Student = require('../models/student');
const Course = require('../models/course');
const Enrollment = require('../models/enrollment');
const Mentor = require('../models/mentor');
const ReferralCode = require('../models/referralcode');
const Payment = require('../models/payment');

const enrollStudentInCourse = async (studentId, courseId, referralCode) => {
    let referralCodeUsed = null;
    let referredByMentorId = null;

    if (referralCode) {
      const foundReferralCode = await ReferralCode.findOne({ code: referralCode });

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
      foundReferralCode.usageCount += 1;
      await foundReferralCode.save();
    }

    // Find student record for current user
    const student = await Student.findById(studentId).populate('mentorId');

    if (!student) {
        throw new Error('Student profile not found');
    }

    // Find course
    const course = await Course.findById(courseId);
    if (!course) {
        throw new Error('Course not found');
    }

    // Check if already enrolled in this course
    const alreadyEnrolled = student.enrolledCourses.some(
      enrolled => enrolled.courseId.toString() === courseId
    );

    if (alreadyEnrolled) {
      throw new Error('Already enrolled in this course');
    }

    // Add course to student's enrolled courses
    student.enrolledCourses.push({
      courseId: course._id
    });

    // Mark student as enrolled if first course
    if (!student.isEnrolled) {
      student.isEnrolled = true;
    }

    await student.save();

    // Create enrollment record
    await Enrollment.create({
      studentId: student._id,
      courseId: course._id,
      mentorId: student.mentorId._id,
      vendorId: student.mentorId.vendorId,
      pricePaid: course.discountPrice || course.price,
      referralCodeUsed,
      referredByMentorId
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
    const student = await Student.findOne({ userId: req.user._id })
      .populate({
        path: 'mentorId',
        populate: [
          { path: 'userId', select: 'name email' },
          { path: 'vendorId', select: 'companyName' }
        ]
      })
      .populate('enrolledCourses.courseId', 'title description price');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get available courses from student's mentor's vendor
    const availableCourses = await Course.find({
      vendorId: student.mentorId.vendorId._id,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: req.user.name,
          email: req.user.email,
          isEnrolled: student.isEnrolled,
          referralCode: student.referralCode,
          mentor: {
            name: student.mentorId.userId.name,
            specialization: student.mentorId.specialization
          },
          vendor: {
            name: student.mentorId.vendorId.companyName
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
    const student = await Student.findOne({ userId: req.user._id });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const result = await enrollStudentInCourse(student._id, courseId, referralCode);

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
    const student = await Student.findOne({ userId: req.user._id })
      .populate('enrolledCourses.courseId', 'title description price discountPrice duration');

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
    const student = await Student.findOne({ userId: req.user._id })
      .populate({
        path: 'mentorId',
        populate: { path: 'vendorId' }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get available courses from student's mentor's vendor
    const availableCourses = await Course.find({
      vendorId: student.mentorId.vendorId._id,
      isActive: true
    });

    // Filter out already enrolled courses
    const enrolledCourseIds = student.enrolledCourses.map(
      enrolled => enrolled.courseId.toString()
    );

    const filteredCourses = availableCourses.filter(
      course => !enrolledCourseIds.includes(course._id.toString())
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
    const student = await Student.findOne({ userId: req.user._id }).populate('mentorId');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // if (!student.mentorId) {
    //     return res.status(400).json({
    //         success: false,
    //         message: 'Student does not have a mentor.',
    //     });
    // }


    const newPayment = new Payment({
      studentId: student._id,
      courseId,
      mentorId: student.mentorId ? student.mentorId._id : undefined,
      vendorId: student.mentorId ? student.mentorId.vendorId : undefined,
      amount,
      paymentMethod: paymentDetails.paymentMethod,
      paymentStatus: 'success',
      transactionId: `DUMMY-${Date.now()}`,
      paymentGateway: 'dummy',
      paymentDetails: {
        cardNumber: paymentDetails.cardNumber,
        cardHolderName: paymentDetails.cardHolder,
        upiId: paymentDetails.upiId,
        walletName: paymentDetails.selectedWallet,
        bankName: paymentDetails.selectedBank,
      },
    });

    await newPayment.save();

    await enrollStudentInCourse(student._id, courseId, referralCode);

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
