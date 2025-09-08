const transporter = require('../config/email');

const sendEmail = async (options) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

const sendOTPEmail = async (email, otp, type) => {
  const subject = `Your OTP for ${type}`;
  const text = `Your OTP is: ${otp}. This OTP will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Your OTP Code</h2>
      <p>Your OTP for ${type} is:</p>
      <div style="background-color: #f0f0f0; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 5px;">
        ${otp}
      </div>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject,
    text,
    html
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail
};