import { useState, useCallback, useRef } from 'react';
import { Merge, ArrowUp, ArrowDown, Trash2, Download, FileText } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePDF } from '@/hooks/usePDF';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';

export const PDFMerge = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { mergePDFs, processing, progress } = usePDF();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const pdfFiles = Array.from(fileList).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );
    
    if (pdfFiles.length === 0) {
      toast({
        title: t.messages.error,
        description: t.pdfMerge.onlyPdfFiles,
        variant: 'destructive',
      });
      return;
    }

    setFiles(prev => [...prev, ...pdfFiles]);
  }, [toast]);

  const handleClear = () => {
    setFiles([]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (direction === 'up' && index > 0) {
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
      } else if (direction === 'down' && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      }
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: t.messages.error,
        description: t.pdfMerge.minFilesError,
        variant: 'destructive',
      });
      return;
    }

    try {
      const blob = await mergePDFs(files);
      downloadBlob(blob, 'birlesik.pdf');
      toast({
        title: t.messages.success,
        description: t.pdfMerge.filesMerged,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.pdfMerge.mergeError,
        variant: 'destructive',
      });
    }
  };

  return (
    <PDFPageLayout
      title={t.pdfMerge.title}
      description={t.pdfMerge.description}
      icon={Merge}
      maxWidth="max-w-4xl"
      centerHeader={false}
    >
      {files.length === 0 ? (
        <PDFDropzone
          inputId="pdf-merge-input"
          dropText={t.pdfToWord.dropText}
          dropSubtext={t.dropzone.multipleFiles}
          isDragOver={isDragOver}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files.length > 0) handleFilesDrop(e.dataTransfer.files);
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onFileInput={(e) => e.target.files && handleFilesDrop(e.target.files)}
          accept=".pdf"
          multiple
        />
      ) : (
        <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFilesDrop(e.target.files)}
      />
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <h3 className="font-semibold">{t.pdfMerge.sorting}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {t.pdfMerge.filesCount.replace('{count}', files.length.toString())}
                </span>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-sky-600 border-sky-200 hover:bg-sky-50">
                  {t.pdfCompress.addFile}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
                  {t.dropzone.clear}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <FileText className="w-5 h-5 text-sky-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveFile(index, 'up')}
                      disabled={index === 0}
                      className="h-8 w-8"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveFile(index, 'down')}
                      disabled={index === files.length - 1}
                      className="h-8 w-8"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {processing && (
              <div className="mt-6">
                <ProgressBar progress={progress} label={t.pdfMerge.merging} />
              </div>
            )}

            <Button
              onClick={handleMerge}
              disabled={processing || files.length < 2}
              className="w-full mt-6 bg-sky-600 hover:bg-sky-700"
              size="lg"
            >
              {processing ? (
                t.pdfMerge.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.pdfMerge.mergeAndDownload}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </>
      )}
    </PDFPageLayout>
  );
};
