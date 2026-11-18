// @ts-nocheck — ported from the Express backend (repositories/addressRepository.js); logic unchanged.
import __imp0 from "@/server/lib/mongoose";
import __imp1 from "@/server/models/addressModel";

const mongoose = __imp0;
const Address = __imp1;

/**
 * Repository for Address CRUD and query operations.
 * All read-only queries use .lean() for performance.
 * Soft-deleted documents (isDeleted: true) are excluded from standard reads.
 */
class AddressRepository {
  /**
   * Insert a new address document.
   *
   * @param {Object} data - Address fields to persist.
   * @returns {Promise<Document>} The created Mongoose document.
   */
  async create(data) {
    return Address.create(data);
  }

  /**
   * Find all non-deleted addresses for a given user.
   * Results are sorted with the default address first, then by creation date
   * descending so the most recently added address appears near the top.
   *
   * @param {string|ObjectId} userId - User ObjectId.
   * @returns {Promise<Object[]>} Array of lean address documents.
   */
  async findByUser(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];

    return Address.find({ userId, isDeleted: false })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
  }

  /**
   * Find a single address by its ObjectId, excluding soft-deleted records.
   *
   * @param {string|ObjectId} id - Address ObjectId.
   * @returns {Promise<Object|null>} Lean address document, or null if not found / deleted.
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return Address.findOne({ _id: id, isDeleted: false }).lean();
  }

  /**
   * Update an address document by ObjectId.
   *
   * @param {string|ObjectId} id   - Address ObjectId.
   * @param {Object}          data - Fields to update.
   * @returns {Promise<Object|null>} Updated lean document, or null if not found.
   */
  async update(id, data) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    return Address.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Atomically set one address as the default for a user and clear all others.
   *
   * Uses a single `bulkWrite` call so no intermediate state is visible to
   * concurrent readers:
   *   1. updateMany — set isDefault: false on ALL addresses for the user.
   *   2. updateOne  — set isDefault: true on the target address.
   *
   * @param {string|ObjectId} addressId - The address to make the default.
   * @param {string|ObjectId} userId    - Owner of the addresses.
   * @returns {Promise<Object|null>} Updated lean document for the new default,
   *                                 or null if the address is not found / deleted.
   */
  async setDefault(addressId, userId) {
    if (
      !mongoose.Types.ObjectId.isValid(addressId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return null;
    }

    await Address.bulkWrite([
      // Step 1: clear isDefault on every address belonging to this user
      {
        updateMany: {
          filter: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false },
          update: { $set: { isDefault: false } }
        }
      },
      // Step 2: set isDefault on the target address
      {
        updateOne: {
          filter: {
            _id: new mongoose.Types.ObjectId(addressId),
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: false
          },
          update: { $set: { isDefault: true } }
        }
      }
    ]);

    // Return the updated document so the service layer can confirm success
    return Address.findOne({
      _id: addressId,
      userId,
      isDeleted: false
    }).lean();
  }

  /**
   * Soft-delete an address by setting isDeleted=true and capturing deletedAt.
   *
   * @param {string|ObjectId} addressId - Address ObjectId.
   * @returns {Promise<Object|null>} Updated lean document, or null if not found.
   */
  async softDelete(addressId) {
    if (!mongoose.Types.ObjectId.isValid(addressId)) return null;

    return Address.findOneAndUpdate(
      { _id: addressId, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date()
        }
      },
      { new: true }
    ).lean();
  }

  /**
   * Check whether an address is referenced by any non-cancelled order.
   *
   * Design note: the Order model stores `shippingAddress` as an embedded
   * snapshot of address fields captured at checkout time. The snapshot does
   * NOT contain an `addressId` back-reference to the Address collection, so
   * it is impossible to trace historical orders back to a specific address
   * document by ID.  This method therefore always returns false — address
   * documents can never be "referenced" by an order in a queryable way.
   *
   * If a future migration adds an `addressId` field to the shippingAddress
   * snapshot, update this method to query:
   *   Order.exists({
   *     'shippingAddress.addressId': addressId,
   *     status: { $nin: ['Cancelled'] },
   *     isDeleted: false
   *   })
   *
   * @param {string|ObjectId} addressId - Address ObjectId to check.
   * @returns {Promise<boolean>} Always false given the current schema.
   */
  async isReferencedByActiveOrder(addressId) { // eslint-disable-line no-unused-vars
    // The Order.shippingAddress snapshot has no addressId field — see comment above.
    return false;
  }
}

const __exports: any = new AddressRepository();

export default __exports;
