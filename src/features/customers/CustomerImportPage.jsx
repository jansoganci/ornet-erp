import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, AlertCircle, CheckCircle2, X, Save, Download } from 'lucide-react';
import { parseXlsxFile, validateAndMapRows, buildTemplateBlob } from './importUtils';
import { fetchExistingCustomerNames } from './api';
import { useImportCustomersAndSites } from './hooks';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';
import { toast } from 'sonner';

export function CustomerImportPage() {
  const { t } = useTranslation(['customers', 'common']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [duplicateNames, setDuplicateNames] = useState(new Set());
  const [importProgress, setImportProgress] = useState(null);

  const importMutation = useImportCustomersAndSites({
    onProgress: (progress) => setImportProgress(progress),
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setImportResult(null);
    setDuplicateNames(new Set());
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const excelRows = parseXlsxFile(event.target.result);
        const { rows, errors: validationErrors } = validateAndMapRows(excelRows);
        setData(rows);
        setErrors(validationErrors);

        // Check parsed company names against DB — runs while spinner is still showing
        const existingNames = await fetchExistingCustomerNames();
        const normalizedSet = new Set(existingNames.map((n) => normalizeForSearch(n)));
        setDuplicateNames(normalizedSet);
      } catch {
        setData([]);
        setErrors([{ rowIndex: -1, field: '_parse', message: 'Parse error', rowNum: 0 }]);
        setDuplicateNames(new Set());
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (data.length === 0 || errors.length > 0) return;

    setImportResult(null);
    setImportProgress({ current: 0, total: data.length });
    try {
      const result = await importMutation.mutateAsync(data);
      setImportResult(result);
      setImportProgress(null);
      if (result.failed === 0) {
        toast.success(t('customers:import.success', { created: result.created, skipped: result.skipped }));
        setTimeout(() => navigate('/customers'), 1500);
      }
    } catch (err) {
      console.error('[import] handleImport error', err);
      setImportProgress(null);
    }
  };

  const handleReset = () => {
    setData([]);
    setErrors([]);
    setImportResult(null);
    setDuplicateNames(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'musteri-sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasCriticalErrors = errors.length > 0;
  const hasLimitError = errors.some((e) => e.field === '_limit');
  const canImport = data.length > 0 && !hasCriticalErrors;

  const isDuplicateRow = (row) =>
    !!row.company_name && duplicateNames.has(normalizeForSearch(row.company_name));

  const uniqueDuplicateNames = [
    ...new Set(data.filter(isDuplicateRow).map((r) => r.company_name)),
  ];

  if (importMutation.isError) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState
          message={getErrorMessage(importMutation.error, 'common.importFailed')}
          onRetry={() => importMutation.reset()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title={t('customers:import.title')}
        breadcrumbs={[
          { label: t('common:nav.customers'), to: '/customers' },
          { label: t('customers:import.title') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {data.length === 0 && !isParsing ? (
          <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-2">
              {t('customers:import.uploadTitle')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
              {t('customers:import.uploadDescription')}
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>
                {t('customers:import.selectFile')}
              </Button>
              <Button variant="outline" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                {t('customers:import.downloadTemplate')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">{t('customers:import.validRows', { count: data.length })}</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-600">
                      {t('customers:import.invalidRows', { count: errors.length })}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  {t('customers:import.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={!canImport}
                >
                  {importProgress
                    ? t('customers:import.progressLabel', {
                        current: importProgress.current,
                        total: importProgress.total,
                      })
                    : t('customers:import.startImport')}
                </Button>
              </div>
            </div>

            {importProgress && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('customers:import.progressLabel', {
                      current: importProgress.current,
                      total: importProgress.total,
                    })}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {importProgress.total > 0
                      ? Math.round((importProgress.current / importProgress.total) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Card>
            )}

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('customers:import.errors')}
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                  {errors.filter((e) => e.rowIndex >= 0).map((err, i) => (
                    <li key={i}>
                      {t('customers:import.rowError', {
                        row: err.rowNum,
                        field: err.field,
                        message: t(`customers:import.errorMessages.${err.message}`) || err.message,
                      })}
                    </li>
                  ))}
                  {hasLimitError && (
                    <li>{t('customers:import.errorMessages.MAX_ROWS')}</li>
                  )}
                </ul>
              </Card>
            )}

            {uniqueDuplicateNames.length > 0 && !importResult && (
              <Card className="p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('customers:import.duplicates.warning', { count: uniqueDuplicateNames.length })}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  {t('customers:import.duplicates.detail')}
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
                  {uniqueDuplicateNames.map((name, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {name}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Müşteri</th>
                      <th className="px-4 py-3 font-medium">Abone Ünvanı</th>
                      <th className="px-4 py-3 font-medium">Merkez</th>
                      <th className="px-4 py-3 font-medium">ACC.</th>
                      <th className="px-4 py-3 font-medium">Lokasyon</th>
                      <th className="px-4 py-3 font-medium">İl / İlçe</th>
                      <th className="px-4 py-3 font-medium">Bağlantı Tarihi</th>
                      {!importResult && duplicateNames.size > 0 && <th className="px-4 py-3 font-medium">{t('customers:import.duplicates.statusColumn')}</th>}
                      {importResult && <th className="px-4 py-3 font-medium">Durum</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {data.slice(0, 20).map((row, i) => (
                      <tr key={i} className={!importResult && isDuplicateRow(row) ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                        <td className="px-4 py-3 text-neutral-500">{i + 2}</td>
                        <td className="px-4 py-3 font-medium">{row.company_name}</td>
                        <td className="px-4 py-3 max-w-[120px] truncate" title={row.subscriber_title}>
                          {row.subscriber_title || '—'}
                        </td>
                        <td className="px-4 py-3">{row.alarm_center}</td>
                        <td className="px-4 py-3 font-mono">{row.account_no}</td>
                        <td className="px-4 py-3">{row.site_name}</td>
                        <td className="px-4 py-3">{row.city} / {row.district}</td>
                        <td className="px-4 py-3">{row.connection_date || '—'}</td>
                        {!importResult && duplicateNames.size > 0 && (
                          <td className="px-4 py-3">
                            {isDuplicateRow(row) ? (
                              <Badge variant="warning" size="sm">{t('customers:import.duplicates.statusExisting')}</Badge>
                            ) : (
                              <Badge variant="success" size="sm">{t('customers:import.duplicates.statusNew')}</Badge>
                            )}
                          </td>
                        )}
                        {importResult?.results[i] && (
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                importResult.results[i].status === 'created'
                                  ? 'success'
                                  : importResult.results[i].status === 'skipped'
                                    ? 'warning'
                                    : 'error'
                              }
                              size="sm"
                            >
                              {importResult.results[i].status === 'created'
                                ? t('customers:import.status.created')
                                : importResult.results[i].status === 'skipped'
                                  ? t('customers:import.status.skipped')
                                  : t('customers:import.status.failed')}
                            </Badge>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 20 && (
                  <div className="p-3 text-center text-neutral-500 text-xs bg-neutral-50/50 dark:bg-neutral-800/20">
                    {t('customers:import.andMoreRows', { count: data.length - 20 })}
                  </div>
                )}
              </div>
            </Card>

            {importResult && (
              <Card className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700">
                <p className="font-medium text-neutral-900 dark:text-neutral-50">
                  {t('customers:import.resultSummary', {
                    created: importResult.created,
                    skipped: importResult.skipped,
                    failed: importResult.failed,
                  })}
                </p>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-2 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>{t('customers:import.resultRowError', { row: e.row, message: e.message })}</li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        )}
      </div>

      {isParsing && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium">{t('customers:import.processing')}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
