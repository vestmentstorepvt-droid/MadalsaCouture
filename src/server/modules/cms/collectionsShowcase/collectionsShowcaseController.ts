// @ts-nocheck — ported from the Express backend (modules/cms/collectionsShowcase/collectionsShowcaseController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/collectionsShowcase/collectionsShowcaseService";
import __imp1 from "@/server/utils/response";

const collectionsShowcaseService = __imp0;
const { sendSuccess, sendError } = __imp1;

async function upsertShowcase(req, res, next) {
  try {
    // Accept either a top-level array or { items: [...] }
    const items = Array.isArray(req.body) ? req.body : (req.body.items ?? []);
    const doc = await collectionsShowcaseService.upsertShowcase(items, req.user.id);
    return sendSuccess(res, { items: doc.items ?? doc }, 200);
  } catch (error) {
    next(error);
  }
}

async function getShowcaseAdmin(req, res, next) {
  try {
    const items = await collectionsShowcaseService.getShowcaseAdmin();
    return sendSuccess(res, { items });
  } catch (error) {
    next(error);
  }
}

async function getShowcasePublic(req, res, next) {
  try {
    const items = await collectionsShowcaseService.getShowcasePublic();
    return sendSuccess(res, { items });
  } catch (error) {
    next(error);
  }
}

const __exports: any = { upsertShowcase, getShowcaseAdmin, getShowcasePublic };

export default __exports;
