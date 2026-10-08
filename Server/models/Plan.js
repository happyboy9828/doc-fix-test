const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Plan title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      default: 'draft',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
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

planSchema.index({ owner: 1, status: 1 });
planSchema.index({ owner: 1, createdAt: -1 });
planSchema.index({ status: 1 });
planSchema.index({ tags: 1 });

planSchema.virtual('isOverdue').get(function () {
  if (this.endDate && this.status !== 'completed') {
    return new Date() > this.endDate;
  }
  return false;
});

planSchema.virtual('daysRemaining').get(function () {
  if (this.endDate) {
    const diffTime = this.endDate - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

planSchema.pre('save', function (next) {
  if (this.status === 'completed' && this.progress < 100) {
    this.progress = 100;
  }
  if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
  }
  next();
});

planSchema.statics.getUserPlans = async function (userId, options = {}) {
  const { page = 1, limit = 10, status, priority, sort = '-createdAt' } = options;
  
  const query = {
    $or: [
      { owner: userId },
      { collaborators: userId },
    ],
  };
  
  if (status) query.status = status;
  if (priority) query.priority = priority;

  const skip = (page - 1) * limit;
  
  const [plans, total] = await Promise.all([
    this.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('owner', 'name email')
      .populate('collaborators', 'name email'),
    this.countDocuments(query),
  ]);

  return {
    plans,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

module.exports = mongoose.model('Plan', planSchema);