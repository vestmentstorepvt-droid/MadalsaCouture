// @ts-nocheck — ported from the Express backend (modules/cms/aboutUs/aboutUsController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/aboutUs/aboutUsService";
import __imp1 from "@/server/utils/response";

const aboutUsService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'about_us';

async function upsertAboutUs(req, res, next) {
  try {
    const doc = await aboutUsService.upsertAboutUs(req.body, req.user.id);
    return sendSuccess(res, { aboutUs: doc }, 200);
  } catch (error) { next(error); }
}

async function getAboutUsAdmin(req, res, next) {
  try {
    const doc = await aboutUsService.getAboutUsAdmin();
    if (!doc) return sendError(res, 'NOT_FOUND', 'About Us not configured yet.', 404);
    return sendSuccess(res, { aboutUs: doc });
  } catch (error) { next(error); }
}

async function getAboutUsPublic(req, res, next) {
  try {
    const doc = await aboutUsService.getAboutUsPublic();
    if (!doc) return sendError(res, 'NOT_FOUND', 'About Us not available.', 404);
    return sendSuccess(res, { aboutUs: doc });
  } catch (error) { next(error); }
}

const __exports: any = { upsertAboutUs, getAboutUsAdmin, getAboutUsPublic };

export default __exports;
