const User = require('../models/User');
const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const signToken = (id) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  user.refreshToken = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    const user = await User.create({ name, email, password, role });

    await Activity.logActivity({
      user: user._id,
      action: 'login',
      resource: 'auth',
      details: { method: 'register' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User registered: ${email}`);
    
    createSendToken(user, 201, res);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Account is deactivated', 401));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await Activity.logActivity({
      user: user._id,
      action: 'login',
      resource: 'auth',
      details: { method: 'login' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User logged in: ${email}`);
    
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    await Activity.logActivity({
      user: req.user.id,
      action: 'logout',
      resource: 'auth',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User logged out: ${req.user.email}`);
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return next(new AppError('Please provide all password fields', 400));
    }

    if (newPassword !== confirmPassword) {
      return next(new AppError('Passwords do not match', 400));
    }

    const user = await User.findById(req.user.id).select('+password');
    
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect', 401));
    }

    user.password = newPassword;
    await user.save();

    await Activity.logActivity({
      user: user._id,
      action: 'update',
      resource: 'auth',
      details: { action: 'password_change' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Password updated for user: ${user.email}`);
    
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updatePassword,
};