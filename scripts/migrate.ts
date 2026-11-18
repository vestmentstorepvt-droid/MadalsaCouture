// Create/upgrade every table and index (idempotent). The app also does this on first request.
import { ensureSchema, schemaStatements } from "../src/db/migrate";

ensureSchema()
  .then(() => console.log(`Schema ready (${schemaStatements().length} statements).`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
