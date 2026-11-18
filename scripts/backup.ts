/**
 * Full database backup: every table → one gzipped JSON file.
 *
 *   npm run db:backup                     → writes backups/madalsa-<timestamp>.json.gz
 *   npm run db:backup -- --upload-r2      → also uploads it to Cloudflare R2 (backups/ prefix)
 *
 * Restore with: npm run db:import -- backups/madalsa-<timestamp>.json.gz --replace
 * The nightly GitHub Actions workflow (.github/workflows/backup.yml) runs this.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { client } from "../src/db/client";
import { COLLECTION_NAMES } from "../src/db/schema";

async function main() {
  const db = client();
  const dump: Record<string, unknown[]> = {};
  let total = 0;
  for (const name of COLLECTION_NAMES) {
    const r = await db.execute(`SELECT doc FROM "${name}"`);
    dump[name] = r.rows.map((row) => JSON.parse(String(row.doc)));
    total += dump[name].length;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `madalsa-${stamp}.json.gz`;
  const body = gzipSync(JSON.stringify({ format: "madalsa-web-backup/1", createdAt: new Date().toISOString(), collections: dump }));
  mkdirSync("backups", { recursive: true });
  const path = join("backups", fileName);
  writeFileSync(path, body);
  console.log(`Backed up ${total} documents → ${path} (${(body.length / 1024).toFixed(1)} KB)`);

  if (process.argv.includes("--upload-r2")) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    const bucket = process.env.R2_BACKUP_BUCKET || process.env.R2_BUCKET_NAME;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !bucket) throw new Error("R2 credentials missing for upload.");
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `backups/${fileName}`, Body: body, ContentType: "application/gzip" }));
    console.log(`Uploaded to R2: ${bucket}/backups/${fileName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
