// @ts-nocheck — ported from the Express backend (modules/cms/featuredSections/featuredSectionController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/featuredSections/featuredSectionService";
import __imp1 from "@/server/utils/response";

const featuredSectionService = __imp0;
const { sendSuccess, sendError } = __imp1;

const COLLECTION_NAME = 'featured_sections';

async function createSection(req, res, next) {
  try {
    const doc = await featuredSectionService.createSection(req.body, req.user.id);
    return sendSuccess(res, { section: doc }, 201);
  } catch (error) { next(error); }
}

async function listSectionsAdmin(req, res, next) {
  try {
    const result = await featuredSectionService.listSectionsAdmin(req.query);
    return sendSuccess(res, { sections: result.data }, 200, result.meta);
  } catch (error) { next(error); }
}

async function updateSection(req, res, next) {
  try {
    const doc = await featuredSectionService.updateSection(req.params.id, req.body, req.user.id);
    if (!doc) return sendError(res, 'NOT_FOUND', 'Featured section not found.', 404);
    return sendSuccess(res, { section: doc });
  } catch (error) { next(error); }
}

async function deleteSection(req, res, next) {
  try {
    const doc = await featuredSectionService.deleteSection(req.params.id, req.user.id);
    if (!doc) return sendError(res, 'NOT_FOUND', 'Featured section not found.', 404);
    return sendSuccess(res, { section: doc });
  } catch (error) { next(error); }
}

async function listSectionsPublic(req, res, next) {
  try {
    const sections = await featuredSectionService.listSectionsPublic();
    return sendSuccess(res, { sections });
  } catch (error) { next(error); }
}

const __exports: any = { createSection, listSectionsAdmin, updateSection, deleteSection, listSectionsPublic };

export default __exports;
