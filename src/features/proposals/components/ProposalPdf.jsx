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
    width: 270,
    height: 112,
  },
  logo: {
    width: 270,
    height: 112,
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
  headerGridWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    width: '90%',
  },
  headerGridHalf: {
    width: '50%',
    marginBottom: 2,
  },
  headerGridLabel: {
    fontSize: 9,
    color: '#737373',
    marginBottom: 0,
    lineHeight: 1.1,
  },
  headerGridValue: {
    fontSize: 10,
    fontWeight: 600,
    color: '#1a1a1a',
    lineHeight: 1.15,
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

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatTurkishDate(dateStr) {
  if (dateStr == null || dateStr === '') return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const month = MONTHS_TR[d.getMonth()];
  return `${d.getDate()} ${month != null ? month : ''} ${d.getFullYear()}`;
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

function HeaderField({ label, value }) {
  if (!safeStr(value)) return null;
  return (
    <View style={styles.headerGridHalf}>
      <Text style={styles.headerGridLabel}>{label}</Text>
      <Text style={styles.headerGridValue}>{safeStr(value)}</Text>
    </View>
  );
}

export function ProposalPdf({ proposal, items }) {
  const prop = proposal || {};
  const currency = prop.currency ?? 'USD';
  const symbol = getCurrencySymbol(currency);
  const itemList = Array.isArray(items) ? items : [];
  const subtotal = itemList.reduce(
    (sum, item) =>
      sum + safeNum(item.line_total ?? item.total_usd ?? (safeNum(item.quantity) * safeNum(item.unit_price ?? item.unit_price_usd))),
    0
  );
  const discountPercent = safeNum(prop.discount_percent, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  const proposalDate = formatTurkishDate(prop.created_at);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logo (top-left) and Certifications (top-right) */}
        <View style={styles.topRow}>
          <View style={styles.logoWrap}>
            <Image src="/ornet.logo.png" style={styles.logo} />
          </View>
          <View style={styles.certWrap}>
            <Image src="/falan.png" style={styles.cert} />
          </View>
        </View>

        {/* Header grid: 8 fields (centered) */}
        <View style={styles.headerGridWrap}>
          <View style={styles.headerGrid}>
            <HeaderField label="FİRMA ADI :" value={prop.company_name} />
            <HeaderField label="KEŞİF TARİHİ :" value={prop.survey_date ? formatTurkishDate(prop.survey_date) : ''} />
            <HeaderField label="YETKİLİ KİŞİ :" value={prop.authorized_person} />
            <HeaderField label="TEKLİF TARİHİ :" value={proposalDate} />
            <HeaderField label="PROJE ADI :" value={prop.title} />
            <HeaderField label="MONTAJ TARİHİ :" value={prop.installation_date ? formatTurkishDate(prop.installation_date) : ''} />
            <HeaderField label="MÜŞTERİ TEMSİLCİSİ :" value={prop.customer_representative} />
            <HeaderField label="BİTİŞ TARİHİ :" value={prop.completion_date ? formatTurkishDate(prop.completion_date) : ''} />
          </View>
        </View>

        {/* Customer / site (optional) */}
        {(safeStr(prop.customer_company_name) || safeStr(prop.site_name)) && (
          <View style={{ marginBottom: 8 }}>
            {safeStr(prop.customer_company_name) && (
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#404040' }}>{safeStr(prop.customer_company_name)}</Text>
            )}
            {safeStr(prop.site_name) && (
              <Text style={{ fontSize: 10, color: '#737373', marginTop: 2 }}>{safeStr(prop.site_name)}</Text>
            )}
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
          {itemList.map((item, index) => {
            const lineTotal = safeNum(
              item.line_total ?? item.total_usd ?? (safeNum(item.quantity) * safeNum(item.unit_price ?? item.unit_price_usd))
            );
            const materialDesc = item.materials?.description ? safeStr(item.materials.description) : '';
            return (
              <View key={item.id || index} style={styles.tableRow}>
                <Text style={styles.colSira}>{index + 1}</Text>
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
                <Text style={styles.colUnitPrice}>{formatByCurrency(item.unit_price ?? item.unit_price_usd, currency)}</Text>
                <Text style={styles.colTotal}>{formatByCurrency(lineTotal, currency)}</Text>
              </View>
            );
          })}

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
