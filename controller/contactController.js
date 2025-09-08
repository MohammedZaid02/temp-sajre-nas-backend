const nodemailer = require('nodemailer');

// Configure nodemailer with your actual Gmail credentials from .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// @desc    Handle contact form submission
// @route   POST /api/contact
// @access  Public
const handleContactForm = async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        // Validate input
        if (!name || !email || !phone || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Email template
        const mailOptions = {
            from: `Sajre Edutech <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Welcome to Sajre Edutech!',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                    <h2 style="color: #333;">Hello ${name}!</h2>
                    <p>Thank you for contacting Sajre Edutech.</p>
                    <p>We have received your message and will get back to you soon.</p>
                    <p>Your details:</p>
                    <ul>
                        <li>Phone: ${phone}</li>
                        <li>Message: ${message}</li>
                    </ul>
                    <p>Best regards,<br>Team Sajre Edutech</p>
                </div>
            `
        };

        // Send email to user
        await transporter.sendMail(mailOptions);

        // --- Admin Notification ---
        console.log('Admin email address from .env:', process.env.ADMIN_EMAIL);
        // Create email for admin
        const adminMailOptions = {
            from: `Sajre Edutech <${process.env.EMAIL_FROM}>`,
            to: process.env.ADMIN_EMAIL, // Admin's email address from .env
            subject: 'New Contact Form Submission',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                    <h2 style="color: #333;">New Contact Form Submission</h2>
                    <p>A new user has submitted the contact form with the following details:</p>
                    <ul>
                        <li><strong>Name:</strong> ${name}</li>
                        <li><strong>Email:</strong> ${email}</li>
                        <li><strong>Phone:</strong> ${phone}</li>
                        <li><strong>Message:</strong> ${message}</li>
                    </ul>
                </div>
            `
        };
        // console.log('Admin mail options:', adminMailOptions);

        // Send email to admin
        try {
            const adminMailInfo = await transporter.sendMail(adminMailOptions);
            console.log('Admin notification email sent successfully:', adminMailInfo.messageId);
        } catch (adminMailError) {
            console.error('Error sending admin notification email:', adminMailError);
        }
        // --- End Admin Notification ---


        // Send success response
        res.status(200).json({
            success: true,
            message: 'Thank you for contacting us. We will get back to you soon!'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing your request. Please try again later.'
        });
    }
};

module.exports = {
    handleContactForm
};