import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle2, X, Save, HelpCircle, Download } from 'lucide-react';
import { useBulkCreateSimCards } from './hooks';
import { useCustomers } from '../customers/hooks';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Badge, Spinner, ErrorState } from '../../components/ui';
import { getErrorMessage } from '../../lib/errorHandler';

export function SimCardImportPage() {
  const { t } = useTranslation(['simCards', 'common']);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const bulkCreateMutation = useBulkCreateSimCards();
  const { data: customers } = useCustomers();

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
      } catch (error) {
        console.error('Excel parsing error:', error);
        setErrors(['Dosya okunamadı. Lütfen geçerli bir Excel dosyası yükleyin.']);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const validateAndFormatData = (rawRows) => {
    const formattedData = [];
    const validationErrors = [];

    // Map Excel headers to database fields (case-insensitive and Turkish character friendly)
    const headerMap = {
      'HAT NO': 'phone_number',
      'OPERATOR': 'operator',
      'KAPASITE': 'capacity',
      'ALICI': 'buyer_name',
      'AYLIK MALIYET': 'cost_price',
      'AYLIK SATIS FIYAT': 'sale_price',
      'STATUS': 'status',
      'DURUM': 'status',
      'NOTLAR': 'notes'
    };

    // Build buyer name → UUID lookup
    const buyerLookup = {};
    (customers || []).forEach(c => {
      buyerLookup[c.company_name.toLowerCase().trim()] = c.id;
    });

    rawRows.forEach((row, index) => {
      const rowData = {};
      const rowErrors = [];

      // Basic mapping
      Object.keys(row).forEach(key => {
        const normalizedKey = key.toUpperCase().trim();
        // Find the matching key in headerMap
        const dbKey = Object.keys(headerMap).find(k => normalizedKey.includes(k));
        if (dbKey) {
          rowData[headerMap[dbKey]] = row[key];
        }
      });

      // Validation
      if (!rowData.phone_number) {
        rowErrors.push(`Satır ${index + 1}: Hat numarası eksik.`);
      }

      // Format prices
      if (rowData.cost_price) {
        const price = parseFloat(String(rowData.cost_price).replace(/[^\d.,]/g, '').replace(',', '.'));
        rowData.cost_price = isNaN(price) ? 0 : price;
      } else {
        rowData.cost_price = 0;
      }

      if (rowData.sale_price) {
        const price = parseFloat(String(rowData.sale_price).replace(/[^\d.,]/g, '').replace(',', '.'));
        rowData.sale_price = isNaN(price) ? 0 : price;
      } else {
        rowData.sale_price = 0;
      }

      // Format operator
      if (rowData.operator) {
        const op = String(rowData.operator).toUpperCase();
        if (op.includes('TURKCELL')) rowData.operator = 'TURKCELL';
        else if (op.includes('VODAFONE')) rowData.operator = 'VODAFONE';
        else if (op.includes('TELEKOM')) rowData.operator = 'TURK_TELEKOM';
        else rowData.operator = 'TURKCELL';
      } else {
        rowData.operator = 'TURKCELL';
      }

      // Resolve buyer name to UUID
      if (rowData.buyer_name) {
        const buyerKey = String(rowData.buyer_name).toLowerCase().trim();
        rowData.buyer_id = buyerLookup[buyerKey] || null;
        if (!rowData.buyer_id) {
          rowErrors.push(`Satır ${index + 1}: Alıcı "${rowData.buyer_name}" bulunamadı.`);
        }
      }
      delete rowData.buyer_name;

      const VALID_STATUSES = ['available', 'active', 'subscription', 'cancelled'];
      const rawStatus = String(rowData.status || '').trim().toLowerCase();
      rowData.status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'available';
      rowData.currency = 'TRY';

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
      await bulkCreateMutation.mutateAsync(data);
      navigate('/sim-cards');
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  if (bulkCreateMutation.isError) {
    return (
      <PageContainer maxWidth="xl">
        <ErrorState 
          message={getErrorMessage(bulkCreateMutation.error)} 
          onRetry={() => bulkCreateMutation.reset()} 
        />
      </PageContainer>
    );
  }

  const handleReset = () => {
    setData([]);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const headers = ['HAT NO', 'OPERATOR', 'KAPASITE', 'ALICI', 'AYLIK MALIYET', 'AYLIK SATIS FIYAT', 'STATUS', 'NOTLAR'];
    const sampleRows = [
      ['+90 555 123 4567', 'TURKCELL', '100MB', 'Metbel', '50', '70', 'available', ''],
      ['+90 532 987 6543', 'VODAFONE', '1GB', '', '45', '65', 'active', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SIM Kartlar');
    XLSX.writeFile(wb, 'sim-kart-sablonu.xlsx');
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title={t('actions.import')}
        breadcrumbs={[
          { label: t('title'), to: '/sim-cards' },
          { label: t('actions.import') }
        ]}
      />

      <div className="mt-6 space-y-6">
        {data.length === 0 && !isParsing ? (
          <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50 mb-2">
              Excel Dosyası Yükleyin
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 max-w-sm">
              SIM kart listesini içeren .xlsx veya .xls dosyasını sürükleyin veya seçin.
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
                Dosya Seç
              </Button>
              <Button variant="outline" onClick={downloadTemplate} leftIcon={<Download className="w-4 h-4" />}>
                Şablon İndir
              </Button>
            </div>

            <Card className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700">
              <h4 className="font-medium text-neutral-900 dark:text-neutral-50 mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-neutral-500" />
                Excel formatı
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                İlk satırda sütun başlıkları olmalı. <strong>HAT NO</strong> zorunludur; diğerleri isteğe bağlı.
              </p>
              <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-1">
                <p><strong>HAT NO</strong> — Telefon numarası (örn: +90 555 123 4567)</p>
                <p><strong>OPERATOR</strong> — Turkcell, Vodafone veya Türk Telekom</p>
                <p><strong>KAPASITE</strong> — Örn: 100MB, 1GB</p>
                <p><strong>ALICI</strong> — Alıcı firma adı (sistemde kayıtlı müşteri adıyla eşleşmeli)</p>
                <p><strong>AYLIK MALIYET</strong> — Aylık maliyet (₺)</p>
                <p><strong>AYLIK SATIS FIYAT</strong> — Aylık satış fiyatı (₺)</p>
                <p><strong>STATUS</strong> — available, active, subscription, cancelled (boşsa: available)</p>
                <p><strong>NOTLAR</strong> — Notlar</p>
              </div>
            </Card>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">{data.length} Geçerli Satır</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-600">{errors.length} Hatalı Satır</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} leftIcon={<X className="w-4 h-4" />}>
                  Vazgeç
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleImport} 
                  loading={bulkCreateMutation.isPending}
                  leftIcon={<Save className="w-4 h-4" />}
                  disabled={data.length === 0}
                >
                  İçe Aktarımı Başlat
                </Button>
              </div>
            </div>

            {errors.length > 0 && (
              <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Hatalar
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
                      <th className="px-4 py-3 font-medium">Hat No</th>
                      <th className="px-4 py-3 font-medium">Operatör</th>
                      <th className="px-4 py-3 font-medium">Alıcı</th>
                      <th className="px-4 py-3 font-medium">Maliyet</th>
                      <th className="px-4 py-3 font-medium">Satış</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {data.slice(0, 10).map((row, i) => {
                      const buyerName = row.buyer_id
                        ? customers?.find(c => c.id === row.buyer_id)?.company_name || '-'
                        : '-';
                      return (
                        <tr key={i}>
                          <td className="px-4 py-3 font-medium">{row.phone_number}</td>
                          <td className="px-4 py-3">
                            <Badge variant="default">{row.operator}</Badge>
                          </td>
                          <td className="px-4 py-3">{buyerName}</td>
                          <td className="px-4 py-3">{row.cost_price} ₺</td>
                          <td className="px-4 py-3">{row.sale_price} ₺</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.length > 10 && (
                  <div className="p-3 text-center text-neutral-500 text-xs bg-neutral-50/50 dark:bg-neutral-800/20">
                    ... ve {data.length - 10} satır daha
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
            <p className="font-medium">Excel dosyası işleniyor...</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
