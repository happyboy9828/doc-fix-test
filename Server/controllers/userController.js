const User = require('../models/User');
const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    const user = await User.create({ name, email, password, role });
    
    await Activity.logActivity({
      user: user._id,
      action: 'create',
      resource: 'user',
      resourceId: user._id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User created: ${user.email}`);
    
    res.status(201).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt', role, isActive } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      status: 'success',
      results: users.length,
      data: { users },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
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

const updateUser = async (req, res, next) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, isActive },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    await Activity.logActivity({
      user: user._id,
      action: 'update',
      resource: 'user',
      resourceId: user._id,
      details: { updatedFields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User updated: ${user.email}`);
    
    res.json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    await Activity.logActivity({
      user: user._id,
      action: 'delete',
      resource: 'user',
      resourceId: user._id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User deleted: ${user.email}`);
    
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const getUserActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, resource, startDate, endDate } = req.query;
    
    const result = await Activity.getUserActivity(req.params.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      action,
      resource,
      startDate,
      endDate,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserActivity,
};