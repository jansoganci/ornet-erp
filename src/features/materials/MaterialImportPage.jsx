import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle2, X, Save, Download } from 'lucide-react';
import { useBulkUpsertMaterials } from './hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';

const HEADERS = ['Kod', 'Ad', 'Kategori', 'Birim', 'Açıklama'];

function isEmptyRow(row) {
  return Object.values(row).every(
    (val) => val == null || String(val).trim() === ''
  );
}

function downloadTemplate() {
  const wsData = [HEADERS, ['DK230', 'Optik Duman Dedektörü', 'dedektor', 'adet', 'Duman algılama için kullanılır']];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Malzemeler');
  XLSX.writeFile(wb, 'malzeme-icerik-sablonu.xlsx');
}

export function MaterialImportPage() {
  const { t } = useTranslation(['materials', 'common']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const bulkUpsertMutation = useBulkUpsertMaterials();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        validateAndFormatData(jsonData);
      } catch {
        setErrors([t('materials:import.parse')]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const validateAndFormatData = (rawRows) => {
    const formattedData = [];
    const validationErrors = [];

    rawRows.forEach((row, index) => {
      if (isEmptyRow(row)) return;

      const code = row['Kod'] != null ? String(row['Kod']).trim() : '';
      const name = row['Ad'] != null ? String(row['Ad']).trim() : '';
      const category = row['Kategori'] != null ? String(row['Kategori']).trim() : '';
      const unit = row['Birim'] != null ? String(row['Birim']).trim() || 'adet' : 'adet';
      const description = row['Açıklama'] != null ? String(row['Açıklama']).trim() : '';

      if (!code) {
        validationErrors.push(t('materials:import.missingCode', { row: index + 1 }));
        return;
      }
      if (!name) {
        validationErrors.push(t('materials:import.missingName', { row: index + 1 }));
        return;
      }

      formattedData.push({
        code,
        name,
        category: category || null,
        unit: unit || 'adet',
        description: description || null,
        is_active: true,
      });
    });

    setData(formattedData);
    setErrors(validationErrors);
  };

  const handleImport = async () => {
    if (data.length === 0) return;

    try {
      await bulkUpsertMutation.mutateAsync(data);
      navigate('/materials');
    } catch {
      // error handled by mutation onError
    }
  };

  if (bulkUpsertMutation.isError) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState 
          message={getErrorMessage(bulkUpsertMutation.error)} 
          onRetry={() => bulkUpsertMutation.reset()} 
        />
      </PageContainer>
    );
  }

  const handleReset = () => {
    setData([]);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title={t('materials:import.title')}
        breadcrumbs={[
          { label: t('materials:title'), to: '/materials' },
          { label: t('materials:import.title') },
        ]}
      />

      <div className="mt-6 space-y-6">
        {data.length === 0 && !isParsing ? (
          <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-2">
              {t('materials:import.uploadTitle')}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
              {t('materials:import.uploadHint')}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={downloadTemplate}
              >
                {t('materials:import.downloadTemplate')}
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                {t('materials:import.selectFile')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">
                    {data.length} {t('materials:import.validRows')}
                  </span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-600">
                      {errors.length} {t('materials:import.invalidRows')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  {t('materials:import.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  loading={bulkUpsertMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={data.length === 0}
                >
                  {t('materials:import.startImport')}
                </Button>
              </div>
            </div>

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t('materials:import.errors')}
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
                      <th className="px-4 py-3 font-medium">Kod</th>
                      <th className="px-4 py-3 font-medium">Ad</th>
                      <th className="px-4 py-3 font-medium">Kategori</th>
                      <th className="px-4 py-3 font-medium">Birim</th>
                      <th className="px-4 py-3 font-medium">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {data.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium">{row.code}</td>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.category || '-'}</td>
                        <td className="px-4 py-3">{row.unit}</td>
                        <td className="px-4 py-3 max-w-xs truncate" title={row.description || ''}>
                          {row.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 10 && (
                  <div className="p-3 text-center text-neutral-500 text-xs bg-neutral-50/50 dark:bg-neutral-800/20">
                    {t('materials:import.moreRows', { count: data.length - 10 })}
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
            <p className="font-medium">{t('materials:import.processing')}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
