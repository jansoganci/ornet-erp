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
  calcProposalTotals,
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
  headerTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    marginBottom: 10,
  },
  headerTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d4d4d4',
  },
  headerTableRowLast: {
    flexDirection: 'row',
  },
  headerCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#d4d4d4',
  },
  headerCellLast: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  headerCellLabel: {
    fontSize: 8,
    color: '#737373',
    marginBottom: 2,
  },
  headerCellValue: {
    fontSize: 10,
    fontWeight: 600,
    color: '#1a1a1a',
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
  scopeText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#525252',
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginRight: 12,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
    width: 70,
    textAlign: 'right',
  },
  termsSection: {
    marginTop: 14,
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
  for (const s of (sections || [])) sectionMap[s.id] = s.title || '';

  const ungrouped = [];
  const bySection = {};
  for (const item of items) {
    const sid = item.section_id ?? null;
    if (!sid || !(sid in sectionMap)) {
      ungrouped.push(item);
    } else {
      if (!bySection[sid]) bySection[sid] = [];
      bySection[sid].push(item);
    }
  }

  const groups = (sections || []).map((s) => ({
    sectionId: s.id,
    title: s.title || '',
    items: bySection[s.id] || [],
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
}) {
  const prop = proposal || {};
  const currency = prop.currency ?? 'USD';
  const symbol = getCurrencySymbol(currency);
  const itemList = Array.isArray(items) ? items : [];
  const annualList = Array.isArray(annualFixedCosts) ? annualFixedCosts : [];

  // Group items by section; if no sections exist render flat (backward compat)
  const sectionGroups = buildSectionGroups(itemList, sections);
  const hasSections = (sections || []).length > 0;
  const annualSubtotals = sumAnnualFixedCostsByCurrency(annualList);
  const { subtotal, discountAmount, grandTotal } = calcProposalTotals(
    itemList,
    prop.discount_percent,
    currency
  );
  const discountPercent = safeNum(prop.discount_percent, 0);
  const proposalDate = formatTurkishDate(prop.proposal_date || prop.created_at);

  const headerRows = [
    {
      left: safeStr(prop.customer_company_name) || safeStr(prop.company_name),
      right: prop.survey_date ? formatTurkishDate(prop.survey_date) : '',
      labelL: i18n.t('proposals:pdf.headerLabels.companyName'),
      labelR: i18n.t('proposals:pdf.headerLabels.surveyDate'),
    },
    {
      left: safeStr(prop.authorized_person),
      right: proposalDate,
      labelL: i18n.t('proposals:pdf.headerLabels.authorizedPerson'),
      labelR: i18n.t('proposals:pdf.headerLabels.proposalDate'),
    },
    {
      left: safeStr(prop.title),
      right: prop.installation_date ? formatTurkishDate(prop.installation_date) : '',
      labelL: i18n.t('proposals:pdf.headerLabels.title'),
      labelR: i18n.t('proposals:pdf.headerLabels.installationDate'),
    },
    {
      left: safeStr(prop.customer_representative),
      right: prop.completion_date ? formatTurkishDate(prop.completion_date) : '',
      labelL: i18n.t('proposals:pdf.headerLabels.customerRepresentative'),
      labelR: i18n.t('proposals:pdf.headerLabels.completionDate'),
    },
  ].filter((r) => r.left || r.right);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo (top-left) and Certifications (top-right) */}
        <View style={styles.topRow}>
          <View style={styles.logoWrap}>
            {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
          </View>
          <View style={styles.certWrap}>
            {certSrc ? <Image src={certSrc} style={styles.cert} /> : null}
          </View>
        </View>

        {/* Header table: 4 rows × 2 columns */}
        {headerRows.length > 0 && (
          <View style={styles.headerTable}>
            {headerRows.map((r, i) => {
              const isLast = i === headerRows.length - 1;
              return (
                <View key={i} style={isLast ? styles.headerTableRowLast : styles.headerTableRow}>
                  <View style={styles.headerCell}>
                    <Text style={styles.headerCellLabel}>{r.labelL}</Text>
                    <Text style={styles.headerCellValue}>{r.left}</Text>
                  </View>
                  <View style={styles.headerCellLast}>
                    <Text style={styles.headerCellLabel}>{r.labelR}</Text>
                    <Text style={styles.headerCellValue}>{r.right}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Scope of Work */}
        {safeStr(prop.scope_of_work) && (
          <View>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>İş Kapsamı</Text>
            <Text style={styles.scopeText}>{safeStr(prop.scope_of_work)}</Text>
          </View>
        )}

        {/* Items Table with Sıra */}
        <View style={styles.divider} />
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colSira, styles.headerText]}>Sıra</Text>
            <Text style={[styles.colDescription, styles.headerText]}>Malzeme</Text>
            <Text style={[styles.colQty, styles.headerText]}>Adet</Text>
            <Text style={[styles.colUnit, styles.headerText]}>Birim</Text>
            <Text style={[styles.colUnitPrice, styles.headerText]}>B.Fiyat ({symbol})</Text>
            <Text style={[styles.colTotal, styles.headerText]}>Toplam ({symbol})</Text>
          </View>
          {(() => {
            return sectionGroups.map(({ sectionId, title, items: groupItems }) => {
              const groupSubtotal = groupItems.reduce(
                (sum, item) => sum + safeNum(resolveProposalItemLineTotal(item, currency)),
                0,
              );
              const rows = groupItems.map((item, localIndex) => {
                const lineTotal = safeNum(resolveProposalItemLineTotal(item, currency));
                const materialDesc = item.materials?.description ? safeStr(item.materials.description) : '';
                const rowIndex = localIndex + 1;
                return (
                  <View key={item.id || rowIndex} style={styles.tableRow}>
                    <Text style={styles.colSira}>{rowIndex}</Text>
                    <View style={styles.colDescription}>
                      <Text style={{ fontSize: 9 }}>{safeStr(item.description)}</Text>
                      {materialDesc ? (
                        <Text style={{ fontSize: 8, color: '#737373', marginTop: 2, lineHeight: 1.2 }}>
                          {materialDesc}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.colQty}>{safeNum(item.quantity)}</Text>
                    <Text style={styles.colUnit}>{safeStr(item.unit) || 'adet'}</Text>
                    <Text style={styles.colUnitPrice}>
                      {formatByCurrency(resolveProposalItemUnitPrice(item, currency), currency)}
                    </Text>
                    <Text style={styles.colTotal}>{formatByCurrency(lineTotal, currency)}</Text>
                  </View>
                );
              });

              // No sections → flat render (backward compatible)
              if (!hasSections) return rows;

              return (
                <View key={sectionId || '__ungrouped__'}>
                  {title ? (
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeaderText}>{safeStr(title)}</Text>
                    </View>
                  ) : null}
                  {rows}
                  {groupItems.length > 0 && (
                    <View style={styles.sectionSubtotalRow}>
                      <Text style={styles.sectionSubtotalLabel}>
                        {i18n.t('proposals:sections.sectionSubtotal')}
                      </Text>
                      <Text style={styles.sectionSubtotalValue}>
                        {formatByCurrency(groupSubtotal, currency)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            });
          })()}

          {/* Totals: Ara Toplam, İskonto, Genel Toplam */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLineLabel}>Ara Toplam</Text>
              <Text style={styles.totalLineValue}>{formatByCurrency(subtotal, currency)}</Text>
            </View>
            {discountPercent > 0 && (
              <>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>İskonto Oranı</Text>
                  <Text style={styles.totalLineValue}>%{discountPercent}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLineLabel}>İskonto Tutarı</Text>
                  <Text style={styles.totalLineValue}>{formatByCurrency(-discountAmount, currency)}</Text>
                </View>
              </>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Genel Toplam</Text>
              <Text style={styles.totalValue}>{formatByCurrency(grandTotal, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Annual fixed costs (informational) */}
        {annualList.length > 0 && (
          <View>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>
              {i18n.t('proposals:pdf.annualFixedTitle')}
            </Text>
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
              <View style={styles.totalsBlock}>
                {Object.entries(annualSubtotals).map(([cur, sum]) => (
                  <View key={cur} style={styles.totalLine}>
                    <Text style={styles.totalLineLabel}>
                      {i18n.t('proposals:pdf.annualFixedSubtotal', { currency: cur })}
                    </Text>
                    <Text style={styles.totalLineValue}>{formatByCurrency(sum, cur)}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={[styles.termsBody, { marginTop: 8 }]}>
              {i18n.t('proposals:pdf.annualFixedDisclaimer')}
            </Text>
          </View>
        )}

        {/* Terms sections */}
        {(safeStr(prop.terms_engineering) || safeStr(prop.terms_pricing) || safeStr(prop.terms_warranty) || safeStr(prop.terms_other) || safeStr(prop.terms_attachments)) && (
          <View style={styles.divider}>
            {safeStr(prop.terms_engineering) && (
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>MÜHENDİSLİK HİZMETLERİ</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_engineering)}</Text>
              </View>
            )}
            {safeStr(prop.terms_pricing) && (
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>FİYATLANDIRMA</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_pricing)}</Text>
              </View>
            )}
            {safeStr(prop.terms_warranty) && (
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>GARANTİ</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_warranty)}</Text>
              </View>
            )}
            {safeStr(prop.terms_other) && (
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>DİĞER</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_other)}</Text>
              </View>
            )}
            {safeStr(prop.terms_attachments) && (
              <View style={styles.termsSection}>
                <Text style={styles.termsTitle}>EKLER</Text>
                <Text style={styles.termsBody}>{safeStr(prop.terms_attachments)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Signature / approval box */}
        <View style={styles.signatureBox}>
          <Text style={styles.signatureTitle}>Teklifiniz uygun bulunmuştur</Text>
          <Text style={styles.signatureSub}>Kaşe / Ad soyad / İmza</Text>
        </View>

        {/* Footer - no bank info */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Ornet Güvenlik Sistemleri
          </Text>
        </View>
      </Page>
    </Document>
  );
}
