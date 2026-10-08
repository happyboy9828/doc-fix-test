const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    device: {
      type: String,
      required: true,
      trim: true,
      enum: ['mobile', 'desktop', 'tablet', 'unknown'],
      default: 'unknown',
    },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'UNKNOWN',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

analyticsEventSchema.index({ category: 1, createdAt: -1 });
analyticsEventSchema.index({ country: 1, createdAt: -1 });
analyticsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);