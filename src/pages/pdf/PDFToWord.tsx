import { useState, useCallback } from 'react';
import { FileText, Download } from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePDFToWord } from '@/hooks/usePDFToWord';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';

function getDocxFilename(pdfName: string): string {
  const base = pdfName.replace(/\.pdf$/i, '');
  return `${base}.docx`;
}

export const PDFToWord = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const { convertToDocx, validateFile, processing, progress, stageMessage, maxFileSizeMB } = usePDFToWord();
  const { toast } = useToast();

  const handleFilesDrop = useCallback(
    (fileList: FileList) => {
      const f = Array.from(fileList).find(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (!f) {
        toast({
          title: t.messages.error,
          description: t.pdfToWord.onlyPdfFiles,
          variant: 'destructive',
        });
        return;
      }
      const err = validateFile(f);
      if (err) {
        toast({
          title: t.messages.error,
          description: err,
          variant: 'destructive',
        });
        return;
      }
      setFile(f);
    },
    [toast, t, validateFile]
  );

  const handleClear = () => setFile(null);

  const handleConvert = async () => {
    if (!file) return;
    try {
      const blob = await convertToDocx(file);
      downloadBlob(blob, getDocxFilename(file.name));
      toast({
        title: t.messages.success,
        description: t.pdfToWord.convertSuccess,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.pdfToWord.convertError,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-red-500 rounded-lg shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          {t.pdfToWord.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          {t.pdfToWord.description}
        </p>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          {t.pdfToWord.maxSize.replace('{size}', String(maxFileSizeMB))}
        </p>
      </div>

      <FileDropzone
        onFilesDrop={handleFilesDrop}
        onClear={handleClear}
        accept=".pdf"
        multiple={false}
        selectedFiles={file ? [file] : []}
      />

      {file && (
        <Card className="mt-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6 p-3 bg-muted rounded-lg">
              <FileText className="w-8 h-8 text-red-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>

            {processing && (
              <div className="mb-4 sm:mb-6">
                <ProgressBar
                  progress={progress}
                  label={stageMessage ? t.pdfToWord.stageLabel.replace('{stage}', stageMessage) : t.pdfToWord.processing}
                />
              </div>
            )}

            <Button
              onClick={handleConvert}
              disabled={processing}
              className="w-full sm:w-auto min-h-11 touch-manipulation"
              size="lg"
            >
              {processing ? (
                t.pdfToWord.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2 shrink-0" />
                  {t.pdfToWord.convertAndDownload}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
