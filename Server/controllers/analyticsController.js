const AnalyticsEvent = require('../models/AnalyticsEvent');
const catchAsync = require('../utils/catchAsync');

const getCountryFromHeaders = (req) => {
  return req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'UNKNOWN';
};

const normalizeDevice = (device) => {
  const d = (device || '').toLowerCase();
  if (['mobile', 'desktop', 'tablet'].includes(d)) return d;
  return 'unknown';
};

exports.trackEvent = catchAsync(async (req, res) => {
  const { category, device } = req.body;

  if (!category || typeof category !== 'string') {
    return res.status(400).json({
      status: 'fail',
      message: 'category is required and must be a string',
    });
  }

  const country = getCountryFromHeaders(req).toUpperCase();
  const normalizedDevice = normalizeDevice(device);

  await AnalyticsEvent.create({
    category: category.trim(),
    device: normalizedDevice,
    country,
  });

  res.status(201).json({
    status: 'success',
    message: 'Event tracked',
  });
});

exports.getAnalyticsSummary = catchAsync(async (req, res) => {
  const [totalVisitors, categories, countries, devices] = await Promise.all([
    AnalyticsEvent.countDocuments(),
    AnalyticsEvent.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, country: '$_id', count: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, device: '$_id', count: 1 } },
    ]),
  ]);

  const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
  devices.forEach((d) => {
    deviceBreakdown[d.device] = d.count;
  });

  res.json({
    status: 'success',
    data: {
      total_visitors: totalVisitors,
      categories,
      countries,
      devices: deviceBreakdown,
    },
  });
});