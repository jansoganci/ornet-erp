import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import { getCurrencySymbol } from '../../../lib/utils';
import {
  calcSectionTotal,
  calcVatTevkifatSummary,
  resolveProposalItemLineTotal,
  resolveProposalItemUnitPrice,
  calcAnnualFixedLineTotal,
  sumAnnualFixedCostsByCurrency,
} from '../../../lib/proposalCalc';
import i18n from '../../../lib/i18n';

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-SemiBold.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Bold.ttf',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 11,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: '#1a1a1a',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logoWrap: {
    width: 189,
    height: 78,
  },
  logo: {
    width: 189,
    height: 78,
    objectFit: 'contain',
  },
  certWrap: {
    width: 80,
    height: 50,
  },
  cert: {
    width: 80,
    height: 50,
    objectFit: 'contain',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  topLeft: {
    flex: 1,
  },
  topRight: {
    width: '55%',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    width: 100,
    fontSize: 8,
    color: '#737373',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: '#1a1a1a',
  },
  infoValueBold: {
    fontWeight: 700,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#404040',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d4',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  colSira: {
    width: 28,
    fontSize: 10,
    textAlign: 'center',
  },
  colDescription: {
    flex: 1,
    fontSize: 9,
  },
  colQty: {
    width: 36,
    fontSize: 9,
    textAlign: 'center',
  },
  colUnit: {
    width: 40,
    fontSize: 9,
    textAlign: 'center',
  },
  colUnitPrice: {
    width: 64,
    fontSize: 9,
    textAlign: 'right',
  },
  colTotal: {
    width: 64,
    fontSize: 9,
    textAlign: 'right',
  },
  headerText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 8,
    marginBottom: 0,
  },
  sectionHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    color: '#333333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 3,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  sectionSubtotalLabel: {
    fontSize: 8,
    color: '#737373',
    marginRight: 12,
    fontWeight: 600,
  },
  sectionSubtotalValue: {
    fontSize: 8,
    fontWeight: 600,
    width: 70,
    textAlign: 'right',
    color: '#404040',
  },
  totalsBlock: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
    fontSize: 10,
  },
  totalLineLabel: {
    width: 100,
    textAlign: 'right',
    marginRight: 12,
    color: '#525252',
  },
  totalLineValue: {
    width: 70,
    textAlign: 'right',
  },
  totalsWrap: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  summaryCard: {
    width: '55%',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#525252',
  },
  summaryValue: {
    fontSize: 9,
    color: '#1a1a1a',
    textAlign: 'right',
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d4',
    marginVertical: 4,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  summaryTotalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1a1a1a',
    textAlign: 'right',
  },
  termsSection: {
    marginTop: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#d4d4d4',
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#404040',
    marginBottom: 4,
  },
  termsBody: {
    fontSize: 9,
    lineHeight: 1.4,
    color: '#525252',
    marginBottom: 10,
  },
  signatureBox: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  signatureTitle: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 4,
  },
  signatureSub: {
    fontSize: 9,
    color: '#737373',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#a3a3a3',
    textAlign: 'center',
  },
});

function formatTurkishDate(dateStr) {
  if (dateStr == null || dateStr === '') return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const month = i18n.t('common:monthsFull.' + d.getMonth());
  return `${d.getDate()} ${month || ''} ${d.getFullYear()}`;
}

function formatByCurrency(amount, currency = 'USD') {
  const n = Number(amount);
  const symbol = getCurrencySymbol(currency);
  if (Number.isNaN(n)) return `${symbol}0,00`;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function safeStr(val, maxLen = 2000) {
  if (val == null) return '';
  const s = String(val).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Groups items by section_id, preserving section order from the sections array.
 * Items with null section_id are collected in an ungrouped bucket rendered last (or only).
 * When there are no named sections, renders flat (backward compatible).
 *
 * @param {Array} items - proposal_items rows (have section_id: uuid|null)
 * @param {Array} sections - proposal_sections rows [{ id, title }]
 * @returns {Array<{ sectionId: string|null, title: string|null, items: [] }>}
 */
function buildSectionGroups(items, sections) {
  const sectionMap = {};
  for (const s of (sections || [])) {
    const sid = s.id || s._local_id;
    if (sid) sectionMap[sid] = s.title || '';
  }

  const ungrouped = [];
  const bySection = {};
  for (const item of items) {
    const sid = item.section_id || item.section_local_id || null;
    if (!sid || !(sid in sectionMap)) {
      ungrouped.push(item);
    } else {
      if (!bySection[sid]) bySection[sid] = [];
      bySection[sid].push(item);
    }
  }

  const groups = (sections || []).map((s) => ({
    sectionId: s.id || s._local_id,
    title: s.title || '',
    items: bySection[s.id || s._local_id] || [],
  }));

  if (ungrouped.length > 0) {
    groups.push({ sectionId: null, title: null, items: ungrouped });
  }

  return groups;
}

export function ProposalPdf({
  proposal,
  items,
  sections = [],
  annualFixedCosts = [],
  logoSrc = null,
  certSrc = null,
  tevkifatNumerator = 9,
  tevkifatDenominator = 10,
}) {
  const prop = proposal || {};
  const currency = prop.currency ?? 'USD';
  const itemList = Array.isArray(items) ? items : [];
  const annualList = Array.isArray(annualFixedCosts) ? annualFixedCosts : [];
  const vatRate = Number(prop.vat_rate) || 0;
  const hasTevkifat = !!prop.has_tevkifat;

  // Group items by section; if no sections exist render flat (backward compat)
  const sectionGroups = buildSectionGroups(itemList, sections);
  const hasSections = (sections || []).length > 0;
  const annualSubtotals = sumAnnualFixedCostsByCurrency(annualList);
  const grandTotal = (sections || []).reduce((sum, section) => {
    const sectionId = section.id || section._local_id;
    const sectionItems = itemList.filter(
      (item) => (item.section_id || item.section_local_id) === sectionId
    );
    const { sectionTotal } = calcSectionTotal(sectionItems, section.discount_percent, currency);
    return sum + sectionTotal;
  }, 0);
  const {
    vatAmount: grandVatAmount,
    totalWithVat: grandTotalWithVat,
    withheldVat,
    totalPayable,
  } = calcVatTevkifatSummary(grandTotal, vatRate, hasTevkifat, tevkifatNumerator, tevkifatDenominator);
  const proposalDate = formatTurkishDate(prop.proposal_date || prop.created_at);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top section: Logo (left) + Proposal Info (right) */}
        <View style={styles.topSection}>
          <View style={styles.topLeft}>
            <View style={styles.logoWrap}>
              {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
            </View>
            <View style={styles.certWrap}>
              {certSrc ? <Image src={certSrc} style={styles.cert} /> : null}
            </View>
          </View>
          <View style={styles.topRight}>
            <View style={styles.infoCard}>
              {prop.proposal_no && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.proposalNo')}</Text>
                  <Text style={styles.infoValue}>{safeStr(prop.proposal_no)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.companyName')}</Text>
                <Text style={styles.infoValue}>
                  {safeStr(prop.customer_company_name) || safeStr(prop.company_name)}
                </Text>
              </View>
              {prop.title && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.title')}</Text>
                  <Text style={styles.infoValue}>{safeStr(prop.title)}</Text>
                </View>
              )}
              {prop.authorized_person && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.authorizedPerson')}</Text>
                  <Text style={styles.infoValue}>{safeStr(prop.authorized_person)}</Text>
                </View>
              )}
              {prop.customer_representative && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.customerRepresentative')}</Text>
                  <Text style={styles.infoValue}>{safeStr(prop.customer_representative)}</Text>
                </View>
              )}
              {proposalDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.proposalDate')}</Text>
                  <Text style={styles.infoValue}>{proposalDate}</Text>
                </View>
              )}
              {prop.survey_date && (
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>{i18n.t('proposals:pdf.headerLabels.surveyDate')}</Text>
                  <Text style={styles.infoValue}>{formatTurkishDate(prop.survey_date)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Items Table with Sıra */}
        <View style={styles.divider} />
        <View style={styles.table}>
          {/* react-pdf does not repeat table headers on later pages; keep this row stable on page one */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colSira, styles.headerText]}>{i18n.t('proposals:items.sequence')}</Text>
            <Text style={[styles.colDescription, styles.headerText]}>{i18n.t('proposals:items.material')}</Text>
            <Text style={[styles.colQty, styles.headerText]}>{i18n.t('proposals:items.quantity')}</Text>
            <Text style={[styles.colUnit, styles.headerText]}>{i18n.t('proposals:items.unit')}</Text>
            <Text style={[styles.colUnitPrice, styles.headerText]}>{i18n.t('proposals:items.unitPrice')}</Text>
            <Text style={[styles.colTotal, styles.headerText]}>{i18n.t('proposals:items.total')}</Text>
          </View>
          {(() => {
            return sectionGroups.map(({ sectionId, title, items: groupItems }) => {
              const groupSubtotal = groupItems.reduce(
                (sum, item) => sum + safeNum(resolveProposalItemLineTotal(item, currency)),
                0,
              );
              const rows = groupItems.map((item, localIndex) => {
                const lineTotal = safeNum(resolveProposalItemLineTotal(item, currency));
                const rowIndex = localIndex + 1;
                return (
                  <View key={item.id || rowIndex} style={styles.tableRow}>
                    <Text style={styles.colSira}>{rowIndex}</Text>
                    <View style={styles.colDescription}>
                      <Text style={{ fontSize: 9 }}>{safeStr(item.description)}</Text>
                    </View>
                    <Text style={styles.colQty}>{safeNum(item.quantity)}</Text>
                    <Text style={styles.colUnit}>{safeStr(item.unit) || i18n.t('proposals:items.units.adet')}</Text>
                    <Text style={styles.colUnitPrice}>
                      {formatByCurrency(resolveProposalItemUnitPrice(item, currency), currency)}
                    </Text>
                    <Text style={styles.colTotal}>{formatByCurrency(lineTotal, currency)}</Text>
                  </View>
                );
              });

              // No sections → flat render (backward compatible)
              if (!hasSections) return rows;

              const section = (sections || []).find((s) => s.id === sectionId);
              const sectionDiscountPct = safeNum(section?.discount_percent, 0);
              const sectionDiscountAmt = Math.round(groupSubtotal * sectionDiscountPct / 100 * 100) / 100;
              const sectionNet = Math.round((groupSubtotal - sectionDiscountAmt) * 100) / 100;

              return (
                <View key={sectionId || '__ungrouped__'}>
                  {title ? (
                    <View wrap={false} style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeaderText}>{safeStr(title)}</Text>
                    </View>
                  ) : null}
                  {rows}
                  {groupItems.length > 0 && (
                    <View wrap={false}>
                      <View style={styles.sectionSubtotalRow}>
                        <Text style={styles.sectionSubtotalLabel}>
                          {title ? `${safeStr(title)} Ara Toplamı` : i18n.t('proposals:sections.sectionSubtotal')}
                        </Text>
                        <Text style={styles.sectionSubtotalValue}>
                          {formatByCurrency(groupSubtotal, currency)}
                        </Text>
                      </View>
                      {sectionDiscountPct > 0 && (
                        <>
                          <View style={styles.sectionSubtotalRow}>
                            <Text style={styles.sectionSubtotalLabel}>
                              {i18n.t('proposals:sections.discount')} %{sectionDiscountPct}
                            </Text>
                            <Text style={styles.sectionSubtotalValue}>
                              -{formatByCurrency(sectionDiscountAmt, currency)}
                            </Text>
                          </View>
                          <View style={styles.sectionSubtotalRow}>
                            <Text style={[styles.sectionSubtotalLabel, { fontWeight: 600 }]}>
                              {i18n.t('proposals:sections.sectionTotal')}
                            </Text>
                            <Text style={[styles.sectionSubtotalValue, { fontWeight: 600 }]}>
                              {formatByCurrency(sectionNet, currency)}
                            </Text>
                          </View>
                        </>
                      )}
                      {vatRate > 0 && (() => {
                        const { vatAmount: secVat, totalWithVat: secWithVat } = calcVatTevkifatSummary(sectionNet, vatRate, false, 0, 1);
                        return (
                          <>
                            <View style={styles.sectionSubtotalRow}>
                              <Text style={styles.sectionSubtotalLabel}>
                                KDV (%{vatRate})
                              </Text>
                              <Text style={styles.sectionSubtotalValue}>
                                {formatByCurrency(secVat, currency)}
                              </Text>
                            </View>
                            <View style={styles.sectionSubtotalRow}>
                              <Text style={[styles.sectionSubtotalLabel, { fontWeight: 600 }]}>
                                {i18n.t('proposals:sections.sectionTotalWithVat')}
                              </Text>
                              <Text style={[styles.sectionSubtotalValue, { fontWeight: 600 }]}>
                                {formatByCurrency(secWithVat, currency)}
                              </Text>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  )}
                </View>
              );
            });
          })()}

          {/* Totals summary box - right aligned */}
          <View style={styles.totalsWrap}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{i18n.t('proposals:pdf.grandTotal')}</Text>
                <Text style={styles.summaryValue}>{formatByCurrency(grandTotal, currency)}</Text>
              </View>
              {vatRate > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{i18n.t('proposals:pdf.vat', { rate: vatRate })}</Text>
                    <Text style={styles.summaryValue}>{formatByCurrency(grandVatAmount, currency)}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontWeight: 600 }]}>
                      {i18n.t('proposals:pdf.totalWithVat')}
                    </Text>
                    <Text style={[styles.summaryValue, { fontWeight: 600 }]}>
                      {formatByCurrency(grandTotalWithVat, currency)}
                    </Text>
                  </View>
                </>
              )}
              {hasTevkifat && vatRate > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      {i18n.t('proposals:pdf.withholdingTax', { num: tevkifatNumerator, den: tevkifatDenominator })}
                    </Text>
                    <Text style={styles.summaryValue}>-{formatByCurrency(withheldVat, currency)}</Text>
                  </View>
                  <View style={styles.summaryTotalRow}>
                    <Text style={styles.summaryTotalLabel}>{i18n.t('proposals:pdf.totalPayable')}</Text>
                    <Text style={styles.summaryTotalValue}>{formatByCurrency(totalPayable, currency)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Annual fixed costs (informational) */}
        {annualList.length > 0 && (
          <View>
            <View wrap={false}>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>
                {i18n.t('proposals:pdf.annualFixedTitle')}
              </Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colSira, styles.headerText]}>{i18n.t('proposals:items.sequence')}</Text>
                <Text style={[styles.colDescription, styles.headerText]}>
                  {i18n.t('proposals:annualFixed.description')}
                </Text>
                <Text style={[styles.colQty, styles.headerText]}>{i18n.t('proposals:items.quantity')}</Text>
                <Text style={[styles.colUnit, styles.headerText]}>{i18n.t('proposals:items.unit')}</Text>
                <Text style={[styles.colUnitPrice, styles.headerText]}>{i18n.t('proposals:items.unitPrice')}</Text>
                <Text style={[styles.colTotal, styles.headerText]}>{i18n.t('proposals:items.total')}</Text>
              </View>
              {annualList.map((row, index) => {
                const rowCur = (row.currency || 'TRY').toUpperCase();
                const lineTotal = calcAnnualFixedLineTotal(row.quantity, row.unit_price);
                return (
                  <View key={row.id || index} style={styles.tableRow}>
                    <Text style={styles.colSira}>{index + 1}</Text>
                    <Text style={styles.colDescription}>{safeStr(row.description)}</Text>
                    <Text style={styles.colQty}>{safeNum(row.quantity)}</Text>
                    <Text style={styles.colUnit}>{safeStr(row.unit) || 'adet'}</Text>
                    <Text style={styles.colUnitPrice}>
                      {formatByCurrency(safeNum(row.unit_price, 0), rowCur)}
                    </Text>
                    <Text style={styles.colTotal}>{formatByCurrency(lineTotal, rowCur)}</Text>
                  </View>
                );
              })}
              <View>
                {Object.entries(annualSubtotals).map(([cur, sum]) => (
                  <View key={cur} style={styles.sectionSubtotalRow}>
                    <Text style={styles.sectionSubtotalLabel}>
                      {i18n.t('proposals:pdf.annualFixedSubtotal', { currency: cur })}
                    </Text>
                    <Text style={styles.sectionSubtotalValue}>{formatByCurrency(sum, cur)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={{ fontSize: 8, color: '#737373', marginTop: 8, fontStyle: 'normal' }}>
              {i18n.t('proposals:pdf.annualFixedDisclaimer')}
            </Text>
          </View>
        )}

        {/* Terms sections */}
        {(safeStr(prop.terms_engineering) || safeStr(prop.terms_pricing) || safeStr(prop.terms_warranty) || safeStr(prop.terms_other) || safeStr(prop.terms_attachments)) && (
          <View style={styles.divider}>
            {safeStr(prop.terms_engineering) && (
              <View wrap={false} style={styles.termsSection}>
                <Text style={styles.termsTitle}>MÜHENDİSLİK HİZMETLERİ</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_engineering)}</Text>
              </View>
            )}
            {safeStr(prop.terms_pricing) && (
              <View wrap={false} style={styles.termsSection}>
                <Text style={styles.termsTitle}>FİYATLANDIRMA</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_pricing)}</Text>
              </View>
            )}
            {safeStr(prop.terms_warranty) && (
              <View wrap={false} style={styles.termsSection}>
                <Text style={styles.termsTitle}>GARANTİ</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_warranty)}</Text>
              </View>
            )}
            {safeStr(prop.terms_other) && (
              <View wrap={false} style={styles.termsSection}>
                <Text style={styles.termsTitle}>DİĞER</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_other)}</Text>
              </View>
            )}
            {safeStr(prop.terms_attachments) && (
              <View wrap={false} style={styles.termsSection}>
                <Text style={styles.termsTitle}>EKLER</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_attachments)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signature / approval box */}
        <View wrap={false} style={styles.signatureBox}>
          <Text style={styles.signatureTitle}>Teklifiniz uygun bulunmuştur</Text>
          <Text style={styles.signatureSub}>Kaşe / Ad soyad / İmza</Text>
        </View>

        {/* Footer - no bank info */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {i18n.t('proposals:pdf.footerCompany')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
