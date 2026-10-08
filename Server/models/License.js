const mongoose = require('mongoose');
const crypto = require('crypto');

const generateLicenseKey = () => {
  const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
  const groups = raw.match(/.{1,4}/g) || [];
  return `DOCFIX-${groups.join('-')}`;
};

const licenseSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    hwid: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ['basic', 'pro', 'ultra'],
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'fortnightly', 'monthly'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'PKR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'pending'],
      default: 'active',
      index: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
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

licenseSchema.index({ user: 1, status: 1 });
licenseSchema.index({ hwid: 1, status: 1 });
licenseSchema.index({ expiresAt: 1 });

licenseSchema.pre('validate', function (next) {
  if (!this.key) {
    this.key = generateLicenseKey();
  }
  next();
});

licenseSchema.statics.generateKey = generateLicenseKey;

licenseSchema.statics.findActiveForHwid = async function (hwid) {
  return this.find({
    hwid,
    status: 'active',
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
};

licenseSchema.statics.verify = async function (key, hwid) {
  if (!key || !hwid) return null;
  const normalized = String(key).trim().toUpperCase();
  return this.findOne({
    key: normalized,
    hwid,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).populate('user', 'name email');
};

licenseSchema.methods.isActive = function () {
  return this.status === 'active' && this.expiresAt > new Date();
};

module.exports = mongoose.model('License', licenseSchema);