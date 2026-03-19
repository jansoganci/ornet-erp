import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, AlertCircle, CheckCircle2, X, Save, Download } from 'lucide-react';
import { parseXlsxFile, validateAndMapRows, buildTemplateBlob } from './importUtils';
import { resolveSitesForAssetRows } from './api';
import { useImportSiteAssets } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { ImportInstructionCard, ImportResultSummary } from '../../components/import';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';

export function SiteAssetsImportPage() {
  const { t } = useTranslation(['siteAssets', 'common']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [unresolvedIndices, setUnresolvedIndices] = useState(new Set());
  const [rowToSite, setRowToSite] = useState(new Map());

  const importMutation = useImportSiteAssets();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setImportResult(null);
    setUnresolvedIndices(new Set());
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const excelRows = parseXlsxFile(event.target.result);
        const { rows, errors: validationErrors } = validateAndMapRows(excelRows);
        setData(rows);
        setErrors(validationErrors);

        const { rowToSite: resolved, unresolvedIndices: unresolved } = await resolveSitesForAssetRows(rows);
        setRowToSite(resolved);
        setUnresolvedIndices(unresolved);
      } catch {
        setData([]);
        setErrors([{ rowNum: 0, field: '_parse', message: 'PARSE_FAILED', rowIndex: -1 }]);
        setRowToSite(new Map());
        setUnresolvedIndices(new Set());
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (importableRows.length === 0) return;

    setImportResult(null);
    try {
      const payload = [];
      for (let i = 0; i < data.length; i++) {
        if (rowsWithErrors.has(i) || !rowToSite.has(i)) continue;
        const row = data[i];
        const site = rowToSite.get(i);
        payload.push({
          site_id: site.id,
          equipment_name: row.equipment_name,
          quantity: row.quantity,
          installation_date: row.installation_date,
        });
      }

      if (payload.length === 0) {
        toast.error(t('siteAssets:import.noResolvedRows'));
        return;
      }

      await importMutation.mutateAsync(payload);
      const skippedCount = data.filter((_, i) => !rowsWithErrors.has(i) && unresolvedIndices.has(i)).length;
      setImportResult({ imported: payload.length, skipped: skippedCount });
      toast.success(
        skippedCount > 0
          ? t('siteAssets:import.resultSummaryWithSkipped', {
              imported: payload.length,
              skipped: skippedCount,
            })
          : t('siteAssets:import.resultSummary', { count: payload.length })
      );
      setTimeout(() => navigate('/equipment'), 2200);
    } catch {
      // Mutation surfaces error via hook / toast
    }
  };

  const handleReset = () => {
    setData([]);
    setErrors([]);
    setImportResult(null);
    setRowToSite(new Map());
    setUnresolvedIndices(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'varlik-takip-sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasLimitError = errors.some((e) => e.field === '_limit');
  const rowsWithErrors = new Set(errors.filter((e) => e.rowIndex >= 0).map((e) => e.rowIndex));
  const importableRows = data.filter((_, i) => !rowsWithErrors.has(i) && rowToSite.has(i));
  const canImport = importableRows.length > 0 && !hasLimitError;

  const unresolvedAccountNos = new Set(data.filter((_, i) => unresolvedIndices.has(i)).map((r) => r.account_no).filter(Boolean));
  const isRowUnresolved = (_, i) => unresolvedIndices.has(i);

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

  if (importMutation.isError) {
    return (
      <PageContainer maxWidth="full">
        <ErrorState
          message={getErrorMessage(importMutation.error, 'common.importFailed')}
          onRetry={() => importMutation.reset()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('siteAssets:import.pageTitle')}
        breadcrumbs={[
          { label: t('siteAssets:title'), to: '/equipment' },
          { label: t('common:import.bulkImportButton') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {data.length === 0 && !isParsing ? (
          <div className="space-y-6">
            <ImportInstructionCard
              title={t('common:import.instructionTitle')}
              intro={t('common:import.instructionIntro')}
              steps={instructionSteps}
            />
            <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
                <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-2">
                {t('siteAssets:import.uploadTitle')}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
                {t('siteAssets:import.uploadDescription')}
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()}>
                  {t('siteAssets:import.selectFile')}
                </Button>
                <Button variant="outline" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                  {t('siteAssets:import.downloadTemplate')}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">
                    {t('siteAssets:import.validRows', { count: importableRows.length })}
                  </span>
                  <span className="text-neutral-500 text-sm">
                    {t('siteAssets:import.willImport', { count: importableRows.length })}
                  </span>
                </div>
                {rowsWithErrors.size > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-600">
                      {t('siteAssets:import.invalidRows', { count: rowsWithErrors.size })}
                    </span>
                  </div>
                )}
                {unresolvedAccountNos.size > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium text-amber-600">
                      {t('siteAssets:import.unresolvedAcc', { count: unresolvedAccountNos.size })}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  {t('siteAssets:import.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={!canImport}
                >
                  {t('siteAssets:import.startImport')}
                </Button>
              </div>
            </div>

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('siteAssets:import.errors')}
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                  {errors
                    .filter((e) => e.rowIndex < 0)
                    .map((err, i) => (
                      <li key={`global-${i}`}>
                        {t(`siteAssets:import.errorMessages.${err.message}`, {
                          defaultValue: t('common:import.fileReadFailed'),
                        })}
                      </li>
                    ))}
                  {errors.filter((e) => e.rowIndex >= 0).map((err, i) => (
                    <li key={i}>
                      {t('siteAssets:import.rowError', {
                        row: err.rowNum,
                        field: err.field,
                        message: t(`siteAssets:import.errorMessages.${err.message}`) || err.message,
                      })}
                    </li>
                  ))}
                  {hasLimitError && <li>{t('siteAssets:import.errorMessages.MAX_ROWS')}</li>}
                </ul>
              </Card>
            )}

            {unresolvedAccountNos.size > 0 && (
              <Card className="p-4 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30">
                <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('siteAssets:import.unresolvedWarning')}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  {t('siteAssets:import.unresolvedDetail')}
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
                  {[...unresolvedAccountNos].map((acc, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {acc}
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
                      <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.customer')}</th>
                      <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.acc')}</th>
                      <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.equipment')}</th>
                      <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.quantity')}</th>
                      <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.installationDate')}</th>
                      {unresolvedAccountNos.size > 0 && (
                        <th className="px-4 py-3 font-medium">{t('siteAssets:import.previewColumns.status')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {data.slice(0, 50).map((row, i) => (
                      <tr
                        key={i}
                        className={
                          isRowUnresolved(row, i)
                            ? 'bg-amber-50/60 dark:bg-amber-900/10'
                            : rowsWithErrors.has(i)
                              ? 'bg-red-50/40 dark:bg-red-900/5'
                              : ''
                        }
                      >
                        <td className="px-4 py-3 text-neutral-500">{i + 2}</td>
                        <td className="px-4 py-3 font-medium">{row.company_name || '—'}</td>
                        <td className="px-4 py-3 font-mono">{row.account_no || '—'}</td>
                        <td className="px-4 py-3">{row.equipment_name || '—'}</td>
                        <td className="px-4 py-3">{row.quantity ?? 1}</td>
                        <td className="px-4 py-3">
                          {row.installation_date ? formatDate(row.installation_date) : '—'}
                        </td>
                        {unresolvedAccountNos.size > 0 && (
                          <td className="px-4 py-3">
                            {isRowUnresolved(row, i) ? (
                              <Badge variant="warning" size="sm">
                                {t('siteAssets:import.statusUnresolved')}
                              </Badge>
                            ) : rowsWithErrors.has(i) ? (
                              <Badge variant="error" size="sm">
                                {t('siteAssets:import.statusInvalid')}
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                {t('siteAssets:import.statusOk')}
                              </Badge>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 50 && (
                  <div className="p-3 text-center text-neutral-500 text-xs bg-neutral-50/50 dark:bg-neutral-800/20">
                    {t('siteAssets:import.andMoreRows', { count: data.length - 50 })}
                  </div>
                )}
              </div>
            </Card>

            {importResult && (
              <ImportResultSummary
                variant={importResult.skipped > 0 ? 'partial' : 'success'}
                title={t('common:import.summaryTitle')}
                stats={[
                  { label: t('common:import.summaryCreated'), value: importResult.imported },
                  { label: t('common:import.summarySkipped'), value: importResult.skipped },
                ]}
                message={t('common:import.summarySuccess')}
              />
            )}
          </div>
        )}
      </div>

      {isParsing && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium">{t('siteAssets:import.processing')}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
