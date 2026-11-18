// @ts-nocheck — ported from the Express backend (modules/users/adminUsers.routes.js); logic unchanged.
import __imp0 from "@/server/lib/express";
import __imp1 from "@/server/lib/mongoose";
import __imp2 from "@/server/middleware/authMiddleware";
import __imp3 from "@/server/controllers/authController";
import __imp4 from "@/server/services/authService";
import __imp5 from "@/server/models/userModel";
import __imp6 from "@/server/utils/response";
import __imp7 from "@/server/utils/pagination";
import __imp8 from "@/server/validators/adminProfileValidator";

const { Router } = __imp0;
const mongoose = __imp1;
const { authenticate, authorize } = __imp2;
const authController = __imp3;
const authService = __imp4;
const User = __imp5;
const { sendSuccess, sendError } = __imp6;
const { paginate } = __imp7;
const { validateAdminProfile } = __imp8;

const router = Router();

// All routes here require authentication and ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

// ─── Admin Profile ──────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/admin/profile
 *
 * Update the authenticated admin's own profile.
 * Accepts: name, email, password only. Strips role from payload.
 *
 * NOTE: email changes are applied immediately — there is currently no
 * "pendingEmail + verification link" step (an earlier version of this
 * comment described one that was never implemented). Sending a confirmation
 * link to the *new* address before committing the change is the safer,
 * industry-standard pattern for this (it proves the admin actually controls
 * the new inbox before login starts requiring it) — recommended as a
 * follow-up rather than assumed to already be in place.
 */
router.patch(
  '/profile',
  validateAdminProfile,
  async (req, res, next) => {
    try {
      const result = await authService.updateAdminProfile(req.user.id, req.body);
      return sendSuccess(res, { user: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Customer User Management ───────────────────────────────────────────────

/**
 * GET /api/v1/admin/users
 *
 * Paginated list of customer accounts (role: USER only).
 * Query params: page, limit, status, search (name/email substring)
 */
router.get('/users', async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;

    const filter = { role: 'USER', isDeleted: false };
    if (status && ['active', 'blocked'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await paginate(User, filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      select: '-password -refreshToken -refreshTokenExpiresAt -passwordResetToken -passwordResetExpiresAt -verificationToken -verificationTokenExpiresAt'
    });

    return sendSuccess(res, { users: result.data }, 200, result.meta);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/users/:id
 *
 * Get a single customer user by ID.
 * Returns all profile fields except sensitive token fields.
 */
router.get('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid user ID format', 400);
    }

    const user = await User.findOne({
      _id: id,
      role: 'USER',
      isDeleted: false
    })
      .select('-password -refreshToken -refreshTokenExpiresAt -passwordResetToken -passwordResetExpiresAt -verificationToken -verificationTokenExpiresAt')
      .lean();

    if (!user) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/users/:id/status
 *
 * Block or unblock a customer account.
 * Only 'active' and 'blocked' are valid status values.
 * SECURITY: Never sets role — status updates only.
 */
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid user ID format', 400);
    }

    if (!status || !['active', 'blocked'].includes(status)) {
      return sendError(
        res,
        'VALIDATION_ERROR',
        'status must be one of: active, blocked',
        400
      );
    }

    // Find the user — only USER role customers can be managed here
    const user = await User.findOne({ _id: id, role: 'USER', isDeleted: false });
    if (!user) {
      return sendError(res, 'NOT_FOUND', 'User not found', 404);
    }

    // Update status only — role is NEVER touched
    const updated = await User.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .select('-password -refreshToken -refreshTokenExpiresAt -passwordResetToken -passwordResetExpiresAt -verificationToken -verificationTokenExpiresAt')
      .lean();

    return sendSuccess(res, { user: updated });
  } catch (err) {
    next(err);
  }
});

const __exports: any = router;

export default __exports;
