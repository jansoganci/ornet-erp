import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertCircle, X, Save } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { ImportInstructionCard, ImportResultSummary, ImportDropzone } from '../../components/import';
import { Button, Card, Spinner, ErrorState, Badge } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';
import { parseOperationsWorkbook, validateAndMapImportRows, buildTemplateBlob } from './importUtils';
import { useImportOperationsItems } from './hooks';

export function OperationsImportPage() {
  const { t } = useTranslation(['operations', 'common']);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [isParsing, setIsParsing] = useState(false);

  const importMutation = useImportOperationsItems({
    onProgress: (progress) => setImportProgress(progress),
  });

  const instructionSteps = useMemo(
    () => [
      { title: t('common:import.stepDownload'), description: t('common:import.stepDownloadDesc') },
      { title: t('common:import.stepFill'), description: t('operations:import.instructions.fill') },
      { title: t('common:import.stepUpload'), description: t('common:import.stepUploadDesc') },
      { title: t('common:import.stepReview'), description: t('common:import.stepReviewDesc') },
      { title: t('common:import.stepImport'), description: t('common:import.stepImportDesc') },
    ],
    [t]
  );

  const handleDownloadTemplate = () => {
    const blob = buildTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'operasyon-havuzu-sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (file) => {
    setIsParsing(true);
    setImportResult(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = parseOperationsWorkbook(event.target.result);
        const result = validateAndMapImportRows(parsed);
        setRows(result.rows);
        setErrors(result.errors);
      } catch {
        setRows([]);
        setErrors([{ rowNum: 0, field: '_parse', message: 'PARSE_FAILED', rowIndex: -1 }]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    setRows([]);
    setErrors([]);
    setImportResult(null);
    setImportProgress(null);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImportResult(null);
    setImportProgress({ current: 0, total: rows.length });
    try {
      const result = await importMutation.mutateAsync(rows);
      setImportResult(result);
      setImportProgress(null);
    } catch {
      setImportProgress(null);
    }
  };

  const canImport = rows.length > 0 && errors.length === 0;

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title={t('operations:import.pageTitle')}
        breadcrumbs={[
          { label: t('operations:title'), to: '/operations' },
          { label: t('common:import.bulkImportButton') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {rows.length === 0 && !isParsing ? (
          <div className="space-y-6">
            <ImportInstructionCard
              title={t('common:import.instructionTitle')}
              intro={t('operations:import.instructions.intro')}
              steps={instructionSteps}
            />
            <ImportDropzone
              title={t('operations:import.uploadTitle')}
              description={t('operations:import.uploadDescription')}
              accept=".xlsx,.xls"
              onFile={handleFileChange}
              selectLabel={t('operations:import.selectFile')}
              templateLabel={t('operations:import.downloadTemplate')}
              onDownloadTemplate={handleDownloadTemplate}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {importResult && (
              <ImportResultSummary
                variant={importResult.failed > 0 ? 'partial' : 'success'}
                title={t('common:import.summaryTitle')}
                stats={[
                  { label: t('common:import.summaryCreated'), value: importResult.created },
                  { label: t('common:import.summarySkipped'), value: importResult.skipped },
                  { label: t('common:import.summaryFailed'), value: importResult.failed },
                ]}
              />
            )}

            {importMutation.isError && !importResult && (
              <ErrorState
                message={getErrorMessage(importMutation.error, 'common.importFailed')}
                onRetry={() => importMutation.reset()}
              />
            )}

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('operations:import.errors')}
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>
                      {error.message === 'MAX_ROWS'
                        ? t('operations:import.errorMessages.MAX_ROWS')
                        : t('common:import.fileReadFailed')}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">{t('operations:import.validRows', { count: rows.length })}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  {t('common:actions.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={importMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={!canImport}
                >
                  {t('operations:import.startImport')}
                </Button>
              </div>
            </div>

            {importProgress && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('operations:import.progressLabel', importProgress)}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                  <div
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">{t('operations:import.previewColumns.region')}</th>
                      <th className="px-4 py-3 font-medium">{t('operations:import.previewColumns.description')}</th>
                      <th className="px-4 py-3 font-medium">{t('operations:import.previewColumns.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {rows.slice(0, 50).map((row, index) => (
                      <tr key={`${row.rowNum}-${index}`}>
                        <td className="px-4 py-3 text-neutral-500">{row.rowNum}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">
                            {t(`operations:regions.${row.region}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{row.description}</td>
                        <td className="px-4 py-3">
                          <Badge variant="default" size="sm">{t('operations:status.open')}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {importResult && importResult.failed === 0 && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => navigate('/operations')}>
                  {t('operations:import.backToOperations')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {isParsing && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium">{t('operations:import.processing')}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
