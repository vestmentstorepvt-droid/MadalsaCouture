// @ts-nocheck — ported from the Express backend (modules/cms/contact/contactController.js); logic unchanged.
import __imp0 from "@/server/modules/cms/contact/contactService";
import __imp1 from "@/server/utils/response";

const contactService = __imp0;
const { sendSuccess, sendError } = __imp1;

async function upsertContact(req, res, next) {
  try {
    const doc = await contactService.upsertContact(req.body, req.user.id);
    return sendSuccess(res, { contact: doc }, 200);
  } catch (error) { next(error); }
}

async function getContactAdmin(req, res, next) {
  try {
    const doc = await contactService.getContactAdmin();
    if (!doc) return sendError(res, 'NOT_FOUND', 'Contact info not configured yet.', 404);
    return sendSuccess(res, { contact: doc });
  } catch (error) { next(error); }
}

async function getContactPublic(req, res, next) {
  try {
    const doc = await contactService.getContactPublic();
    if (!doc) return sendError(res, 'NOT_FOUND', 'Contact info not available.', 404);
    return sendSuccess(res, { contact: doc });
  } catch (error) { next(error); }
}

async function submitInquiry(req, res, next) {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return sendError(res, 'VALIDATION_ERROR', 'Name, email, and message are required.', 400);
    }
    const tooLong = [[name, 100], [email, 200], [phone, 30], [subject, 200], [message, 5000]]
      .some(([v, max]) => v != null && (typeof v !== 'string' || v.length > max));
    if (tooLong || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 'VALIDATION_ERROR', 'Please check your details and try again.', 400);
    }
    const inquiry = await contactService.createInquiry({ name, email, phone, subject, message });
    return sendSuccess(res, { inquiry, message: 'Your message has been sent to our concierge.' }, 201);
  } catch (error) { next(error); }
}

async function getInquiriesAdmin(req, res, next) {
  try {
    const inquiries = await contactService.getInquiriesAdmin();
    return sendSuccess(res, { inquiries });
  } catch (error) { next(error); }
}

const __exports: any = { upsertContact, getContactAdmin, getContactPublic, submitInquiry, getInquiriesAdmin };

export default __exports;
