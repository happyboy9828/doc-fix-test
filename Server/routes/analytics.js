const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const secretKey = process.env.DASHBOARD_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Server configuration error: DASHBOARD_SECRET_KEY not set',
    });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      message: 'Unauthorized: Missing or invalid Authorization header',
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== secretKey) {
    return res.status(401).json({
      status: 'fail',
      message: 'Unauthorized: Invalid API key',
    });
  }

  next();
};

router.post('/track', analyticsController.trackEvent);
router.get('/analytics/summary', authMiddleware, analyticsController.getAnalyticsSummary);

module.exports = router;