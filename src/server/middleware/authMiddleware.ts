// @ts-nocheck — ported from the Express backend (middleware/authMiddleware.js); logic unchanged.
import __imp0 from "@/server/repositories/userRepository";
import __imp1 from "@/server/utils/tokens";
import __imp2 from "@/server/utils/response";

const userRepository = __imp0;
const { verifyAccessToken } = __imp1;
const { sendError } = __imp2;

/**
 * Validates JWT, loads user from DB, attaches req.user = { id, email, role }.
 * Rejects blocked or deleted users.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return sendError(res, 'UNAUTHORIZED', 'Authentication required.', 401);

    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.id);
    if (!user || user.status !== 'active' || user.isDeleted) {
      return sendError(res, 'UNAUTHORIZED', 'Unauthorized.', 401);
    }

    req.user = { id: user._id, role: user.role, email: user.email };
    next();
  } catch {
    return sendError(res, 'UNAUTHORIZED', 'Invalid or expired token.', 401);
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: router.use(authorize('ADMIN'))
 */
const authorize = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return sendError(res, 'FORBIDDEN', 'Insufficient permissions.', 403);
  }
  next();
};

/**
 * Like authenticate, but never rejects. Attaches req.user when a valid token
 * is present; otherwise continues as a guest (req.user undefined).
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return next();
    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.id);
    if (user && user.status === 'active' && !user.isDeleted) {
      req.user = { id: user._id, role: user.role, email: user.email };
    }
  } catch {
    // invalid token → treat as guest
  }
  next();
};

const __exports: any = { authenticate, authorize, optionalAuthenticate };

export default __exports;
