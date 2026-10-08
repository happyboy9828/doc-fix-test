const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const planController = require('../controllers/planController');
const licenseController = require('../controllers/licenseController');
const analyticsRouter = require('./analytics');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');
const { validate, body, paginationValidation, idParamValidation } = require('../middleware/validate');

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
    validate,
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login
);

router.post('/logout', authController.logout);

router.use('/analytics', analyticsRouter);

router.use(protect);

router.get('/me', authController.getMe);
router.patch(
  '/update-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.newPassword).withMessage('Passwords do not match'),
    validate,
  ],
  authController.updatePassword
);

router.get('/users', restrictTo('admin'), userController.getUsers);
router.post(
  '/users',
  restrictTo('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate,
  ],
  userController.createUser
);
router.get('/users/:id', restrictTo('admin'), idParamValidation, userController.getUser);
router.patch('/users/:id', restrictTo('admin'), idParamValidation, userController.updateUser);
router.delete('/users/:id', restrictTo('admin'), idParamValidation, userController.deleteUser);
router.get('/users/:id/activity', restrictTo('admin'), idParamValidation, paginationValidation, userController.getUserActivity);

router.get('/plans', paginationValidation, planController.getPlans);
router.get('/plans/stats', planController.getPlanStats);
router.post(
  '/plans',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('status').optional().isIn(['draft', 'active', 'paused', 'completed', 'archived']).withMessage('Invalid status'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
    body('progress').optional().isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('collaborators').optional().isArray().withMessage('Collaborators must be an array'),
    validate,
  ],
  planController.createPlan
);
router.get('/plans/:id', idParamValidation, planController.getPlan);
router.patch('/plans/:id', idParamValidation, planController.updatePlan);
router.delete('/plans/:id', idParamValidation, planController.deletePlan);

router.post(
  '/licenses/purchase',
  optionalAuth,
  [
    body('tier').isIn(['basic', 'pro', 'ultra']).withMessage('Invalid tier'),
    body('frequency').isIn(['weekly', 'fortnightly', 'monthly']).withMessage('Invalid frequency'),
    body('hwid').trim().notEmpty().withMessage('Hardware ID (hwid) is required'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
    validate,
  ],
  licenseController.purchase
);

router.post('/licenses/verify', licenseController.verify);

router.get('/licenses/me', optionalAuth, paginationValidation, licenseController.getMyLicenses);

module.exports = router;