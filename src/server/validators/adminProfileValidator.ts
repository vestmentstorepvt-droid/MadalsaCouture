// @ts-nocheck — ported from the Express backend (validators/adminProfileValidator.js); logic unchanged.
import * as __imp0 from "zod";

const { z } = __imp0;

const adminProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  // role is intentionally excluded — it cannot be updated via any API
}).strict(); // reject any extra fields including role

const validateAdminProfile = (req, res, next) => {
  const result = adminProfileSchema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues ?? result.error.errors ?? [];
    const details = issues.map(e => ({ field: e.path.join('.'), message: e.message }));
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details } });
  }
  req.body = result.data;
  next();
};

const __exports: any = { validateAdminProfile };

export default __exports;
