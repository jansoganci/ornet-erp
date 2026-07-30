import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertTriangle, TrendingDown, FileWarning, Archive } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Spinner, ErrorState, KpiCard } from '../../components/ui';
import { ImportDropzone } from '../../components/import';
import { parseTurkcellInvoice } from './utils/parseTurkcellInvoice';
import { compareInvoiceToInventory } from './utils/compareInvoiceToInventory';
import { fetchAllTurkcellSimCards } from './api';
import { formatCurrency } from '../../lib/utils';
import { InvoiceAlertsPanel } from './components/InvoiceAlertsPanel';

// Page state machine: idle → parsing → loading_inventory → ready | error
const STATES = {
  IDLE: 'idle',
  PARSING: 'parsing',
  LOADING_INVENTORY: 'loading_inventory',
  READY: 'ready',
  ERROR: 'error',
};

export function InvoiceAnalysisPage() {
  const { t } = useTranslation('invoiceAnalysis');

  const [state, setState] = useState(STATES.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [sourceFormat, setSourceFormat] = useState(null);

  const handleReset = () => {
    setState(STATES.IDLE);
    setErrorMessage('');
    setParseResult(null);
    setComparison(null);
    setSourceFormat(null);
  };

  const processFile = async (file) => {
    const name = file.name.toLowerCase();
    setSourceFormat(name.endsWith('.csv') ? 'csv' : name.endsWith('.xml') ? 'xml' : 'pdf');
    setState(STATES.PARSING);

    try {
      const parsed = await parseTurkcellInvoice(file);

      if (parsed.lines.length === 0) {
        setErrorMessage(t('errors.noLinesFound'));
        setState(STATES.ERROR);
        return;
      }

      setParseResult(parsed);
      setSourceFormat(parsed.sourceFormat);
      setState(STATES.LOADING_INVENTORY);

      // Phase 2: Fetch Turkcell inventory
      let simCards;
      try {
        simCards = await fetchAllTurkcellSimCards();
      } catch {
        setErrorMessage(t('errors.fetchFailed'));
        setState(STATES.ERROR);
        return;
      }

      // Phase 3: Compare
      const result = compareInvoiceToInventory(parsed.lines, simCards || []);
      setComparison(result);
      setState(STATES.READY);
    } catch (err) {
      setErrorMessage(err?.message === 'unsupported_format' ? t('errors.unsupportedFormat') : t('errors.parseFailed'));
      setState(STATES.ERROR);
    }
  };

  // Derive invoice period from the PDF's own Fatura Tarihi field
  const periodLabel = parseResult?.invoiceDate ?? '';

  return (
    <PageContainer maxWidth="full">
      {/* Loading overlays */}
      {(state === STATES.PARSING || state === STATES.LOADING_INVENTORY) && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              {state === STATES.PARSING
                ? (sourceFormat === 'csv' ? t('upload.parsingCsv') : sourceFormat === 'xml' ? t('upload.parsingXml') : sourceFormat === 'pdf' ? t('upload.parsingPdf') : t('upload.parsing'))
                : t('loading.inventory')}
            </p>
          </div>
        </div>
      )}

      {/* IDLE: Upload zone */}
      {state === STATES.IDLE && (
        <>
          <PageHeader
            title={t('title')}
            breadcrumbs={[
              { label: 'SIM Kartlar', to: '/sim-cards' },
              { label: t('title') },
            ]}
          />
          <div className="mt-6">
            <ImportDropzone
              title={t('upload.title')}
              description={t('upload.description')}
              accept=".pdf,.csv,.xml"
              onFile={processFile}
              selectLabel={t('upload.button')}
            />
          </div>
        </>
      )}

      {/* ERROR state */}
      {state === STATES.ERROR && (
        <>
          <PageHeader title={t('title')} />
          <div className="mt-6">
            <ErrorState message={errorMessage} />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={handleReset}
              >
                {t('reset')}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* READY: Full results */}
      {state === STATES.READY && comparison && parseResult && (
        <>
          <PageHeader
            title={`${t('title')}${periodLabel ? ` — ${periodLabel}` : ''}`}
            breadcrumbs={[
              { label: 'SIM Kartlar', to: '/sim-cards' },
              { label: t('title') },
            ]}
            actions={
              <Button
                variant="outline"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={handleReset}
              >
                {t('reset')}
              </Button>
            }
          />

          <div className="mt-6">
            {/* Invoice header metadata */}
            {(parseResult.invoiceNo || parseResult.invoiceDate || parseResult.paymentDate || sourceFormat) && (
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400">
                {sourceFormat && (
                  <span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{t('invoice.sourceLabel')}: </span>
                    {sourceFormat === 'csv' ? t('invoice.sourceCsv') : sourceFormat === 'xml' ? t('invoice.sourceXml') : t('invoice.sourcePdf')}
                  </span>
                )}
                {parseResult.invoiceNo && (
                  <span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{t('invoice.no')}: </span>
                    {parseResult.invoiceNo}
                  </span>
                )}
                {parseResult.invoiceDate && (
                  <span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{t('invoice.date')}: </span>
                    {parseResult.invoiceDate}
                  </span>
                )}
                {parseResult.paymentDate && (
                  <span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{t('invoice.paymentDate')}: </span>
                    {parseResult.paymentDate}
                  </span>
                )}
              </div>
            )}

            {/* Teknik bütünlük notları — ikincil, kısa liste */}
            {(parseResult.parseWarning ||
              parseResult.parseErrors.length > 0 ||
              comparison.unresolvableCards.length > 0 ||
              comparison.duplicateHatNos.length > 0) && (
              <div className="mb-4 flex items-start gap-2 px-4 py-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700">
                <AlertTriangle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-0.5">
                  {parseResult.parseWarning && <li>{t('errors.integrityWarning')}</li>}
                  {parseResult.parseErrors.map((err, i) => <li key={`pe-${i}`}>{err}</li>)}
                  {comparison.unresolvableCards.length > 0 && (
                    <li>{comparison.unresolvableCards.length} envanter kaydı eşleştirilemedi (geçersiz telefon formatı)</li>
                  )}
                  {comparison.duplicateHatNos.length > 0 && (
                    <li>{comparison.duplicateHatNos.length} tekrarlanan hat numarası — son kayıt esas alındı</li>
                  )}
                </ul>
              </div>
            )}

            {(() => {
              const lossLines = comparison.matched.filter((m) => m.isLoss);
              const lossTotal = lossLines.reduce((s, m) => s + Math.abs(m.profit), 0);

              return (
                <>
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
                    <KpiCard
                      title={t('summary.loss')}
                      value={lossLines.length.toLocaleString('tr-TR')}
                      subtitle={formatCurrency(lossTotal)}
                      icon={TrendingDown}
                      variant="error"
                    />
                    <KpiCard
                      title={t('summary.invoiceOnly')}
                      value={comparison.summary.invoiceOnlyCount.toLocaleString('tr-TR')}
                      subtitle={formatCurrency(comparison.summary.invoiceOnlyTotal)}
                      icon={FileWarning}
                      variant="warning"
                    />
                    <KpiCard
                      title={t('summary.inventoryOnly')}
                      value={comparison.summary.inventoryOnlyCount.toLocaleString('tr-TR')}
                      icon={Archive}
                      variant="info"
                    />
                  </div>

                  <InvoiceAlertsPanel
                    lossLines={lossLines}
                    invoiceOnly={comparison.invoiceOnly}
                    inventoryOnly={comparison.inventoryOnly}
                  />
                </>
              );
            })()}
          </div>
        </>
      )}
    </PageContainer>
  );
}
