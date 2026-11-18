// @ts-nocheck — ported from the Express backend (utils/tokens.js); logic unchanged.
import __imp0 from "jsonwebtoken";
import * as __imp1 from "node:crypto";

/**
 * Token utilities — single JWT system for all roles (ADMIN + USER).
 * Secrets: JWT_ACCESS_SECRET (access, 15m) and JWT_REFRESH_SECRET (refresh, 7d).
 * Role is embedded in the payload by the caller.
 * There are NO separate admin JWT secrets.
 * Role-based access control is enforced by the authorize() middleware, not by token namespace.
 */
const jwt = __imp0;
const crypto = __imp1;

const getJwtSecrets = () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || Buffer.byteLength(accessSecret, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 bytes.');
  }
  if (!refreshSecret || Buffer.byteLength(refreshSecret, 'utf8') < 32) {
    throw new Error('JWT_REFRESH_SECRET must be configured with at least 32 bytes.');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  return { accessSecret, refreshSecret };
};

const createAccessToken = (payload) => {
  const { accessSecret } = getJwtSecrets();
  return jwt.sign(payload, accessSecret, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
  });
};

const createRefreshToken = (payload) => {
  const { refreshSecret } = getJwtSecrets();
  return jwt.sign(payload, refreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
};

const verifyAccessToken = (token) => {
  const { accessSecret } = getJwtSecrets();
  return jwt.verify(token, accessSecret);
};

const verifyRefreshToken = (token) => {
  const { refreshSecret } = getJwtSecrets();
  return jwt.verify(token, refreshSecret);
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const validateJwtSecrets = () => {
  getJwtSecrets();
};

const __exports: any = {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  validateJwtSecrets
};

export default __exports;
