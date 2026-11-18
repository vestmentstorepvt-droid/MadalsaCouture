// @ts-nocheck — ported from the Express backend (validators/authValidator.js); logic unchanged.
import * as __imp0 from "express-validator";
import __imp1 from "@/server/utils/response";

const { body, validationResult } = __imp0;
const { sendValidationError } = __imp1;

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required.').isLength({ min: 3 }).withMessage('Name must be at least 3 characters long.'),
  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please enter a valid email.'),
  body('phone').trim().notEmpty().withMessage('Phone is required.').matches(/^\d{10}$/).withMessage('Phone must be exactly 10 digits.'),
  body('password').notEmpty().withMessage('Password is required.').matches(passwordPolicy).withMessage('Password must contain at least 8 characters including uppercase, lowercase, number and special character.'),
  body('confirmPassword').notEmpty().withMessage('Please confirm your password.').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  })
];

const validateLogin = [
  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please enter a valid email.'),
  body('password').notEmpty().withMessage('Password is required.')
];

const validateGoogleLogin = [
  body().custom((value, { req }) => {
    const token = req.body.token || req.body.idToken || req.body.credential || req.body.accessToken;
    if (!token) {
      throw new Error('Google token is required.');
    }
    return true;
  })
];

const validateForgotPassword = [

  body('email').trim().notEmpty().withMessage('Email is required.').isEmail().withMessage('Please enter a valid email.')
];

const validateResetPassword = [
  body('token').notEmpty().withMessage('Token is required.'),
  body('newPassword').notEmpty().withMessage('New password is required.').matches(passwordPolicy).withMessage('Password must contain at least 8 characters including uppercase, lowercase, number and special character.'),
  body('confirmPassword').notEmpty().withMessage('Please confirm your password.').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match.');
    }
    return true;
  })
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').notEmpty().withMessage('New password is required.').matches(passwordPolicy).withMessage('Password must contain at least 8 characters including uppercase, lowercase, number and special character.'),
  body('confirmPassword').notEmpty().withMessage('Please confirm your password.').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match.');
    }
    return true;
  })
];

const validateEmailChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newEmail').trim().notEmpty().withMessage('New email is required.').isEmail().withMessage('Please enter a valid email.')
];

const validateVerifyEmailChange = [
  body('token').notEmpty().withMessage('Verification token is required.')
];

const validateProfileUpdate = [
  body('name').optional().trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters long.'),
  body('phone').optional().trim().matches(/^\d{10}$/).withMessage('Phone must be exactly 10 digits.'),
  body('address.country').optional().trim().notEmpty().withMessage('Country is required.'),
  body('address.state').optional().trim().notEmpty().withMessage('State is required.'),
  body('address.city').optional().trim().notEmpty().withMessage('City is required.'),
  body('address.addressLine').optional().trim().isLength({ min: 10, max: 255 }).withMessage('Address line must be between 10 and 255 characters.'),
  body('address.pincode').optional().trim().matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits.')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, 'Validation failed.', errors.array().map((err) => ({ field: err.path, message: err.msg })));
  }
  next();
};

const __exports: any = {
  validateRegister,
  validateLogin,
  validateGoogleLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateEmailChange,
  validateVerifyEmailChange,
  validateProfileUpdate,
  handleValidationErrors
};


export default __exports;
