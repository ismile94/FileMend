import { useState, useCallback } from 'react';
import { RotateCw, Download, FileText, Redo2, Undo2 } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { usePDF } from '@/hooks/usePDF';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type RotationDegree = 90 | 180 | 270;

export const PDFRotate = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<RotationDegree>(90);
  const [isDragOver, setIsDragOver] = useState(false);
  const { rotatePDF, processing, progress } = usePDF();
  const { toast } = useToast();

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const pdfFile = Array.from(fileList).find(
      f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    );

    if (!pdfFile) {
      toast({
        title: t.messages.error,
        description: `${t.messages.pleaseUpload} ${t.messages.pdfFile} ${t.messages.fileUpload}`,
        variant: 'destructive',
      });
      return;
    }

    setFile(pdfFile);
  }, [toast]);

  const handleClear = () => {
    setFile(null);
    setRotation(90);
  };

  const handleRotate = async () => {
    if (!file) return;

    try {
      const blob = await rotatePDF(file, rotation);
      downloadBlob(blob, t.additional.rotatedFile);
      toast({
        title: t.messages.success,
        description: `PDF ${t.messages.fileRotated}`,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.additional.fileRotateError,
        variant: 'destructive',
      });
    }
  };

  const rotationOptions: { value: RotationDegree; label: string; icon: React.ElementType }[] = [
    { value: 90, label: t.pdfRotate.clockwise90, icon: Redo2 },
    { value: 180, label: t.pdfRotate.degrees180, icon: RotateCw },
    { value: 270, label: t.pdfRotate.counterClockwise90, icon: Undo2 },
  ];

  return (
    <PDFPageLayout
      title={t.pdfRotate.title}
      description={t.pdfRotate.description}
      icon={RotateCw}
      maxWidth="max-w-4xl"
      centerHeader={false}
    >
      {!file ? (
        <PDFDropzone
          inputId="pdf-rotate-input"
          dropText={t.pdfToWord.dropText}
          dropSubtext={t.dropzone.singleFile}
          isDragOver={isDragOver}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files.length > 0) handleFilesDrop(e.dataTransfer.files);
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onFileInput={(e) => e.target.files && e.target.files.length > 0 && handleFilesDrop(e.target.files)}
          accept=".pdf"
          multiple={false}
        />
      ) : (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6 p-3 bg-muted rounded-lg">
              <FileText className="w-8 h-8 text-sky-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground shrink-0">
                {t.dropzone.clear}
              </Button>
            </div>

            <div className="mb-6">
              <Label className="text-base font-medium mb-4 block">{t.pdfRotate.rotationAngle}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {rotationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRotation(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      rotation === option.value
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20'
                        : 'border-muted hover:border-muted-foreground/50 hover:bg-muted'
                    )}
                  >
                    <option.icon className="w-8 h-8" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {processing && (
              <div className="mb-6">
                <ProgressBar progress={progress} label={t.pdfRotate.rotating} />
              </div>
            )}

            <Button
              onClick={handleRotate}
              disabled={processing}
              className="w-full bg-sky-600 hover:bg-sky-700"
              size="lg"
            >
              {processing ? (
                t.pdfRotate.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.pdfRotate.rotateAndDownload}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </PDFPageLayout>
  );
};
