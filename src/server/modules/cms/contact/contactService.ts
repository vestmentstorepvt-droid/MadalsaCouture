// @ts-nocheck — ported from the Express backend (modules/cms/contact/contactService.js); logic unchanged.
import __imp0 from "@/server/modules/cms/contact/contact.model";
import __imp1 from "@/server/modules/cms/contact/contactInquiry.model";
import __imp2 from "@/server/utils/cmsFilter";
import __imp3 from "@/server/emails/mailer";
import __imp4 from "@/server/config/logger";
import { escapeHtml, plainLine } from "@/server/utils/escapeHtml";

const Contact = __imp0;
const ContactInquiry = __imp1;
const { buildPublicCmsFilter } = __imp2;
const { sendMail } = __imp3;
const logger = __imp4;

class ContactService {
  async upsertContact(data, actorId) {
    const existing = await Contact.findOne({ isDeleted: false }).lean();
    if (existing) {
      return Contact.findByIdAndUpdate(
        existing._id,
        { ...data, updatedBy: actorId, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean();
    }
    const doc = await Contact.create({ ...data, createdBy: actorId, updatedBy: actorId });
    return doc.toObject();
  }

  async getContactAdmin() {
    return Contact.findOne({ isDeleted: false }).lean();
  }

  async getContactPublic() {
    const filter = buildPublicCmsFilter();
    return Contact.findOne(filter).lean();
  }

  async createInquiry(data) {
    const doc = await ContactInquiry.create(data);

    // Send email to admin in background
    this.sendInquiryNotification(data).catch((err) => {
      logger.error(`Error sending contact inquiry notification: ${err.message}`);
    });

    return doc.toObject();
  }

  async sendInquiryNotification(data) {
    const contactCms = await Contact.findOne({ isDeleted: false }).lean();
    const toEmail = contactCms?.formRoutingEmail || contactCms?.email || process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!toEmail) {
      logger.warn('No contact routing email address found. Skipping contact form email routing.');
      return;
    }

    // Everything here was typed by a visitor: escape it so it can't add links or forms to the email.
    const e = {
      name: escapeHtml(data.name),
      email: escapeHtml(data.email),
      phone: escapeHtml(data.phone || 'Not Provided'),
      subject: escapeHtml(data.subject || 'General Inquiry'),
      message: escapeHtml(data.message),
    };
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6B4D3E; font-family: serif; border-bottom: 2px solid #E85D88; padding-bottom: 10px;">New Atelier Contact Inquiry</h2>
        <p>You have received a new contact message through the Madalsa Couture website storefront.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #faf7f2;">
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee; width: 120px;">Name</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${e.email}">${e.email}</a></td>
          </tr>
          <tr style="background-color: #faf7f2;">
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.phone}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #eee;">Subject</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.subject}</td>
          </tr>
        </table>
        <div style="background-color: #FAF6F3; padding: 15px; border-left: 4px solid #B57D2B; border-radius: 4px; margin-top: 20px;">
          <h3 style="margin-top: 0; color: #6B4D3E; font-size: 14px;">Message:</h3>
          <p style="white-space: pre-wrap; font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 0;">${e.message}</p>
        </div>
        <div style="margin-top: 30px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 10px;">
          This email was generated automatically by the Madalsa Couture Atelier Concierge system.
        </div>
      </div>
    `;

    await sendMail({
      to: toEmail,
      subject: plainLine(`[Atelier Inquiry] ${data.subject || 'General Inquiry'} - ${data.name}`),
      text: `New Atelier Contact Inquiry\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'Not Provided'}\nSubject: ${data.subject || 'General Inquiry'}\n\nMessage:\n${data.message}`,
      html: htmlContent
    });
  }

  async getInquiriesAdmin() {
    return ContactInquiry.find().sort({ createdAt: -1 }).lean();
  }
}

const __exports: any = new ContactService();

export default __exports;
