// @ts-nocheck — ported from the Express backend (emails/mailer.js); logic unchanged.
import __imp0 from "nodemailer";
import __imp1 from "@/server/config/logger";

const nodemailer = __imp0;
const logger = __imp1;

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
};

let transporter = createTransporter();

const sendMail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    logger.warn('SMTP is not configured. Skipping email send.');
    return { success: false, skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      ...(html ? { html } : {})
    });

    logger.info(`Email sent to ${to} with messageId ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
    throw error;
  }
};

const __exports: any = { sendMail };
export default __exports;
