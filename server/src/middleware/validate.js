const { body, param, query } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 characters'),
  body('role').isIn(['admin', 'school', 'org']).withMessage('Valid role required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('schoolRef').optional().trim(),
  body('schoolAccessRole').optional().isIn(['admin', 'finance', 'staff', 'viewer']),
];

const createStudentValidation = [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name is required'),
  body('fatherName').trim().isLength({ min: 2, max: 255 }).withMessage('Father name is required'),
  body('class').trim().notEmpty().withMessage('Class is required'),
  body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
  body('phone').optional().trim(),
  body('cnic').optional().trim(),
  body('section').optional().trim(),
  body('address').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format'),
  body('admissionDate').optional().isISO8601().withMessage('Invalid date format'),
];

const createApplicantValidation = [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name is required'),
  body('fatherName').trim().isLength({ min: 2, max: 255 }).withMessage('Father name is required'),
  body('cnic').trim().notEmpty().withMessage('CNIC is required'),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('district').optional().trim(),
  body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
  body('qualification').optional().trim(),
  body('serviceId').optional().trim(),
];

const billInquiryValidation = [
  body('consumerNumber').trim().notEmpty().withMessage('Consumer number is required'),
  body('voucherNumber').optional().trim(),
  body('billerCode').optional().trim(),
];

const billPaymentValidation = [
  body('consumerNumber').trim().notEmpty().withMessage('Consumer number is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('transactionId').trim().notEmpty().withMessage('Transaction ID is required'),
  body('paidAt').isISO8601().withMessage('Valid payment date is required'),
  body('channel').isIn(['jazzcash', 'easypaisa', 'bank_app', 'atm', 'counter', 'cash_offline']).withMessage('Invalid payment channel'),
];

const createPaymentValidation = [
  body('applicantId').optional().trim(),
  body('applicant_id').optional().trim(),
  body('applicationId').optional().trim(),
  body('application_id').optional().trim(),
  body('postingId').optional().trim(),
  body('posting_id').optional().trim(),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('dueDate').optional().trim(),
  body('due_date').optional().trim(),
];

const paymentCallbackValidation = [
  body('billId').trim().notEmpty().withMessage('Bill ID is required'),
  body('status').isIn(['paid', 'failed', 'expired']).withMessage('Status must be paid, failed, or expired'),
  body('transactionId').trim().notEmpty().withMessage('Transaction ID is required'),
  body('paidAt').optional().isISO8601(),
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 10000 }).toInt(),
];

const idParam = [
  param('id').notEmpty().withMessage('ID is required'),
];

module.exports = {
  loginValidation,
  createUserValidation,
  createStudentValidation,
  createApplicantValidation,
  billInquiryValidation,
  billPaymentValidation,
  createPaymentValidation,
  paymentCallbackValidation,
  paginationValidation,
  idParam,
};
