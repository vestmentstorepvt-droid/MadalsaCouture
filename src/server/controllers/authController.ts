// @ts-nocheck — ported from the Express backend (controllers/authController.js); logic unchanged.
import __imp0 from "@/server/services/authService";
import __imp1 from "@/server/utils/response";
import __imp2 from "@/server/services/metaConversionsService";
import __imp3 from "@/server/config/logger";
import __imp4 from "@/server/config/urls";

const authService = __imp0;
const { sendSuccess } = __imp1;
const metaCapi = __imp2;
const logger = __imp3;
const { FRONTEND_URL } = __imp4;

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.registerUser(req.body);

      // ── Meta CAPI: CompleteRegistration event ──────────────────────────
      // Fire-and-forget after successful signup. The user's email and phone
      // from the registration form provide high Event Match Quality.
      if (result?.user) {
        const u = result.user;
        metaCapi.trackCompleteRegistration(
          req,
          {
            user: {
              email:     u.email || req.body.email,
              phone:     u.phone || req.body.phone,
              firstName: u.name?.split(' ')[0],
              lastName:  u.name?.split(' ').slice(1).join(' '),
            },
          },
          `reg_${u._id || u.id}_${Date.now()}`,
        ).catch((err) => {
          logger.error(`[MetaCAPI] CompleteRegistration event failed: ${err.message}`);
        });
      }
      // ──────────────────────────────────────────────────────────────────

      return sendSuccess(res, { user: result.user }, 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.loginUser(email, password, req.ip);
      res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
      return sendSuccess(res, { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user, expiresIn: '15m', role: result.user.role });
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req, res, next) {
    try {
      const token = req.body.token || req.body.idToken || req.body.credential || req.body.accessToken;
      const mode = req.body.mode || 'login';
      const result = await authService.googleLogin(token, mode);

      if (mode === 'signup') {
        return sendSuccess(res, { user: result.user, message: result.message }, 201);
      }

      res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
      return sendSuccess(res, { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user, expiresIn: '15m', role: result.user.role, message: result.message });
    } catch (error) {
      next(error);
    }
  }


  async forgotPassword(req, res, next) {

    try {
      const result = await authService.forgotPassword(req.body.email);
      return sendSuccess(res, {});
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    // Email verification has been removed
    return res.redirect(`${FRONTEND_URL}/`);
  }

  async refreshToken(req, res, next) {
    try {
      const refreshTokenValue = req.cookies.refreshToken || req.body.refreshToken;
      const result = await authService.refreshToken(refreshTokenValue);
      return sendSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        expiresIn: '15m'
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body.token, req.body.newPassword);
      return sendSuccess(res, {});
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const result = await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
      return sendSuccess(res, {});
    } catch (error) {
      next(error);
    }
  }

  async changeEmail(req, res, next) {
    try {
      const result = await authService.changeEmail(req.user.id, req.body.currentPassword, req.body.newEmail);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailChange(req, res, next) {
    try {
      const result = await authService.verifyEmailChange(req.body.token);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const result = await authService.getProfile(req.user.id);
      return sendSuccess(res, { user: result });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const result = await authService.updateProfile(req.user.id, req.body);
      return sendSuccess(res, { user: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const result = await authService.logout(req.user.id, req.cookies.refreshToken || req.body.refreshToken);
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return sendSuccess(res, {});
    } catch (error) {
      next(error);
    }
  }

  // Admin profile update — only name, email, password allowed; role is never updated
  async updateAdminProfile(req, res, next) {
    try {
      const result = await authService.updateAdminProfile(req.user.id, req.body);
      return sendSuccess(res, { user: result });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new AuthController();

export default __exports;
