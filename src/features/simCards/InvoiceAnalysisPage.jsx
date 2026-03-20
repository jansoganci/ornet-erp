import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, UploadCloud, RefreshCw, AlertTriangle, FileText, DollarSign, CheckCircle2, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Spinner, ErrorState, KpiCard } from '../../components/ui';
import { parseTurkcellPdf } from './utils/parseTurkcellPdf';
import { compareInvoiceToInventory } from './utils/compareInvoiceToInventory';
import { fetchAllTurkcellSimCards } from './api';
import { formatCurrency } from '../../lib/utils';
import { InvoiceAlertsPanel } from './components/InvoiceAlertsPanel';
import { InvoiceTariffChart } from './components/InvoiceTariffChart';
import { InvoiceResultTabs } from './components/InvoiceResultTabs';

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
  const fileInputRef = useRef(null);

  const [state, setState] = useState(STATES.IDLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [comparison, setComparison] = useState(null);

  const handleReset = () => {
    setState(STATES.IDLE);
    setErrorMessage('');
    setInvoiceFileName('');
    setParseResult(null);
    setComparison(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInvoiceFileName(file.name);
    setState(STATES.PARSING);

    try {
      // Phase 1: Parse PDF
      const parsed = await parseTurkcellPdf(file);

      if (parsed.lines.length === 0) {
        setErrorMessage(t('errors.noLinesFound'));
        setState(STATES.ERROR);
        return;
      }

      setParseResult(parsed);
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
      setComparison({ ...result, tariffBreakdown: parsed.tariffBreakdown });
      setState(STATES.READY);
    } catch {
      setErrorMessage(t('errors.parseFailed'));
      setState(STATES.ERROR);
    }
  };

  // Derive invoice period from filename (e.g. "TURKCELL GPRS HATLAR MART 26.pdf" → "MART 26")
  const periodLabel = invoiceFileName
    ? invoiceFileName.replace(/\.pdf$/i, '').trim()
    : '';

  return (
    <PageContainer maxWidth="full">
      {/* Loading overlays */}
      {(state === STATES.PARSING || state === STATES.LOADING_INVENTORY) && (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Spinner size="lg" className="mb-4 mx-auto" />
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              {state === STATES.PARSING ? t('upload.parsing') : t('loading.inventory')}
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
            <Card className="p-12 border-dashed border-2 border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-center">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
                <FileSearch className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
                {t('upload.title')}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm text-sm">
                {t('upload.description')}
              </p>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button
                variant="primary"
                leftIcon={<UploadCloud className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('upload.button')}
              </Button>
            </Card>
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
            {parseResult.parseErrors.length > 0 && (
              <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800">
                <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-800 dark:text-warning-300 text-sm">
                    {parseResult.parseErrors.length} sayfa okunamadı — sonuçlar eksik olabilir
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {parseResult.parseErrors.map((err, i) => (
                      <li key={i} className="text-xs text-warning-700 dark:text-warning-400">{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {comparison.unresolvableCards.length > 0 && (
              <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <AlertTriangle className="w-5 h-5 text-error-600 dark:text-error-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-error-800 dark:text-error-300 text-sm">
                    {comparison.unresolvableCards.length} envanter kaydı eşleştirilemedi — geçersiz telefon formatı
                  </p>
                  <p className="text-xs text-error-700 dark:text-error-400 mt-0.5">
                    Bu numaralar 10 haneye normalize edilemedi ve karşılaştırmadan çıkarıldı:{' '}
                    {comparison.unresolvableCards.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {comparison.summary?.unknownCostCount > 0 && (
              <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800">
                <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-800 dark:text-warning-300 text-sm">
                    {t('alerts.unknownCost', { count: comparison.summary.unknownCostCount })}
                  </p>
                  <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
                    {t('alerts.unknownCostDescription')}
                  </p>
                </div>
              </div>
            )}

            {comparison.duplicateHatNos.length > 0 && (
              <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800">
                <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-800 dark:text-warning-300 text-sm">
                    {comparison.duplicateHatNos.length} tekrarlanan hat numarası tespit edildi
                  </p>
                  <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
                    Bu hatlar faturada birden fazla kez görünüyor; son kayıt esas alındı:{' '}
                    {comparison.duplicateHatNos.join(', ')}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
              <KpiCard
                title={t('summary.totalLines')}
                value={(comparison.summary?.totalLines ?? 0).toLocaleString('tr-TR')}
                icon={FileText}
                variant="default"
              />
              <KpiCard
                title={t('summary.totalAmount')}
                value={formatCurrency(parseResult.totalInvoiceAmount ?? comparison.summary?.totalInvoiceAmount ?? 0)}
                icon={DollarSign}
                variant="info"
              />
              <KpiCard
                title={t('summary.matched')}
                value={(comparison.summary?.matchedCount ?? 0).toLocaleString('tr-TR')}
                icon={CheckCircle2}
                variant="success"
              />
              <KpiCard
                title={t('summary.invoiceOnly')}
                value={(comparison.summary?.invoiceOnlyCount ?? 0).toLocaleString('tr-TR')}
                icon={AlertCircle}
                variant="error"
              />
              <KpiCard
                title={t('summary.costIncreaseCount')}
                value={(comparison.summary?.costIncreaseCount ?? 0).toLocaleString('tr-TR')}
                icon={Activity}
                variant="warning"
              />
              <KpiCard
                title={t('summary.estimatedProfitLoss')}
                value={formatCurrency(comparison.summary?.totalProfit ?? 0)}
                icon={TrendingUp}
                variant={(comparison.summary?.totalProfit ?? 0) >= 0 ? 'success' : 'error'}
              />
            </div>

            <InvoiceAlertsPanel
              invoiceOnly={comparison.invoiceOnly}
              costIncreaseLines={comparison.matched.filter((m) => m.isCostIncrease)}
              lossLines={comparison.matched.filter((m) => m.isLoss)}
              inventoryOnly={comparison.inventoryOnly}
            />

            <InvoiceTariffChart tariffBreakdown={comparison.tariffBreakdown} />

            <InvoiceResultTabs
              matched={comparison.matched}
              invoiceOnly={comparison.invoiceOnly}
              inventoryOnly={comparison.inventoryOnly}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
}
