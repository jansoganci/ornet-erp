import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, XCircle } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Spinner, Card } from '../../components/ui';
import { ErrorState } from '../../components/ui/ErrorState';
import { ImportInstructionCard, ImportResultSummary, ImportDropzone } from '../../components/import';
import { parseXlsxFile, validateAndMapRows, buildTemplateBlob } from './importUtils';
import { useImportSubscriptions } from './hooks';
import { getErrorMessage } from '../../lib/errorHandler';

const PREVIEW_ROWS = 20;
const MAX_VISIBLE_ERRORS = 50;

function translateErrorCode(t, code) {
  const key = `import.errorCodes.${code}`;
  const translated = t(key, { defaultValue: '' });
  return translated || code;
}

function ValidationErrorTable({ errors, t }) {
  const fieldErrors = errors.filter((e) => e.rowIndex >= 0);
  if (fieldErrors.length === 0) return null;

  const visibleErrors = fieldErrors.slice(0, MAX_VISIBLE_ERRORS);

  return (
    <div className="border border-amber-200 dark:border-amber-900/50 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200 dark:border-amber-900/50">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {t('import.validationErrors')} ({fieldErrors.length})
        </h4>
      </div>
      <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-amber-100/50 dark:bg-amber-950/30 sticky top-0">
            <tr>
              <th className="text-left px-3 py-1.5 font-semibold text-amber-800 dark:text-amber-300 w-16">
                {t('import.errorTableHeaders.row')}
              </th>
              <th className="text-left px-3 py-1.5 font-semibold text-amber-800 dark:text-amber-300 w-32">
                {t('import.errorTableHeaders.field')}
              </th>
              <th className="text-left px-3 py-1.5 font-semibold text-amber-800 dark:text-amber-300">
                {t('import.errorTableHeaders.error')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleErrors.map((err, i) => (
              <tr key={i} className="border-t border-amber-200/50 dark:border-amber-900/30">
                <td className="px-3 py-1.5 text-amber-700 dark:text-amber-400 font-mono text-xs">
                  {err.rowNum}
                </td>
                <td className="px-3 py-1.5 text-amber-800 dark:text-amber-300 font-medium text-xs">
                  {err.field}
                </td>
                <td className="px-3 py-1.5 text-amber-700 dark:text-amber-400 text-xs">
                  {translateErrorCode(t, err.message)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fieldErrors.length > MAX_VISIBLE_ERRORS && (
        <p className="text-xs text-amber-600 dark:text-amber-500 px-3 py-1.5 border-t border-amber-200 dark:border-amber-900/50">
          +{fieldErrors.length - MAX_VISIBLE_ERRORS} ...
        </p>
      )}
    </div>
  );
}

function ImportErrorTable({ errors, t }) {
  if (!errors?.length) return null;

  return (
    <div className="border border-red-200 dark:border-red-900/50 rounded-lg bg-red-50/50 dark:bg-red-950/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200 dark:border-red-900/50">
        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
          {t('import.importErrors')} ({errors.length})
        </h4>
      </div>
      <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-red-100/50 dark:bg-red-950/30 sticky top-0">
            <tr>
              <th className="text-left px-3 py-1.5 font-semibold text-red-800 dark:text-red-300 w-16">
                {t('import.errorTableHeaders.row')}
              </th>
              <th className="text-left px-3 py-1.5 font-semibold text-red-800 dark:text-red-300">
                {t('import.errorTableHeaders.error')}
              </th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err, i) => (
              <tr key={i} className="border-t border-red-200/50 dark:border-red-900/30">
                <td className="px-3 py-1.5 text-red-700 dark:text-red-400 font-mono text-xs">
                  {err.row}
                </td>
                <td className="px-3 py-1.5 text-red-700 dark:text-red-400 text-xs">
                  {err.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubscriptionImportPage() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);

  const importMutation = useImportSubscriptions({
    onProgress: (progress) => setImportProgress(progress),
  });

  const instructionSteps = useMemo(
    () => [
      { title: t('common:import.stepDownload'), description: t('common:import.stepDownloadDesc') },
      { title: t('common:import.stepFill'), description: t('common:import.stepFillDesc') },
      { title: t('common:import.stepUpload'), description: t('common:import.stepUploadDesc') },
      { title: t('common:import.stepReview'), description: t('common:import.stepReviewDesc') },
      { title: t('common:import.stepImport'), description: t('common:import.stepImportDesc') },
    ],
    [t]
  );

  const goBack = useCallback(() => navigate('/subscriptions'), [navigate]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abonelik_sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleFileChange = useCallback((file) => {
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = parseXlsxFile(event.target.result);
        const { rows: validated, errors } = validateAndMapRows(data);
        setRows(validated);
        setValidationErrors(errors);
      } catch (err) {
        setRows([]);
        setValidationErrors([{ rowIndex: -1, field: '_parse', message: err?.message || 'Parse error', rowNum: 0 }]);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (rows.length === 0 || validationErrors.length > 0) return;
    setImportResult(null);
    setImportProgress({ current: 0, total: rows.length });
    try {
      const result = await importMutation.mutateAsync(rows);
      setImportResult(result);
      setImportProgress(null);
      if (result.failed === 0) {
        setTimeout(() => navigate('/subscriptions'), 2000);
      }
    } catch {
      setImportProgress(null);
    }
  }, [rows, validationErrors.length, importMutation, navigate]);

  const hasLimitError = validationErrors.some((e) => e.field === '_limit');
  const onlyLimitError = hasLimitError && validationErrors.length === 1;
  const canImport = rows.length > 0 && (validationErrors.length === 0 || onlyLimitError);

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('subscriptions:import.pageTitle')}
        breadcrumbs={[
          { label: t('common:nav.subscriptions'), to: '/subscriptions' },
          { label: t('common:import.bulkImportButton') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {!rows.length && !importResult && (
          <ImportInstructionCard
            variant="compact"
            title={t('common:import.instructionTitle')}
            intro={t('common:import.instructionIntro')}
            steps={instructionSteps}
          />
        )}

        {!importResult && (
          <ImportDropzone
            title={t('subscriptions:import.uploadTitle')}
            description={t('subscriptions:import.uploadDescription')}
            accept=".xlsx"
            onFile={handleFileChange}
            selectLabel={t('subscriptions:import.selectFile')}
            templateLabel={t('subscriptions:import.downloadTemplate')}
            onDownloadTemplate={handleDownloadTemplate}
          />
        )}

        {hasLimitError && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {t('subscriptions:import.limitError')}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                {t('subscriptions:import.preview')} — {t('subscriptions:import.totalRows', { count: rows.length })}
              </h4>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-x-auto max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.rowNum')}
                      </th>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.customer')}
                      </th>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.site')}
                      </th>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.subscriberTitle')}
                      </th>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.serviceType')}
                      </th>
                      <th className="text-left p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.startDate')}
                      </th>
                      <th className="text-right p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.basePrice')}
                      </th>
                      <th className="text-right p-2 font-semibold text-neutral-700 dark:text-neutral-300">
                        {t('subscriptions:import.previewColumns.simAmount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="p-2 text-neutral-500">{i + 2}</td>
                        <td className="p-2">{row.company_name}</td>
                        <td className="p-2">{row.site_name}</td>
                        <td className="p-2 text-neutral-500 text-xs">{row.subscriber_title || '—'}</td>
                        <td className="p-2">{row.service_type || '—'}</td>
                        <td className="p-2">{row.start_date}</td>
                        <td className="p-2 text-right">{row.base_price}</td>
                        <td className="p-2 text-right">{row.sim_amount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > PREVIEW_ROWS && (
                <p className="text-xs text-neutral-500 mt-1">
                  {t('subscriptions:import.previewRows', { count: PREVIEW_ROWS })}
                </p>
              )}
            </div>

            {importProgress && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('subscriptions:import.progressLabel', {
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

            <ValidationErrorTable errors={validationErrors} t={(key, opts) => t(`subscriptions:${key}`, opts)} />
          </>
        )}

        {importResult && (
          <div className="space-y-4">
            <ImportResultSummary
              variant={importResult.failed === 0 ? 'success' : 'partial'}
              title={t('common:import.summaryTitle')}
              stats={[
                { label: t('common:import.summaryCreated'), value: importResult.created },
                { label: t('common:import.summaryFailed'), value: importResult.failed },
              ]}
              size="compact"
            />

            <ImportErrorTable errors={importResult.errors} t={(key, opts) => t(`subscriptions:${key}`, opts)} />
          </div>
        )}

        {importMutation.error && !importResult && (
          <ErrorState
            message={getErrorMessage(importMutation.error, 'subscriptions.importFailed')}
            onRetry={handleImport}
          />
        )}

        <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="ghost" onClick={goBack}>
            {importResult ? t('common:actions.close') : t('common:actions.cancel')}
          </Button>
          {!importResult && canImport && (
            <Button
              onClick={handleImport}
              loading={importMutation.isPending}
              leftIcon={importMutation.isPending ? <Spinner size="sm" /> : null}
            >
              {t('subscriptions:import.importButton')}
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
