// @ts-nocheck — ported from the Express backend (services/authService.js); logic unchanged.
import __imp0 from "bcryptjs";
import * as __imp1 from "node:crypto";
import __imp2 from "@/server/repositories/userRepository";
import __imp3 from "@/server/utils/tokens";
import __imp4 from "@/server/constants/messages";
import __imp5 from "@/server/config/logger";
import __imp6 from "@/server/emails/mailer";
import __imp7 from "@/server/services/notificationService";
import * as __imp8 from "google-auth-library";
import __imp9 from "@/server/config/urls";

const bcrypt = __imp0;
const crypto = __imp1;
const userRepository = __imp2;
const { createAccessToken, createRefreshToken, verifyRefreshToken, hashToken } = __imp3;
const { SUCCESS, ERROR, ROLES } = __imp4;
const logger = __imp5;
const { sendMail } = __imp6;
const notificationService = __imp7;
const { OAuth2Client } = __imp8;
const googleClient = new OAuth2Client();
const { FRONTEND_URL } = __imp9;

class AuthService {

  async verifyGoogleToken(token) {
    const clientId = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.trim();
    if (!clientId) {
      throw Object.assign(new Error('Google authentication is not configured.'), { statusCode: 500 });
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: clientId
      });
      const payload = ticket && ticket.getPayload();
      const validIssuer = payload && (
        payload.iss === 'accounts.google.com' ||
        payload.iss === 'https://accounts.google.com'
      );
      const validAudience = payload && payload.aud === clientId;
      const validClaims = payload &&
        typeof payload.sub === 'string' && payload.sub.trim() &&
        typeof payload.email === 'string' && payload.email.trim() &&
        payload.email_verified === true;

      if (!validIssuer || !validAudience || !validClaims) {
        throw new Error('Google ID token has invalid issuer, audience, or required claims.');
      }

      return {
        email: payload.email,
        name: payload.name || payload.given_name || payload.email.split('@')[0],
        googleId: payload.sub,
        picture: payload.picture,
        emailVerified: payload.email_verified
      };
    } catch (err) {
      logger.debug(`google-auth-library verifyIdToken error: ${err.message}`);
    }

    throw Object.assign(new Error('Invalid or expired Google token.'), { statusCode: 401 });
  }

  async googleLogin(token, mode = 'login') {
    const googleUser = await this.verifyGoogleToken(token);
    const email = googleUser.email.trim().toLowerCase();

    let user = await userRepository.findByEmail(email);

    if (mode === 'signup') {
      if (user) {
        throw Object.assign(new Error('An account with this email already exists. Please sign in.'), { statusCode: 409 });
      }

      user = await userRepository.create({
        name: googleUser.name || email.split('@')[0],
        email: email,
        authProvider: 'google',
        role: ROLES.USER, // STRICTLY USER ROLE ONLY
        status: 'active',
        isEmailVerified: true
      });

      notificationService.send('welcome', user.email, { name: user.name }, user._id);
      logger.info(`New user registered via Google SSO: ${user.email}`);

      return {
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        message: 'Account created successfully. Please sign in.'
      };
    }

    // mode === 'login'
    if (!user) {
      throw Object.assign(new Error('No account found with this email. Please sign up first.'), { statusCode: 404 });
    }

    if (user.status === 'blocked') {
      throw Object.assign(new Error('Your account has been blocked. Please contact support.'), { statusCode: 403 });
    }

    if (user.role === ROLES.ADMIN) {
      throw Object.assign(new Error('Google Sign-In is only allowed for User accounts.'), { statusCode: 403 });
    }

    const accessToken = createAccessToken({ id: user._id, role: user.role });
    const refreshToken = createRefreshToken({ id: user._id, role: user.role });
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.updateById(user._id, {
      authProvider: 'google',
      isEmailVerified: true,
      refreshToken: hashToken(refreshToken),
      refreshTokenExpiresAt,
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date()
    });

    logger.info(`User logged in via Google: ${user.email}`);
    return {
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      message: SUCCESS.LOGIN
    };
  }



  async registerUser(data) {
    const existingEmail = await userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw Object.assign(new Error(ERROR.DUPLICATE_EMAIL), { statusCode: 409 });
    }

    const existingPhone = data.phone ? await userRepository.findByPhone(data.phone) : null;
    if (existingPhone) {
      throw Object.assign(new Error(ERROR.DUPLICATE_PHONE), { statusCode: 409 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    // SECURITY: role is always 'USER' on registration — any supplied role value is silently ignored
    const user = await userRepository.create({
      name: data.name,
      email: data.email,
      ...(data.phone ? { phone: data.phone } : {}),
      password: hashedPassword,
      role: ROLES.USER,          // always USER — never trust client input for role
      status: 'active'
    });

    // Fire-and-forget welcome notification
    notificationService.send('welcome', user.email, { name: user.name }, user._id);

    logger.info(`User registered: ${user.email}`);
    return { user: { id: user._id, name: user.name, email: user.email, phone: user.phone || null, role: user.role }, message: SUCCESS.REGISTER };
  }

  async loginUser(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    // Blocked users cannot log in
    if (user.status === 'blocked') {
      throw Object.assign(new Error('Your account has been blocked. Please contact support.'), { statusCode: 403 });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      throw Object.assign(new Error('Account temporarily locked. Please try again later.'), { statusCode: 423 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const attempts = (user.loginAttempts || 0) + 1;
      const lockUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : null;
      await userRepository.updateById(user._id, {
        loginAttempts: attempts,
        ...(lockUntil ? { lockUntil } : {})
      });
      logger.warn(`Failed login for ${email}`);
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    const accessToken = createAccessToken({ id: user._id, role: user.role });
    const refreshToken = createRefreshToken({ id: user._id, role: user.role });
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.updateById(user._id, {
      refreshToken: hashToken(refreshToken),
      refreshTokenExpiresAt,
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date()
    });

    logger.info(`User logged in: ${user.email}`);
    return {
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      message: SUCCESS.LOGIN
    };
  }

  async forgotPassword(email) {
    const user = await userRepository.findOne({ email });
    if (!user) {
      return { message: SUCCESS.FORGOT_PASSWORD };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await userRepository.updateOne({ _id: user._id }, {
      passwordResetToken: hashToken(token),
      passwordResetExpiresAt: expires
    });

    const resetPageUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Please reset your password using the following link: ${resetPageUrl}`,
      html: `<p>To reset your password, click the button below:</p><p><a href="${resetPageUrl}" style="display:inline-block;padding:12px 24px;background-color:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a></p><p>If the button does not work, copy and paste the following link into your browser:</p><p>${resetPageUrl}</p>`
    });

    // Fire-and-forget template-based password reset notification
    notificationService.send('password_reset', user.email, { name: user.name, resetUrl: resetPageUrl }, user._id);

    logger.info(`Password reset requested: ${email}`);
    return { message: SUCCESS.FORGOT_PASSWORD };
  }

  async refreshToken(refreshTokenValue) {
    if (!refreshTokenValue) {
      throw Object.assign(new Error(ERROR.TOKEN_INVALID), { statusCode: 401 });
    }

    const decoded = verifyRefreshToken(refreshTokenValue);
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw Object.assign(new Error(ERROR.TOKEN_INVALID), { statusCode: 401 });
    }

    const tokenHash = hashToken(refreshTokenValue);
    if (user.refreshToken !== tokenHash) {
      throw Object.assign(new Error(ERROR.TOKEN_INVALID), { statusCode: 401 });
    }

    const newAccessToken = createAccessToken({ id: user._id, role: user.role });
    const newRefreshToken = createRefreshToken({ id: user._id, role: user.role });
    const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await userRepository.updateById(user._id, {
      refreshToken: hashToken(newRefreshToken),
      refreshTokenExpiresAt: newRefreshExpiresAt
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, address: user.address || null }
    };
  }

  async resetPassword(token, newPassword) {
    const hashedToken = hashToken(token);
    const user = await userRepository.findOne({ passwordResetToken: hashedToken, passwordResetExpiresAt: { $gt: Date.now() } });
    if (!user) {
      throw Object.assign(new Error(ERROR.TOKEN_INVALID), { statusCode: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updateById(user._id, {
      password: passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      refreshToken: null,
      refreshTokenExpiresAt: null
    });

    logger.info(`Password reset for user: ${user.email}`);
    return { message: SUCCESS.RESET_PASSWORD };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user || !user.password) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updateById(userId, { password: passwordHash, refreshToken: null, refreshTokenExpiresAt: null });
    logger.info(`Password changed for user: ${user.email}`);
    return { message: SUCCESS.CHANGE_PASSWORD };
  }

  async changeEmail(userId, currentPassword, newEmail) {
    const user = await userRepository.findById(userId);
    if (!user || !user.password) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 401 });
    }

    const existingEmail = await userRepository.findOne({ email: newEmail });
    if (existingEmail && existingEmail._id.toString() !== userId.toString()) {
      throw Object.assign(new Error(ERROR.DUPLICATE_EMAIL), { statusCode: 409 });
    }

    // Generate verification token for email change
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store pending email change and token
    await userRepository.updateById(userId, {
      emailChangeToken: hashToken(token),
      emailChangeTokenExpiresAt: expires,
      newEmailPending: newEmail
    });

    // Send verification email to NEW email address
    const verificationUrl = `${FRONTEND_URL}/verify-email-change?token=${token}`;
    await sendMail({
      to: newEmail,
      subject: 'Confirm Your Email Change',
      text: `Please confirm your email change using the following link: ${verificationUrl}`,
      html: `<p>To confirm your email change, click the button below:</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 24px;background-color:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a></p><p>If the button does not work, copy and paste the following link into your browser:</p><p>${verificationUrl}</p><p>This link will expire in 24 hours.</p>`
    });

    logger.info(`Email change verification sent: ${user.email} → ${newEmail}`);
    return { message: 'Verification email sent. Please check your new email address to confirm the change.' };
  }

  async verifyEmailChange(token) {
    const hashedToken = hashToken(token);
    const user = await userRepository.findOne({
      emailChangeToken: hashedToken,
      emailChangeTokenExpiresAt: { $gt: Date.now() }
    });

    if (!user || !user.newEmailPending) {
      throw Object.assign(new Error('Invalid or expired verification token.'), { statusCode: 400 });
    }

    // Update email and clear verification fields
    await userRepository.updateById(user._id, {
      email: user.newEmailPending,
      emailChangeToken: null,
      emailChangeTokenExpiresAt: null,
      newEmailPending: null
    });

    logger.info(`Email verified and changed for user: ${user.email} → ${user.newEmailPending}`);
    return { message: 'Email successfully verified and updated.' };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 404 });
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      address: user.address || null
    };
  }

  async updateProfile(userId, data) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Object.assign(new Error(ERROR.INVALID_CREDENTIALS), { statusCode: 404 });
    }

    const update = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;

    // SECURITY: role field is always stripped — no profile update may change role

    if (Object.keys(update).length === 0) {
      return this.getProfile(userId);
    }

    await userRepository.updateById(userId, update);
    return this.getProfile(userId);
  }

  async logout(userId, refreshTokenValue) {
    if (refreshTokenValue) {
      await userRepository.updateOne({ _id: userId }, { refreshToken: null, refreshTokenExpiresAt: null });
    }
    return { message: SUCCESS.LOGOUT };
  }

  // Admin bootstrap is handled by scripts/seedAdmin.js — not an API concern.
  // No API method creates ADMIN accounts.

  /**
   * Admin-only profile update.
   * Accepts: name, email, password only.
   * SECURITY: role is always stripped regardless of what is passed.
   */
  async updateAdminProfile(userId, data) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Object.assign(new Error(ERROR.NOT_FOUND), { statusCode: 404 });
    }

    const update = {};

    // Only accept safe fields — role is NEVER in this list
    if (data.name !== undefined) update.name = data.name;

    if (data.password !== undefined) {
      update.password = await bcrypt.hash(data.password, 12);
      // Invalidate refresh tokens on password change
      update.refreshToken = null;
      update.refreshTokenExpiresAt = null;
    }

    if (data.email !== undefined && data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && existing._id.toString() !== userId.toString()) {
        throw Object.assign(new Error(ERROR.DUPLICATE_EMAIL), { statusCode: 409 });
      }
      // Generate verification token for admin email change
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      update.emailChangeToken = hashToken(token);
      update.emailChangeTokenExpiresAt = expires;
      update.newEmailPending = data.email;

      // Send verification email to NEW email address
      const verificationUrl = `${FRONTEND_URL}/verify-email-change?token=${token}`;
      await sendMail({
        to: data.email,
        subject: 'Confirm Your Email Change',
        text: `Please confirm your email change using the following link: ${verificationUrl}`,
        html: `<p>To confirm your email change, click the button below:</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 24px;background-color:#1a73e8;color:#ffffff;text-decoration:none;border-radius:6px;">Verify Email</a></p><p>If the button does not work, copy and paste the following link into your browser:</p><p>${verificationUrl}</p><p>This link will expire in 24 hours.</p>`
      });
    }

    if (Object.keys(update).length === 0) {
      return this.getProfile(userId);
    }

    await userRepository.updateById(userId, update);
    return this.getProfile(userId);
  }
}

const __exports: any = new AuthService();

export default __exports;
