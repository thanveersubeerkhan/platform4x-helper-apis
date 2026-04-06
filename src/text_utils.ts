/**
 * Checks if the given text contains any Arabic characters.
 * 
 * Includes the following Unicode blocks:
 * - Arabic (0600–06FF)
 * - Arabic Supplement (0750–077F)
 * - Arabic Extended-A (08A0–08FF)
 * - Arabic Presentation Forms-A (FB50–FDFF)
 * - Arabic Presentation Forms-B (FE70–FEFF)
 * 
 * @param text The string to check
 * @returns {boolean} True if Arabic characters are present, false otherwise
 */
export function hasArabic(text: string): boolean {
  if (!text) return false;
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}
