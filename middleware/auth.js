const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // First check if it's an admin user
    let admin = await prisma.admin.findUnique({ 
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isEmailVerified: true
      }
    });

    if (admin) {
      // It's an admin user
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Admin account is not active'
        });
      }
      
      // Add role to admin object for consistency
      admin.role = 'ADMIN';
      req.user = admin;
      next();
      return;
    }

    // If not admin, check regular user
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

module.exports = { protect };
