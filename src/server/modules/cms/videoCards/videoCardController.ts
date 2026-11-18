// @ts-nocheck — ported from the Express backend (modules/cms/videoCards/videoCardController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/videoCards/videoCardService";
import __imp1 from "@/server/utils/response";

const videoCardService = __imp0;
const { sendSuccess, sendError } = __imp1;

async function create(req, res, next) {
  try {
    const card = await videoCardService.create(req.body, req.user.id);
    return sendSuccess(res, { card }, 201);
  } catch (error) {
    return next(error);
  }
}

async function listAdmin(req, res, next) {
  try {
    const cards = await videoCardService.listAdmin();
    return sendSuccess(res, { cards });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const card = await videoCardService.update(req.params.id, req.body, req.user.id);
    if (!card) return sendError(res, 'NOT_FOUND', 'Video card not found.', 404);
    return sendSuccess(res, { card });
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const card = await videoCardService.delete(req.params.id, req.user.id);
    if (!card) return sendError(res, 'NOT_FOUND', 'Video card not found.', 404);
    return sendSuccess(res, { card });
  } catch (error) {
    return next(error);
  }
}

async function listPublic(req, res, next) {
  try {
    const cards = await videoCardService.listPublic();
    return sendSuccess(res, { cards });
  } catch (error) {
    return next(error);
  }
}

const __exports: any = { create, listAdmin, update, remove, listPublic };

export default __exports;
