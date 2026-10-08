const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login',
        'logout',
        'create',
        'read',
        'update',
        'delete',
        'view',
        'download',
        'upload',
        'share',
        'comment',
        'like',
      ],
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1 });
activitySchema.index({ resource: 1 });
activitySchema.index({ createdAt: -1 });

activitySchema.statics.logActivity = async function (data) {
  return await this.create(data);
};

activitySchema.statics.getUserActivity = async function (userId, options = {}) {
  const { page = 1, limit = 20, action, resource, startDate, endDate } = options;
  
  const query = { user: userId };
  
  if (action) query.action = action;
  if (resource) query.resource = resource;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  
  const [activities, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email'),
    this.countDocuments(query),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

module.exports = mongoose.model('Activity', activitySchema);