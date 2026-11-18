// @ts-nocheck — ported from the Express backend (modules/cms/staticPages/staticPageController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/staticPages/staticPageService";
import __imp1 from "@/server/utils/response";

const staticPageService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'static_pages';

async function createPage(req, res, next) {
  try {
    const page = await staticPageService.createPage(req.body, req.user.id);
    return sendSuccess(res, { page }, 201);
  } catch (error) { next(error); }
}

async function listPagesAdmin(req, res, next) {
  try {
    const result = await staticPageService.listPagesAdmin(req.query);
    return sendSuccess(res, { pages: result.data }, 200, result.meta);
  } catch (error) { next(error); }
}

async function updatePage(req, res, next) {
  try {
    const page = await staticPageService.updatePage(req.params.id, req.body, req.user.id);
    if (!page) return sendError(res, 'NOT_FOUND', 'Static page not found.', 404);
    return sendSuccess(res, { page });
  } catch (error) { next(error); }
}

async function deletePage(req, res, next) {
  try {
    const page = await staticPageService.deletePage(req.params.id, req.user.id);
    if (!page) return sendError(res, 'NOT_FOUND', 'Static page not found.', 404);
    return sendSuccess(res, { page });
  } catch (error) { next(error); }
}

async function getPageBySlug(req, res, next) {
  try {
    const page = await staticPageService.getPageBySlugPublic(req.params.slug);
    if (!page) return sendError(res, 'NOT_FOUND', 'Page not found.', 404);
    return sendSuccess(res, { page });
  } catch (error) { next(error); }
}

const __exports: any = { createPage, listPagesAdmin, updatePage, deletePage, getPageBySlug };

export default __exports;
