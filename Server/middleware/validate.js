const { body, query, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }
  next();
};

const idParamValidation = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  validate,
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isString().withMessage('Sort must be a string'),
  query('fields').optional().isString().withMessage('Fields must be a string'),
  validate,
];

module.exports = {
  validate,
  idParamValidation,
  paginationValidation,
  body,
  query,
  param,
};