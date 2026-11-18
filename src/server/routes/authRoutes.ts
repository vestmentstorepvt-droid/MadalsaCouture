// @ts-nocheck — ported from the Express backend (routes/authRoutes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/controllers/authController";
import __imp2 from "@/server/validators/authValidator";
import __imp3 from "@/server/middleware/authMiddleware";
import __imp4 from "@/server/middleware/security";
import __imp5 from "@/server/validators/adminProfileValidator";

const express = __imp0;
const authController = __imp1;
const {
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
} = __imp2;
const { authenticate, authorize } = __imp3;
const { authLimiter } = __imp4;
const { validateAdminProfile } = __imp5;

const router = express.Router();

// Apply auth rate limiter to all routes on this router
router.use(authLimiter);

router.post('/register', validateRegister, handleValidationErrors, authController.register);
router.post('/login', validateLogin, handleValidationErrors, authController.login);
router.post('/google', validateGoogleLogin, handleValidationErrors, authController.googleLogin);
router.post('/forgot-password', validateForgotPassword, handleValidationErrors, authController.forgotPassword);

router.post('/refresh-token', authController.refreshToken);
router.post('/reset-password', validateResetPassword, handleValidationErrors, authController.resetPassword);
router.post('/change-password', authenticate, validateChangePassword, handleValidationErrors, authController.changePassword);
router.post('/change-email', authenticate, validateEmailChange, handleValidationErrors, authController.changeEmail);
router.post('/verify-email-change', validateVerifyEmailChange, handleValidationErrors, authController.verifyEmailChange);
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, validateProfileUpdate, handleValidationErrors, authController.updateProfile);

// Admin profile update — ADMIN only, strips role field in service layer
router.patch('/admin-profile', authenticate, authorize('ADMIN'), validateAdminProfile, authController.updateAdminProfile);

const __exports: any = router;

export default __exports;
