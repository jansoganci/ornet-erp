/**
 * Resolves a PDF image from the public folder as a base64 data URI.
 * @react-pdf/renderer needs base64 to avoid network request issues during toBlob().
 * Returns null if the file is missing — the PDF component handles null gracefully.
 *
 * @param {string} relativePath - e.g. 'ornet.logo.png'
 * @returns {Promise<string|null>} base64 data URI or null
 */
export async function resolveProposalPdfPublicImage(relativePath) {
  const path = relativePath.replace(/^\//, '');
  const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
  const url = new URL(path, base).href;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (ct && !ct.startsWith('image/')) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:${ct};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}
