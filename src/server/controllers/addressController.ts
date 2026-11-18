// @ts-nocheck — ported from the Express backend (controllers/addressController.js); logic unchanged.
import __imp0 from "@/server/services/addressService";
import __imp1 from "@/server/utils/response";
import __imp2 from "@/server/validators/addressValidator";

const addressService = __imp0;
const { sendSuccess, sendError } = __imp1;
const { createAddressSchema, updateAddressSchema } = __imp2;

class AddressController {
  /**
   * POST /api/v1/addresses
   * Create a new address for the authenticated user.
   */
  async createAddress(req, res, next) {
    try {
      const result = createAddressSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const address = await addressService.createAddress(req.user.id, result.data);
      return sendSuccess(res, { address }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/addresses
   * List all non-deleted addresses for the authenticated user.
   */
  async listAddresses(req, res, next) {
    try {
      const addresses = await addressService.getAddresses(req.user.id);
      return sendSuccess(res, { addresses });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/addresses/:id
   * Update an existing address owned by the authenticated user.
   */
  async updateAddress(req, res, next) {
    try {
      const result = updateAddressSchema.safeParse(req.body);
      if (!result.success) {
        const issues = result.error.issues ?? result.error.errors ?? [];
        const details = issues.map((e) => ({ field: e.path.join('.'), message: e.message }));
        return sendError(res, 'VALIDATION_ERROR', 'Validation failed.', 400, details);
      }

      const address = await addressService.updateAddress(req.params.id, req.user.id, result.data);
      return sendSuccess(res, { address });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/addresses/:id
   * Soft-delete an address owned by the authenticated user.
   */
  async deleteAddress(req, res, next) {
    try {
      const address = await addressService.deleteAddress(req.params.id, req.user.id);
      return sendSuccess(res, { address });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/addresses/:id/default
   * Set an address as the default for the authenticated user.
   */
  async setDefault(req, res, next) {
    try {
      const address = await addressService.setDefault(req.params.id, req.user.id);
      return sendSuccess(res, { address });
    } catch (error) {
      next(error);
    }
  }
}

const __exports: any = new AddressController();

export default __exports;
