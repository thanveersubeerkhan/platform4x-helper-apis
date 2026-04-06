import { finalcleanEmailtext } from "./html-to-text1.js";
import { extractPrePostText } from "./prepost-extractor.js";

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

export interface CleanedEmail {
  pretext: string;
  core: string;
  posttext: string;
  cleanText: string;
  summary: string;
  metadata: {
    originalLength: number;
    cleanedLength: number;
    compressionRatio: string;
    warning?: string;
  };
}

export default function cleanEmail(
  htmlBody: string,
  config: CleanerConfig = {}
): CleanedEmail {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Step 1: HTML to plain text with Markdown tables
  let text = finalcleanEmailtext(htmlBody, mergedConfig);
  
  if (!text || text.length < 10) {
    return {
      pretext: "",
      core: "",
      posttext: "",
      cleanText: text,
      summary: "",
      metadata: {
        originalLength: htmlBody.length,
        cleanedLength: 0,
        compressionRatio: "100.00%",
        warning: "Content too short or empty after HTML cleaning",
      },
    };
  }

  // Step 2: Extract structured parts (Pre-text, Core, Post-text)
  const { pretext, core, posttext } = extractPrePostText(text);
  const finalCore = core || text;

  return {
    pretext,
    core: finalCore,
    posttext,
    cleanText: text,
    summary: `${finalCore.slice(0, 150)}${finalCore.length > 150 ? "..." : ""}`,
    metadata: {
      originalLength: htmlBody.length,
      cleanedLength: text.length,
      compressionRatio: htmlBody.length > 0
        ? ((1 - text.length / htmlBody.length) * 100).toFixed(2) + "%"
        : "0%",
    },
  };
}
