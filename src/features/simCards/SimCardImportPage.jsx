import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle2, X, Save, HelpCircle, Download } from 'lucide-react';
import { useBulkCreateSimCards, useCreateProviderCompany, useProviderCompanies } from './hooks';
import { fetchProviderCompanies, fetchExistingSimIdentifiers } from './api';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { useQueryClient } from '@tanstack/react-query';
import { providerCompanyKeys } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';
import { toast } from 'sonner';

function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).replace(/₺|TL|tl|\s/g, '').replace(',', '.');
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function excelSerialToDate(serial) {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMs);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs);
}

function parseImportDate(value) {
  try {
    if (value === null || value === undefined || value === '' || value === 0) return null;
    const s = String(value).trim();
    if (!s || s === '0') return null;

    const excelSerial = Number(s);
    if (!Number.isNaN(excelSerial) && excelSerial > 1) {
      const d = excelSerialToDate(excelSerial);
      if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1900) return null;
      return d.toISOString().slice(0, 10);
    }

    const ddmmyyyy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (ddmmyyyy) {
      const result = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
      if (new Date(result).getFullYear() <= 1900) return null;
      return result;
    }

    const d = new Date(s);
    if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1900) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export function SimCardImportPage() {
  const { t } = useTranslation(['simCards', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const bulkCreateMutation = useBulkCreateSimCards();
  const createProviderMutation = useCreateProviderCompany();
  const { data: providers } = useProviderCompanies();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setSkippedCount(0);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        validateAndFormatData(jsonData, t);
      } catch {
        setErrors([t('simCards:import.parseError')]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const headerMap = {
    'HAT NO': 'phone_number',
    'LINE NO': 'phone_number',
    'ANA ŞİRKET': '_providerName',
    'PROVIDER COMPANY': '_providerName',
    'AYLIK MALIYET': 'cost_price',
    'COST': 'cost_price',
    'AYLIK SATIS FIYAT': 'sale_price',
    'SALES': 'sale_price',
    'SATIS': 'sale_price',
    'TARİH': 'activation_date_raw',
    'DATE': 'activation_date_raw',
    'MÜŞTERİ ÜNVANI': 'customer_label',
    'CUSTOMER TITLE': 'customer_label',
    'MUSTERI UNVANI': 'customer_label',
    'IMSI': 'imsi',
    'GPRS SERI NO': 'gprs_serial_no',
    'GPRS SERIAL NO': 'gprs_serial_no',
    'ACCOUNT NO': 'account_no',
    'HESAP NO': 'account_no',
    'OPERATOR': 'operator',
    'KAPASITE': 'capacity',
    'CAPACITY': 'capacity',
    'STATUS': 'status',
    'DURUM': 'status',
    'NOTLAR': 'notes',
  };

  const validateAndFormatData = (rawRows, tFn) => {
    const formattedData = [];
    const validationErrors = [];

    rawRows.forEach((row, index) => {
      const rowData = {};
      const rowErrors = [];

      Object.keys(row).forEach((key) => {
        const normalizedKey = normalizeForSearch(key);
        const dbKey = Object.keys(headerMap).find((k) => normalizedKey.includes(normalizeForSearch(k)));
        if (dbKey) rowData[headerMap[dbKey]] = row[key];
      });

      const phone = rowData.phone_number != null ? String(rowData.phone_number).trim() : '';
      rowData.phone_number = phone;
      if (!phone) rowErrors.push(tFn('simCards:import.missingPhone', { row: index + 1 }));

      const providerName = rowData._providerName != null ? String(rowData._providerName).trim() : '';
      if (!providerName) rowErrors.push(tFn('simCards:import.missingProvider', { row: index + 1 }));

      const cost = parseCurrency(rowData.cost_price);
      if (cost === null) rowErrors.push(tFn('simCards:import.missingCost', { row: index + 1 }));
      rowData.cost_price = cost !== null ? cost : 0;

      const sale = parseCurrency(rowData.sale_price);
      if (sale === null) rowErrors.push(tFn('simCards:import.missingSale', { row: index + 1 }));
      rowData.sale_price = sale !== null ? sale : 0;

      const activationDate = parseImportDate(rowData.activation_date_raw);
      rowData.activation_date = activationDate || null;
      delete rowData.activation_date_raw;

      rowData.customer_label = rowData.customer_label ? String(rowData.customer_label).trim() || null : null;

      rowData.imsi = rowData.imsi != null ? String(rowData.imsi).trim() || null : null;
      rowData.gprs_serial_no = rowData.gprs_serial_no != null ? String(rowData.gprs_serial_no).trim() || null : null;
      rowData.account_no = rowData.account_no != null ? String(rowData.account_no).trim() || null : null;

      if (rowData.operator) {
        const op = String(rowData.operator).toUpperCase();
        if (op.includes('TURKCELL')) rowData.operator = 'TURKCELL';
        else if (op.includes('VODAFONE')) rowData.operator = 'VODAFONE';
        else if (op.includes('TELEKOM')) rowData.operator = 'TURK_TELEKOM';
        else rowData.operator = 'TURKCELL';
      } else {
        rowData.operator = 'TURKCELL';
      }

      const VALID_STATUSES = ['available', 'active', 'subscription', 'cancelled'];
      const rawStatus = String(rowData.status || '').trim().toLowerCase();
      rowData.status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'available';
      rowData.currency = 'TRY';
      rowData.notes = rowData.notes != null ? String(rowData.notes).trim() || null : null;

      if (rowErrors.length > 0) {
        validationErrors.push(...rowErrors);
      } else {
        formattedData.push(rowData);
      }
    });

    setData(formattedData);
    setErrors(validationErrors);
  };

  const handleImport = async () => {
    if (data.length === 0) return;

    try {
      let providersList = await queryClient.fetchQuery({ queryKey: providerCompanyKeys.all, queryFn: () => fetchProviderCompanies() });
      const nameToId = {};
      for (const row of data) {
        const name = row._providerName ? String(row._providerName).trim() : '';
        if (!name || nameToId[name]) continue;
        const found = providersList.find((p) => p.name.toLowerCase().trim() === name.toLowerCase());
        if (found) {
          nameToId[name] = found.id;
        } else {
          const created = await createProviderMutation.mutateAsync({ name });
          nameToId[name] = created.id;
          providersList = [...providersList, created];
        }
      }

      const toInsert = data.map((row) => {
        const { _providerName, ...rest } = row;
        const id = _providerName ? nameToId[String(_providerName).trim()] : null;
        return { ...rest, provider_company_id: id || null };
      });

      const existing = await fetchExistingSimIdentifiers();
      const existingPhones = new Set((existing || []).map((r) => (r.phone_number || '').trim().toLowerCase()).filter(Boolean));
      const existingImsis = new Set((existing || []).map((r) => (r.imsi || '').trim()).filter(Boolean));

      const seenPhones = new Set();
      const seenImsis = new Set();
      const filtered = toInsert.filter((row) => {
        const phone = (row.phone_number || '').trim().toLowerCase();
        const imsi = (row.imsi || '').trim();
        if (existingPhones.has(phone) || seenPhones.has(phone)) return false;
        if (imsi && (existingImsis.has(imsi) || seenImsis.has(imsi))) return false;
        seenPhones.add(phone);
        if (imsi) seenImsis.add(imsi);
        return true;
      });
      const skipped = toInsert.length - filtered.length;
      setSkippedCount(skipped);

      if (filtered.length > 0) {
        await bulkCreateMutation.mutateAsync(filtered);
        if (skipped > 0) {
          toast.info(t('simCards:import.skippedDuplicates', { count: skipped }));
        }
        navigate('/sim-cards');
      } else if (skipped > 0) {
        toast.warning(t('simCards:import.allSkippedDuplicates', { count: skipped }));
      }
    } catch {
      toast.error(t('simCards:import.failed'));
      toast.warning(t('simCards:import.partialFailureWarning'));
    }
  };

  if (bulkCreateMutation.isError) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState
          message={getErrorMessage(bulkCreateMutation.error, 'simCards.createFailed')}
          onRetry={() => bulkCreateMutation.reset()}
        />
      </PageContainer>
    );
  }

  const handleReset = () => {
    setData([]);
    setErrors([]);
    setSkippedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const headers = [
      'HAT NO',
      'ANA ŞİRKET',
      'AYLIK MALIYET',
      'AYLIK SATIS FIYAT',
      'TARİH',
      'MÜŞTERİ ÜNVANI',
      'IMSI',
      'GPRS SERI NO',
      'ACCOUNT NO',
      'OPERATOR',
      'KAPASITE',
      'STATUS',
      'NOTLAR',
    ];
    const sampleRows = [
      ['+90 555 123 4567', 'Ornet', '50', '70', '01.01.2024', 'Örnek Müşteri', '', '', '', 'TURKCELL', '100MB', 'available', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SIM Kartlar');
    XLSX.writeFile(wb, 'sim-kart-sablonu.xlsx');
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title={t('simCards:actions.import')}
        breadcrumbs={[
          { label: t('simCards:title'), to: '/sim-cards' },
          { label: t('simCards:actions.import') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {data.length === 0 && !isParsing ? (
          <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-2">
              {t('simCards:import.uploadTitle')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
              {t('simCards:import.uploadDescription')}
            </p>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>
                {t('simCards:import.selectFile')}
              </Button>
              <Button variant="outline" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                {t('simCards:import.downloadTemplate')}
              </Button>
            </div>

            <Card className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-50 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-neutral-500" />
                {t('simCards:import.excelFormat')}
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3" dangerouslySetInnerHTML={{ __html: t('simCards:import.formatIntroNew') }} />
              <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                <p>{t('simCards:import.formatHatNo')}</p>
                <p>{t('simCards:import.formatProvider')}</p>
                <p>{t('simCards:import.formatCost')}</p>
                <p>{t('simCards:import.formatSale')}</p>
                <p>{t('simCards:import.formatDate')}</p>
                <p>{t('simCards:import.formatCustomerTitle')}</p>
                <p>{t('simCards:import.formatImsi')}</p>
                <p>{t('simCards:import.formatGprsSerialNo')}</p>
                <p>{t('simCards:import.formatAccountNo')}</p>
                <p>{t('simCards:import.formatOperator')}</p>
                <p>{t('simCards:import.formatCapacity')}</p>
                <p>{t('simCards:import.formatStatus')}</p>
                <p>{t('simCards:import.formatNotes')}</p>
              </div>
            </Card>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">{t('simCards:import.validRows', { count: data.length })}</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-600">{t('simCards:import.invalidRows', { count: errors.length })}</span>
                  </div>
                )}
                {skippedCount > 0 && (
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    {t('simCards:import.skippedDuplicates', { count: skippedCount })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  {t('simCards:import.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={bulkCreateMutation.isPending || createProviderMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={data.length === 0}
                >
                  {t('simCards:import.startImport')}
                </Button>
              </div>
            </div>

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('simCards:import.errors')}
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('simCards:list.columns.phoneNumber')}</th>
                      <th className="px-4 py-3 font-medium">{t('simCards:list.columns.provider')}</th>
                      <th className="px-4 py-3 font-medium">{t('simCards:list.columns.operator')}</th>
                      <th className="px-4 py-3 font-medium">{t('simCards:form.costPrice')}</th>
                      <th className="px-4 py-3 font-medium">{t('simCards:form.salePrice')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {data.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium">{row.phone_number}</td>
                        <td className="px-4 py-3">{row._providerName || '-'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{row.operator}</Badge>
                        </td>
                        <td className="px-4 py-3">{row.cost_price} ₺</td>
                        <td className="px-4 py-3">{row.sale_price} ₺</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 10 && (
                  <div className="p-3 text-center text-neutral-500 text-xs bg-neutral-50/50 dark:bg-neutral-800/20">
                    {t('simCards:import.andMoreRows', { count: data.length - 10 })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {isParsing && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium">{t('simCards:import.processing')}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
