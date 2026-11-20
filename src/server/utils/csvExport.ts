// @ts-nocheck — ported from the Express backend (utils/csvExport.js); logic unchanged.


/**
 * Stream a MongoDB cursor as a CSV response.
 * @param {object} res - Express response object
 * @param {Cursor} cursor - Mongoose lean cursor
 * @param {Array<{header: string, key: string}>} columns - Column definitions
 * @param {string} [filename='export.csv']
 */
const streamCsv = async (res, cursor, columns, filename = 'export.csv') => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Escape a CSV cell value
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    // Stop spreadsheet formula injection: a customer name like =HYPERLINK(...) must open as text in Excel.
    if (typeof val !== 'number' && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Write header row
  res.write(columns.map(c => escape(c.header)).join(',') + '\n');

  try {
    for await (const doc of cursor) {
      const row = columns.map(c => {
        const val = c.key.split('.').reduce((obj, k) => (obj ? obj[k] : ''), doc);
        return escape(val);
      });
      res.write(row.join(',') + '\n');
    }
  } catch (err) {
    // End gracefully on cursor error
  } finally {
    res.end();
  }
};

const __exports: any = { streamCsv };

export default __exports;
