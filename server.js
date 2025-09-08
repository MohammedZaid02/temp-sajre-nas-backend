const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const vendorRoutes = require('./routes/vendor');
const mentorRoutes = require('./routes/mentor');
const studentRoutes = require('./routes/student');
const contactRoutes = require('./routes/contact');

const app = express();

// Middleware
app.use(cors({
  origin: 'https://sajre-frontend.vercel.app',
  credentials: true,
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/contact', contactRoutes);

// Health check / root route
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!' 
  });
});

// ❌ Do not use app.listen on Vercel
// ✅ Export app for Vercel
module.exports = app;
