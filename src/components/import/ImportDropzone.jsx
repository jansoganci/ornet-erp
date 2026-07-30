import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, Download } from 'lucide-react';
import { Card, Button } from '../ui';
import { cn } from '../../lib/utils';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} props.accept — e.g. ".xlsx,.xls" or ".pdf,.csv,.xml"
 * @param {(file: File) => void} props.onFile — called with the selected/dropped File
 * @param {string} props.selectLabel
 * @param {string} [props.templateLabel] — omit together with onDownloadTemplate to hide the template button
 * @param {() => void} [props.onDownloadTemplate]
 * @param {string} [props.className]
 */
export function ImportDropzone({
  title,
  description,
  accept,
  onFile,
  selectLabel,
  templateLabel,
  onDownloadTemplate,
  className,
}) {
  const { t } = useTranslation('common');
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className={cn('max-w-lg mx-auto', className)}>
      <Card
        className={cn(
          'p-10 border-2 border-dashed flex flex-col items-center justify-center text-center transition-colors',
          isDragOver
            ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
            : 'border-neutral-300 dark:border-neutral-700'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-neutral-500 dark:text-neutral-400 mb-1 text-sm">
            {description}
          </p>
        )}
        <p className="text-neutral-400 dark:text-neutral-500 mb-6 text-xs">
          {t('import.dropHint')}
        </p>
        <input
          type="file"
          accept={accept}
          className="hidden"
          ref={fileInputRef}
          onChange={handleChange}
        />
        <div className="flex flex-wrap justify-center gap-3">
          {templateLabel && onDownloadTemplate && (
            <Button
              variant="outline"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={onDownloadTemplate}
            >
              {templateLabel}
            </Button>
          )}
          <Button
            leftIcon={<UploadCloud className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
