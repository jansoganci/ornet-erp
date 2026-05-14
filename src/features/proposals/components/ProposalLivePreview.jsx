import { useEffect, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ProposalPdf } from './ProposalPdf';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { resolveProposalPdfPublicImage } from '../../../lib/resolvePdfImage';

function mapWatchedToProposal(watchedValues) {
  if (!watchedValues) return {};
  const { items, sections, annual_fixed_costs, has_vat, has_tevkifat, discount_percent, vat_rate, ...proposalFields } =
    watchedValues;
  return proposalFields;
}

export function ProposalLivePreview({
  watchedValues = {},
  customerCompanyName = '',
  className,
  tevkifatNumerator = 9,
  tevkifatDenominator = 10,
  /** 'modal' = fill parent height (live preview dialog); 'inline' = review step column */
  variant = 'inline',
}) {
  const { t } = useTranslation('proposals');

  const [logoSrc, setLogoSrc] = useState(null);
  const [certSrc, setCertSrc] = useState(null);

  useEffect(() => {
    Promise.all([
      resolveProposalPdfPublicImage('ornet.logo.png'),
      resolveProposalPdfPublicImage('falan.png'),
    ]).then(([logo, cert]) => {
      setLogoSrc(logo);
      setCertSrc(cert);
    });
  }, []);

  const proposal = mapWatchedToProposal(watchedValues);
  const items = watchedValues.items ?? [];
  const sections = watchedValues.sections ?? [];
  const annualFixedCosts = watchedValues.annual_fixed_costs ?? [];

  const isModal = variant === 'modal';

  return (
    <div
      className={cn(
        'flex flex-col min-h-0',
        isModal && 'flex-1 h-full',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 mb-3 shrink-0',
          isModal && 'sr-only'
        )}
      >
        <FileText className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
          {t('form.preview.title')}
        </h3>
      </div>

      <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white">
        <PDFViewer
          style={{
            width: '100%',
            height: '100%',
            minHeight: isModal ? 0 : 500,
            border: 'none',
          }}
        >
          <ProposalPdf
            proposal={proposal}
            items={items}
            sections={sections}
            annualFixedCosts={annualFixedCosts}
            logoSrc={logoSrc}
            certSrc={certSrc}
            tevkifatNumerator={tevkifatNumerator}
            tevkifatDenominator={tevkifatDenominator}
          />
        </PDFViewer>
      </div>
    </div>
  );
}
