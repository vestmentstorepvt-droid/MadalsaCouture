// @ts-nocheck — ported from the Express backend (services/notificationService.js); logic unchanged.
import __imp0 from "@/server/models/notificationTemplateModel";
import __imp1 from "@/server/models/notificationLogModel";
import __imp2 from "@/server/emails/mailer";
import __imp3 from "@/server/config/logger";
import { escapeHtml, plainLine } from "@/server/utils/escapeHtml";

const NotificationTemplate = __imp0;
const NotificationLog = __imp1;
const { sendMail } = __imp2;
const logger = __imp3;

const BACKOFF_DELAYS = [1000, 2000, 4000]; // ms
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Replaces {{placeholder}} tokens in a template string with values from
 * the provided placeholders map. Missing keys are replaced with an empty string.
 *
 * @param {string} template - Template string containing {{key}} tokens
 * @param {Object} placeholders - Key/value map for substitution
 * @returns {string} Rendered string
 */
function interpolate(template, placeholders, escape = escapeHtml) {
  // Values are escaped: they can contain text a visitor typed (e.g. their name).
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => escape(placeholders[key] ?? ''));
}

class NotificationService {
  /**
   * Fire-and-forget entry point. Schedules the send operation asynchronously
   * and returns immediately — the caller is never blocked or thrown at.
   *
   * @param {string} type - Notification type key (e.g. 'order_confirmation')
   * @param {string} recipient - Destination email address
   * @param {Object} [placeholders={}] - Template placeholder values
   * @param {string|null} [userId=null] - Associated user ObjectId (if any)
   */
  send(type, recipient, placeholders = {}, userId = null) {
    setImmediate(() =>
      this._sendWithRetry(type, recipient, placeholders, userId).catch((err) =>
        logger.error(
          `[NotificationService] Unhandled error in _sendWithRetry for type="${type}" recipient="${recipient}": ${err.message}`,
          { stack: err.stack }
        )
      )
    );
  }

  /**
   * Internal method: loads the template, renders it, creates an audit log
   * entry, and attempts delivery up to MAX_ATTEMPTS times with exponential
   * back-off between failures.
   *
   * @param {string} type
   * @param {string} recipient
   * @param {Object} placeholders
   * @param {string|null} userId
   */
  async _sendWithRetry(type, recipient, placeholders, userId) {
    // 1. Load the active template
    const template = await NotificationTemplate.findOne({ type, isActive: true }).lean();

    if (!template) {
      logger.warn(
        `[NotificationService] No active template found for type="${type}". Notification to "${recipient}" skipped.`
      );
      return;
    }

    // 2. Render subject and body
    const renderedSubject = interpolate(template.subject, placeholders, (v) => plainLine(v));
    const renderedBody = interpolate(template.htmlBody, placeholders);

    // 3. Create an audit log entry (initial status: retrying)
    const log = await NotificationLog.create({
      type,
      recipient,
      subject: renderedSubject,
      status: 'retrying',
      attempts: 0,
      userId
    });

    // 4. Retry loop with exponential back-off
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        await sendMail({ to: recipient, subject: renderedSubject, html: renderedBody });

        // Success — update log and return
        await NotificationLog.findByIdAndUpdate(log._id, {
          status: 'sent',
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          error: null
        });

        logger.info(
          `[NotificationService] Notification sent: type="${type}" recipient="${recipient}" attempt=${attempt + 1}`
        );
        return;
      } catch (err) {
        const isLast = attempt === MAX_ATTEMPTS - 1;

        // Update log with current failure state
        await NotificationLog.findByIdAndUpdate(log._id, {
          status: isLast ? 'failed' : 'retrying',
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          error: err.message
        });

        if (!isLast) {
          // Wait before the next attempt
          await sleep(BACKOFF_DELAYS[attempt]);
        } else {
          logger.error(
            `[NotificationService] All ${MAX_ATTEMPTS} attempts failed for type="${type}" recipient="${recipient}": ${err.message}`,
            { stack: err.stack }
          );
        }
      }
    }
  }
}

const __exports: any = new NotificationService();

export default __exports;
