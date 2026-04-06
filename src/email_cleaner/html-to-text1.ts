import * as cheerio from 'cheerio';
import { convert } from "html-to-text";
import { removeQuoteMarkers } from './quote-remover.js';
import { removeDisclaimers } from './disclaimer-remover.js';
import { removeSignature } from './signature-remover.js';
import { stripRepeatedEmailHeaders } from "./emailheaderremover.js";

//
// --------------------------------------------------------
// INTERFACES
// --------------------------------------------------------
//

export interface CleanerConfig {
  preserveLinks?: boolean;
  maxLength?: number;
  aggressiveClean?: boolean;
  removeQuotes?: boolean;
  preserveTables?: boolean;
  minContentLength?: number;
}

export const DEFAULT_CONFIG: CleanerConfig = {
  preserveLinks: false,
  maxLength: 10000,
  aggressiveClean: false,
  removeQuotes: true,
  preserveTables: true,
  minContentLength: 50,
};

export interface ExtractedTable {
  index: number;
  html: string;
  json: any[];
}

export interface FinalCleanResult {
  finalText: string;
  tables: ExtractedTable[];
}

export function htmlToPlainText(html: string, config: CleanerConfig = {}): string {
  if (!html) return "";

  try {
    // Pre-clean the HTML
    const cleaned = html
      .replace(/<o:p>\s*<\/o:p>/gis, "")
      .replace(/<v:.*?>[\s\S]*?<\/v:.*?>/gis, "")
      .replace(/<!--\[if.*?endif\]-->/gis, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/&nbsp;/gi, " ");

    const text = convert(cleaned, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        {
          selector: "a",
          options: {
            ignoreHref: !config.preserveLinks,
            hideLinkHrefIfSameAsText: true,
          },
        },
        {
          selector: "table",
          format: "skip", // Changed to skip since we handle tables separately
        },
        { selector: "img", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "iframe", format: "skip" },
      ],
    });

    return postProcessText(text);
  } catch (error) {
    console.error("Error in htmlToPlainText:", error);
    return stripHtmlFallback(html);
  }
}



function stripHtmlFallback(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function postProcessText(text: string): string {
  return text  
    .replace(/ +/g, " ")
    .replace(/\n{3,}/g, "\n\n")
      
    .trim();
}
// Removed toon version as per user request
export function finalcleanEmailtextwithjson(
  html: string,
  config: CleanerConfig = {}
): string {
  if (!html) return "";

  const $ = cheerio.load(html);
  const tableStore: any[] = [];

  // STEP 1 - Extract and classify tables
  $("table").each((index: number, table: any) => {
    const tableHtml = $.html(table);
    const extracted = extractSingleTableToJson(tableHtml);
    const { isSignature, rows } = extracted;

    const isEmpty = !rows || rows.length === 0;

    // More robust layout-table detection
    const isLayoutTable =
      rows.length <= 1 &&
      Object.values(rows[0] || {}).filter(Boolean).length <= 2 &&
      tableHtml.length < 1200;

    if (isSignature || isEmpty || isLayoutTable) {
      $(table).remove();
      return;
    }

    tableStore.push({
      index,
      rows: extracted.rows,
    });

    $(table).replaceWith(`[[TABLE_${index}]]`);
  });

  // STEP 2 - Convert HTML to clean text
  let text = htmlToPlainText($.html(), config);
  text = stripRepeatedEmailHeaders(text);

  // STEP 3 - Protect table placeholders
  tableStore.forEach((t) => {
    const ph = `[[TABLE_${t.index}]]`;
    const protectedTag = `__TABLE_BLOCK_${t.index}__`;
    text = text.replace(ph, protectedTag);
  });

  // STEP 4 - Cleaning steps
  if (config.removeQuotes !== false) {
    text = removeQuoteMarkers(text);
  }

  text = removeDisclaimers(text);
  text = removeSignature(text, config);

  // STEP 5 - Unprotect placeholders back
  tableStore.forEach((t) => {
    const protectedTag = `__TABLE_BLOCK_${t.index}__`;
    const block =
      `\n\nTABLE_${t.index + 1}:\n` +
      JSON.stringify(t.rows, null, 2) +
      `\n\n`;

    text = text.replace(protectedTag, block);
  });

  // STEP 6 - Final formatting
  return postProcessText(text);
}



// export function finalcleanEmailtextwithtoon(html: string, config: CleanerConfig = {}): string {
//   if (!html) return "";

//   const $ = cheerio.load(html);
//   const tableStore: any[] = [];

//   $("table").each((index, table) => {
//     const tableHtml = $.html(table);
//     const extracted = extractSingleTableToJson(tableHtml);
//     const toon =convertToToon(extracted);

//   //  if (!extracted || extracted.isSignature || extracted.rows.length === 0) {
//   //     $(table).remove();
//   //     return;
//   //   }
    

//     tableStore.push({
//       index,
//       toon: toon
//     });

//     $(table).replaceWith(`[[TABLE_${index}]]`);
//   });

//   let text = htmlToPlainText($.html(), config);

//   tableStore.forEach(t => {
//     const toonDump = t.toon
//     text = text.replace(
//       `[[TABLE_${t.index}]]`,
//       `\n\nTABLE_${t.index + 1}:\n${toonDump}\n\n`
//     );
//   });

//   return postProcessText(text);
// }

// export function finalcleanEmailtext(html: string, config: CleanerConfig = {}): string {
//   if (!html) return "";

//   const $ = cheerio.load(html);
//   const tableStore: any[] = [];

//   $("table").each((index, table) => {
//     const tableHtml = $.html(table);
//     const extracted = extractSingleTableToJson(tableHtml);

//     if (!extracted || extracted.length === 0) {
//       $(table).remove();
//       return;
//     }


//     tableStore.push({
//       index,
//       json: extracted
//     });

//     $(table).replaceWith(`[[TABLE_${index}]]`);
//   });

//   let text = htmlToPlainText($.html(), config);

//   tableStore.forEach(t => {
//     const jsonDump = JSON.stringify(t.json, null, 2);
//     text = text.replace(
//       `[[TABLE_${t.index}]]`,
//       `\n\nTABLE_${t.index + 1}:\n${jsonDump}\n\n`
//     );
//   });

//   return postProcessText(text);
// }

// function extractSingleTableToJson(htmlTable: string) {
//   const $ = cheerio.load(htmlTable);
//   const rows = $("tr");
//   const jsonRows: any[] = [];
//   let headers: string[] = [];

//   rows.each((rowIndex, row) => {
//     const cells = $(row).find("th, td");

//     if (headers.length === 0 && $(row).find("th").length > 0) {
//       cells.each((i, cell) => {
//         const t = $(cell).text().trim();
//         headers.push(t || `Column_${i + 1}`);
//       });
//       return;
//     }

//     if (headers.length === 0 && rowIndex === 0) {
//       cells.each((i, cell) => {
//         const t = $(cell).text().trim();
//         headers.push(t || `Column_${i + 1}`);
//       });
//       return;
//     }

//     const obj: any = {};
//     cells.each((i, cell) => {
//       const value = $(cell).text().trim();
//       const key = headers[i] || `Column_${i + 1}`;
//       obj[key] = value;
//     });

//     if (Object.keys(obj).length > 0) {
//       jsonRows.push(obj);
//     }
//   });

//   return jsonRows;
// }
// function extractSingleTableToJson(htmlTable: string) {
//   const $ = cheerio.load(htmlTable);
//   const rows = $("tr");
//   const jsonRows: any[] = [];
//   let headers: string[] = [];
//   let headerDetected = false;

//   // Detect signature BEFORE extraction
//   const isSignature = detectSignatureTable($(htmlTable).text());

//   rows.each((rowIndex, row) => {
//     const cells = $(row).find("th, td");

//     // STEP 1 — Header row with <th>
//     if (!headerDetected && $(row).find("th").length > 0) {
//       headers = cells.map((i, cell) => {
//         const t = $(cell).text().trim();
//         return t || `Column_${i + 1}`;
//       }).get();
//       headerDetected = true;
//       return;
//     }

//     // STEP 2 — First row heuristics
//     const rawValues = cells.map((i, cell) => $(cell).text().trim()).get();

//     if (!headerDetected && rowIndex === 0) {
//       const looksHeader = rawValues.some(v => /[a-zA-Z]/.test(v)); // contains letters?

//       if (looksHeader) {
//         headers = rawValues.map((t, i) => t || `Column_${i + 1}`);
//         headerDetected = true;
//         return;
//       }

//       // If it doesn't look like header → treat as DATA row
//       headers = rawValues.map((_, i) => `Column_${i + 1}`);
//       headerDetected = true;

//       const obj: any = {};
//       rawValues.forEach((v, i) => obj[headers[i]] = v);
//       jsonRows.push(obj);
//       return;
//     }

//     // STEP 3 — Normal data rows
//     const obj: any = {};
//     rawValues.forEach((v, i) => {
//       obj[headers[i] || `Column_${i + 1}`] = v;
//     });

//     jsonRows.push(obj);
//   });

//   return {
//     isSignature,
//     rows: jsonRows
//   };
// }
function extractSingleTableToJson(htmlTable: string) {
  const $ = cheerio.load(htmlTable);
  const rows = $("tr");
  const jsonRows: any[] = [];

  // Detect signature once (outside row parsing)
  const isSignature = detectSignatureTable($(htmlTable).text());

  // 1. NORMALIZE all cell values: strip <p>, <span>, RTL noise
  function cleanCell(cell: cheerio.Cheerio<any>): string {
    return cell.text()
      .replace(/\s+/g, " ")
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "") // RTL marks
      .trim();
  }

  // 2. Extract ALL rows as raw arrays
  const rawRows: string[][] = [];
  rows.each((_: number, row: any) => {
    const cells = $(row).find("th, td");
    const cleaned = cells.map((i: number, cell: any) => cleanCell($(cell))).get();
    if (cleaned.length > 0) rawRows.push(cleaned);
  });

  if (rawRows.length === 0) {
    return { isSignature, rows: [] };
  }

  // 3. Detect header row dynamically (GLOBAL detection)
  const firstRow = rawRows[0];
  const hasLetters = firstRow.some(v => /[a-zA-Z]/.test(v));
  const hasArabicLetters = firstRow.some(v => /[\u0600-\u06FF]/.test(v));
  const tooNumeric = firstRow.filter(v => /^\d+$/.test(v)).length > (firstRow.length / 2);
  const looksLikeData = tooNumeric && !hasLetters && !hasArabicLetters;

  let headers: string[] = [];

  if (!looksLikeData) {
    // First row is header
    headers = firstRow.map((h, i) => h || `Column_${i+1}`);
  } else {
    // First row is data → generate synthetic headers
    headers = firstRow.map((_, i) => `Column_${i+1}`);
    // And include first row as data
    const obj: any = {};
    firstRow.forEach((v, i) => obj[headers[i]] = v);
    jsonRows.push(obj);
  }

  // 4. Process remaining rows
  for (let r = looksLikeData ? 1 : 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const obj: any = {};

    row.forEach((v, i) => {
      obj[headers[i] || `Column_${i+1}`] = v;
    });

    jsonRows.push(obj);
  }

  return { isSignature, rows: jsonRows };
}





export function finalcleanEmailtext(html: string, config: CleanerConfig = {}) {
  if (!html) return "";

  // Step 1: Load HTML
  const $ = cheerio.load(html);
  const tableStore: any[] = [];

  // Step 2: Replace each <table> with a placeholder if it's a real data table
  $("table").each((index: number, table: any) => {
    const tableHtml = $.html(table);
    const extracted = extractSingleTableToJson(tableHtml);

    // If table has no usable rows or is a signature/layout table → remove
    if (!extracted || extracted.isSignature || extracted.rows.length === 0) {
      $(table).remove();
      return;
    }

    // Valid table → store and replace with marker
    tableStore.push({
      index,
      rows: extracted.rows
    });

    $(table).replaceWith(`[[TABLE_${index}]]`);
  });

  // Step 3: Convert remaining HTML to plaintext
  let text = htmlToPlainText($.html(), config);
  text = stripRepeatedEmailHeaders(text);

  // Step 4: Replace placeholders with Markdown tables
  tableStore.forEach(t => {
    const markdownTable = tableJsonToMarkdown(t.rows);
    text = text.replace(
      `[[TABLE_${t.index}]]`,
      `\n\n${markdownTable}\n\n`
    );
  });

  // Step 5: Final cleaning steps
  if (config.removeQuotes !== false) {
    text = removeQuoteMarkers(text);
  }
  text = removeDisclaimers(text);
  text = removeSignature(text, config);

  // Step 6: Final polish
  return postProcessText(text);
}
export function tableJsonToMarkdown(rows: any[]): string {
  if (!rows || rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  // Build header row
  const headerLine = `| ${headers.join(" | ")} |`;

  // Build separator row
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;

  // Build data rows
  const dataLines = rows.map(row => {
    const cols = headers.map(h => {
      const val = row[h] ?? "";
      return String(val).replace(/\n+/g, " "); // flatten multi-line cells
    });
    return `| ${cols.join(" | ")} |`;
  });

  return [headerLine, separatorLine, ...dataLines].join("\n");
  
}
function detectSignatureTable(text: string): boolean {
  const lower = text.toLowerCase();

  // Universal global signature phrases
  const strong = [
    "best regards",
    "kind regards",
    "thanks & regards",
    "warm regards",
    "sent from my iphone",
    "sent from my android",
    "sincerely",
    "yours truly"
  ];

  // Contact block signals – must match at least 2
  const contactSignals = [
    /\+\d{1,3}\s?\d{6,12}/,   // international phone
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/, // email
    /www\./,
    /\.com\b/,
  ];

  // Address fragment signals (global)
  const addressSignals = [
    "p.o. box",
    "street",
    "road",
    "building",
    "suite",
    "kingdom of saudi arabia",
    "united arab emirates",
    "uae",
    "usa",
    "uk",
    "canada"
  ];

  // 1) Strong signature markers → auto match
  if (strong.some(s => lower.includes(s))) return true;

  // 2) Contact info check → require at least 2 hits
  let contactCount = 0;
  contactSignals.forEach(r => { if (r.test(lower)) contactCount++; });
  if (contactCount >= 2) return true;

  // 3) Address check → require at least 1 hit + 1 contact signal
  if (addressSignals.some(s => lower.includes(s)) && contactCount >= 1) {
    return true;
  }

  return false;
}



// function extractSingleTableToJson(htmlTable: string) {
//   const $ = cheerio.load(htmlTable);
//   const rows = $("tr");
//   const jsonRows: any[] = [];
//   let headers: string[] = [];

//   rows.each((rowIndex, row) => {
//     const cells = $(row).find("th, td");

//     // Header detection
//     if (headers.length === 0 && $(row).find("th").length > 0) {
//       cells.each((i, cell) => {
//         const t = $(cell).text().trim();
//         headers.push(t || `Column_${i + 1}`);
//       });
//       return;
//     }

//     if (headers.length === 0 && rowIndex === 0) {
//       cells.each((i, cell) => {
//         const t = $(cell).text().trim();
//         headers.push(t || `Column_${i + 1}`);
//       });
//       return;
//     }

//     // Data rows
//     const obj: any = {};
//     cells.each((i, cell) => {
//       const value = $(cell).text().trim();
//       const key = headers[i] || `Column_${i + 1}`;
//       obj[key] = value;
//     });

//     if (Object.keys(obj).length > 0) {
//       jsonRows.push(obj);
//     }
//   });
//   console.log("Extracted Table JSON:", jsonRows);

//   return jsonRows;
// }



// End of file
