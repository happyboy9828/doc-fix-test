const Plan = require('../models/Plan');
const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const createPlan = async (req, res, next) => {
  try {
    const { title, description, status, priority, startDate, endDate, tags, collaborators } = req.body;
    
    const plan = await Plan.create({
      title,
      description,
      status,
      priority,
      startDate,
      endDate,
      tags,
      collaborators,
      owner: req.user.id,
    });

    await Activity.logActivity({
      user: req.user.id,
      action: 'create',
      resource: 'plan',
      resourceId: plan._id,
      details: { title: plan.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Plan created: ${plan.title} by user ${req.user.id}`);
    
    res.status(201).json({
      status: 'success',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

const getPlans = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, priority, sort = '-createdAt' } = req.query;
    
    const result = await Plan.getUserPlans(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      priority,
      sort,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getPlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators', 'name email');
    
    if (!plan) {
      return next(new AppError('Plan not found', 404));
    }

    const isOwner = plan.owner._id.toString() === req.user.id;
    const isCollaborator = plan.collaborators.some(c => c._id.toString() === req.user.id);
    
    if (!isOwner && !isCollaborator) {
      return next(new AppError('Not authorized to access this plan', 403));
    }

    res.json({
      status: 'success',
      data: { plan },
    });
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const { title, description, status, priority, startDate, endDate, progress, tags, collaborators } = req.body;
    
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return next(new AppError('Plan not found', 404));
    }

    const isOwner = plan.owner.toString() === req.user.id;
    if (!isOwner) {
      return next(new AppError('Not authorized to update this plan', 403));
    }

    const updatedFields = {};
    if (title) updatedFields.title = title;
    if (description) updatedFields.description = description;
    if (status) updatedFields.status = status;
    if (priority) updatedFields.priority = priority;
    if (startDate) updatedFields.startDate = startDate;
    if (endDate) updatedFields.endDate = endDate;
    if (progress !== undefined) updatedFields.progress = progress;
    if (tags) updatedFields.tags = tags;
    if (collaborators) updatedFields.collaborators = collaborators;

    const updatedPlan = await Plan.findByIdAndUpdate(
      req.params.id,
      updatedFields,
      { new: true, runValidators: true }
    ).populate('owner', 'name email')
     .populate('collaborators', 'name email');

    await Activity.logActivity({
      user: req.user.id,
      action: 'update',
      resource: 'plan',
      resourceId: plan._id,
      details: { updatedFields: Object.keys(updatedFields) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Plan updated: ${plan.title} by user ${req.user.id}`);
    
    res.json({
      status: 'success',
      data: { plan: updatedPlan },
    });
  } catch (error) {
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return next(new AppError('Plan not found', 404));
    }

    const isOwner = plan.owner.toString() === req.user.id;
    if (!isOwner) {
      return next(new AppError('Not authorized to delete this plan', 403));
    }

    await Plan.findByIdAndDelete(req.params.id);

    await Activity.logActivity({
      user: req.user.id,
      action: 'delete',
      resource: 'plan',
      resourceId: plan._id,
      details: { title: plan.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`Plan deleted: ${plan.title} by user ${req.user.id}`);
    
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const getPlanStats = async (req, res, next) => {
  try {
    const stats = await Plan.aggregate([
      {
        $match: {
          $or: [
            { owner: req.user._id },
            { collaborators: req.user._id },
          ],
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProgress: { $avg: '$progress' },
        },
      },
    ]);

    const totalPlans = await Plan.countDocuments({
      $or: [
        { owner: req.user._id },
        { collaborators: req.user._id },
      ],
    });

    const overduePlans = await Plan.countDocuments({
      $or: [
        { owner: req.user._id },
        { collaborators: req.user._id },
      ],
      endDate: { $lt: new Date() },
      status: { $ne: 'completed' },
    });

    res.json({
      status: 'success',
      data: {
        stats,
        summary: {
          totalPlans,
          overduePlans,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
  getPlanStats,
};