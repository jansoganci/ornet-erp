/**
 * Groups proposal items by section for PDF and detail views.
 * Preserves section order from the sections array.
 */

export function findSectionById(sections, sectionId) {
  if (sectionId == null) return null;
  return (sections || []).find((s) => (s.id || s._local_id) === sectionId) ?? null;
}

export function getSectionKey(section) {
  return section?.id || section?._local_id;
}

export function filterItemsForSection(itemList, sectionId) {
  return (itemList || []).filter(
    (item) => (item.section_id || item.section_local_id) === sectionId,
  );
}

/**
 * @param {Array} items — proposal_items rows (section_id)
 * @param {Array} sections — proposal_sections rows [{ id, title, discount_percent }]
 * @returns {Array<{ sectionId: string|null, title: string|null, items: [] }>}
 */
export function buildProposalSectionGroups(items, sections) {
  const sectionMap = {};
  for (const s of sections || []) {
    const sid = getSectionKey(s);
    if (sid) sectionMap[sid] = s.title || '';
  }

  const ungrouped = [];
  const bySection = {};
  for (const item of items || []) {
    const sid = item.section_id || item.section_local_id || null;
    if (!sid || !(sid in sectionMap)) {
      ungrouped.push(item);
    } else {
      if (!bySection[sid]) bySection[sid] = [];
      bySection[sid].push(item);
    }
  }

  const groups = (sections || []).map((s) => ({
    sectionId: getSectionKey(s),
    title: s.title || '',
    items: bySection[getSectionKey(s)] || [],
  }));

  if (ungrouped.length > 0) {
    groups.push({ sectionId: null, title: null, items: ungrouped });
  }

  return groups;
}
