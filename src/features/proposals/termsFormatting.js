/** Split terms into maddeler. Blank lines are ignored, not treated as items. */
export function splitTermsParagraphs(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  if (/\n\s*\n/.test(normalized)) {
    return normalized
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Number paragraphs that are not already numbered (1., 2., …). */
export function formatNumberedTermsParagraphs(text) {
  return splitTermsParagraphs(text).map((paragraph, index) => {
    if (/^\d+\.\s/.test(paragraph)) return paragraph;
    return `${index + 1}. ${paragraph}`;
  });
}

export function formatNumberedTermsBody(text) {
  return formatNumberedTermsParagraphs(text).join('\n');
}
