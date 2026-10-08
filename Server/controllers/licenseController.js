const License = require('../models/License');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

const PRICING = {
  basic: { weekly: 840, fortnightly: 1400, monthly: 2240 },
  pro: { weekly: 1680, fortnightly: 2800, monthly: 4200 },
  ultra: { weekly: 2800, fortnightly: 4760, monthly: 7000 },
};

const DURATION_MS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  fortnightly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const CURRENCY = 'PKR';

const purchase = async (req, res, next) => {
  try {
    const { tier, frequency, hwid, metadata } = req.body;

    if (!tier || !frequency || !hwid) {
      return next(new AppError('tier, frequency and hwid are required', 400));
    }

    if (!PRICING[tier]) {
      return next(new AppError(`Invalid tier: ${tier}`, 400));
    }

    if (!PRICING[tier][frequency]) {
      return next(new AppError(`Invalid frequency for ${tier}: ${frequency}`, 400));
    }

    const amount = PRICING[tier][frequency];
    const durationMs = DURATION_MS[frequency];
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + durationMs);

    const license = await License.create({
      user: req.user ? req.user.id : undefined,
      hwid: String(hwid).trim(),
      tier,
      frequency,
      amount,
      currency: CURRENCY,
      startsAt,
      expiresAt,
      metadata: metadata || {},
    });

    if (license.user) {
      await License.populate(license, 'user', 'name email');
    }

    logger.info(`License purchased: ${license.key} for user ${req.user ? req.user.id : 'anonymous'} (${tier}/${frequency})`);

    res.status(201).json({
      status: 'success',
      data: { license },
    });
  } catch (error) {
    next(error);
  }
};

const verify = async (req, res, next) => {
  try {
    const { key, hwid } = req.body;

    if (!key || !hwid) {
      return next(new AppError('key and hwid are required', 400));
    }

    const license = await License.verify(key, hwid);

    if (!license) {
      return res.status(200).json({
        status: 'success',
        data: { valid: false, license: null },
      });
    }

    res.status(200).json({
      status: 'success',
      data: { valid: true, license },
    });
  } catch (error) {
    next(error);
  }
};

const getMyLicenses = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (req.user) {
      query.user = req.user.id;
    } else {
      const hwid = String(req.body?.hwid || req.query?.hwid || "").trim();
      if (!hwid) {
        return next(new AppError('Authentication required or hwid query param needed', 401));
      }
      query.hwid = hwid;
    }
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [licenses, total] = await Promise.all([
      License.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      License.countDocuments(query),
    ]);

    res.json({
      status: 'success',
      data: {
        licenses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  purchase,
  verify,
  getMyLicenses,
  PRICING,
  DURATION_MS,
};