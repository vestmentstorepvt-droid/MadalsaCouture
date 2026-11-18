import type { Handler, UploadedFile } from "../http/types";

// multer-compatible middleware. The request body is already parsed by the API
// entry point (multipart → req.body + req.uploads); this enforces the same
// limits/filters and sets req.file / req.files exactly like multer's memoryStorage.

type Options = {
  storage?: unknown;
  limits?: { fileSize?: number; files?: number };
  fileFilter?: (req: any, file: UploadedFile, cb: (err: Error | null, accept?: boolean) => void) => void;
};

class MulterError extends Error {
  code: string;
  field?: string;
  constructor(code: string, field?: string) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large",
      LIMIT_FILE_COUNT: "Too many files",
      LIMIT_UNEXPECTED_FILE: "Unexpected field",
    };
    super(messages[code] || code);
    this.name = "MulterError";
    this.code = code;
    this.field = field;
  }
}

function filesFor(req: any, field: string): UploadedFile[] {
  return (req.locals?.uploads ?? []).filter((f: UploadedFile) => f.fieldname === field);
}

async function accept(req: any, files: UploadedFile[], opts: Options) {
  const kept: UploadedFile[] = [];
  for (const file of files) {
    if (opts.limits?.fileSize && file.size > opts.limits.fileSize) throw new MulterError("LIMIT_FILE_SIZE", file.fieldname);
    if (opts.fileFilter) {
      const ok = await new Promise<boolean>((resolve, reject) =>
        opts.fileFilter!(req, file, (err, acceptFile) => (err ? reject(err) : resolve(Boolean(acceptFile)))),
      );
      if (!ok) continue;
    }
    kept.push(file);
  }
  return kept;
}

function multer(opts: Options = {}) {
  return {
    single(field: string): Handler {
      return async (req, _res, next) => {
        try {
          const all = req.locals?.uploads ?? [];
          if (all.some((f: UploadedFile) => f.fieldname !== field)) throw new MulterError("LIMIT_UNEXPECTED_FILE", all[0].fieldname);
          const files = await accept(req, filesFor(req, field), opts);
          if (files.length > 1) throw new MulterError("LIMIT_UNEXPECTED_FILE", field);
          req.file = files[0];
          next();
        } catch (e) {
          next(e);
        }
      };
    },
    array(field: string, maxCount?: number): Handler {
      return async (req, _res, next) => {
        try {
          const files = await accept(req, filesFor(req, field), opts);
          const max = Math.min(maxCount ?? Infinity, opts.limits?.files ?? Infinity);
          if (files.length > max) throw new MulterError("LIMIT_UNEXPECTED_FILE", field);
          req.files = files;
          next();
        } catch (e) {
          next(e);
        }
      };
    },
    fields(specs: { name: string; maxCount?: number }[]): Handler {
      return async (req, _res, next) => {
        try {
          const out: Record<string, UploadedFile[]> = {};
          for (const s of specs) {
            const files = await accept(req, filesFor(req, s.name), opts);
            if (s.maxCount && files.length > s.maxCount) throw new MulterError("LIMIT_UNEXPECTED_FILE", s.name);
            if (files.length) out[s.name] = files;
          }
          req.files = out;
          next();
        } catch (e) {
          next(e);
        }
      };
    },
    none(): Handler {
      return (_req, _res, next) => next();
    },
  };
}

multer.memoryStorage = () => ({});
multer.MulterError = MulterError;

export default multer;
