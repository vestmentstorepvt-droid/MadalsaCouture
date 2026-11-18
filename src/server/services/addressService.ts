// @ts-nocheck — ported from the Express backend (services/addressService.js); logic unchanged.
import __imp0 from "@/server/repositories/addressRepository";
import __imp1 from "@/server/constants/messages";

const addressRepository = __imp0;
const { ERROR } = __imp1;

/**
 * Build a standardised service error.
 *
 * @param {string} message    - Human-readable message.
 * @param {number} statusCode - HTTP status code.
 * @param {string} [code]     - SNAKE_CASE error code sent in the JSON response.
 * @returns {Error}
 */
function createError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code: code || 'REQUEST_ERROR' });
}

class AddressService {
  /**
   * Create a new address for a user.
   *
   * @param {string|ObjectId} userId - Owner of the address.
   * @param {Object}          data   - Address fields.
   * @returns {Promise<Document>} The created address document.
   */
  async createAddress(userId, data) {
    return addressRepository.create({ ...data, userId });
  }

  /**
   * Retrieve all non-deleted addresses for a user.
   *
   * @param {string|ObjectId} userId - Owner of the addresses.
   * @returns {Promise<Object[]>} Array of lean address documents.
   */
  async getAddresses(userId) {
    return addressRepository.findByUser(userId);
  }

  /**
   * Update an address after verifying ownership.
   *
   * @param {string|ObjectId} addressId - Target address ObjectId.
   * @param {string|ObjectId} userId    - Requesting user ObjectId.
   * @param {Object}          data      - Fields to update.
   * @returns {Promise<Object>} Updated lean address document.
   */
  async updateAddress(addressId, userId, data) {
    const address = await addressRepository.findById(addressId);
    if (!address) {
      throw createError(ERROR.NOT_FOUND, 404, 'ADDRESS_NOT_FOUND');
    }

    if (address.userId.toString() !== userId.toString()) {
      throw createError(ERROR.FORBIDDEN, 403, 'FORBIDDEN');
    }

    // Prevent caller from reassigning ownership via update payload
    const { userId: _ignored, ...safeData } = data;

    return addressRepository.update(addressId, safeData);
  }

  /**
   * Atomically set one address as the user's default, clearing all others.
   *
   * Delegates to `addressRepository.setDefault` which uses a single `bulkWrite`
   * to avoid intermediate inconsistent state.
   *
   * @param {string|ObjectId} addressId - The address to make default.
   * @param {string|ObjectId} userId    - Owner of the addresses.
   * @returns {Promise<Object>} Updated lean document for the new default.
   */
  async setDefault(addressId, userId) {
    const updated = await addressRepository.setDefault(addressId, userId);
    if (!updated) {
      throw createError(ERROR.NOT_FOUND, 404, 'ADDRESS_NOT_FOUND');
    }
    return updated;
  }

  /**
   * Soft-delete an address, with active-order and ownership guards.
   *
   * Steps:
   *   1. Check if referenced by a non-cancelled order → 409 CONFLICT.
   *   2. Fetch the address and verify it exists.
   *   3. Verify the requesting user owns the address → 403 FORBIDDEN.
   *   4. Soft-delete via the repository.
   *
   * @param {string|ObjectId} addressId - Target address ObjectId.
   * @param {string|ObjectId} userId    - Requesting user ObjectId.
   * @returns {Promise<Object>} Soft-deleted lean address document.
   */
  async deleteAddress(addressId, userId) {
    // ── 1. Guard: active-order reference check ─────────────────────────────
    const isReferenced = await addressRepository.isReferencedByActiveOrder(addressId);
    if (isReferenced) {
      throw createError(ERROR.ADDRESS_IN_USE, 409, 'ADDRESS_IN_USE');
    }

    // ── 2. Fetch address ───────────────────────────────────────────────────
    const address = await addressRepository.findById(addressId);
    if (!address) {
      throw createError(ERROR.NOT_FOUND, 404, 'ADDRESS_NOT_FOUND');
    }

    // ── 3. Ownership check ─────────────────────────────────────────────────
    if (address.userId.toString() !== userId.toString()) {
      throw createError(ERROR.FORBIDDEN, 403, 'FORBIDDEN');
    }

    // ── 4. Soft-delete ─────────────────────────────────────────────────────
    return addressRepository.softDelete(addressId);
  }
}

const __exports: any = new AddressService();

export default __exports;
