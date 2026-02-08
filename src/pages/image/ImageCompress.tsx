import { useState, useCallback } from 'react';
import { Minimize2, Download } from 'lucide-react';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { useDragDrop } from '@/hooks/useDragDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useImage } from '@/hooks/useImage';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';

export const ImageCompress = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedPreview, setCompressedPreview] = useState<string | null>(null);
  const { compressImage, processing, progress } = useImage();
  const { toast } = useToast();

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const imageFile = Array.from(fileList).find(
      f => f.type.startsWith('image/') || 
           ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => 
             f.name.toLowerCase().endsWith(ext)
           )
    );

    if (!imageFile) {
      toast({
        title: t.messages.error,
        description: `${t.messages.pleaseUpload} ${t.messages.imageFile} ${t.messages.fileUpload}`,
        variant: 'destructive',
      });
      return;
    }

    setFile(imageFile);
    setCompressedBlob(null);
    setCompressedPreview(null);
    
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(imageFile);
  }, [toast]);

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setCompressedBlob(null);
    setCompressedPreview(null);
    setQuality(80);
  };

  const handleCompress = async () => {
    if (!file) return;

    try {
      const blob = await compressImage(file, quality / 100);
      setCompressedBlob(blob);
      
      const reader = new FileReader();
      reader.onload = () => setCompressedPreview(reader.result as string);
      reader.readAsDataURL(blob);
      
      const ext = file.name.split('.').pop() || 'jpg';
      downloadBlob(blob, `sikistirilmis.${ext}`);
      
      toast({
        title: t.messages.success,
        description: `${t.imageCompress.imagePrefix}${t.messages.fileCompressed}`,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: `${t.imageCompress.imagePrefix}${t.messages.processingError}`,
        variant: 'destructive',
      });
    }
  };

  const compressionRatio = compressedBlob && file
    ? Math.round(((file.size - compressedBlob.size) / file.size) * 100)
    : 0;

  const { isDragging, handleDragOver, handleDragLeave, handleDrop, handleFileInput } = useDragDrop({
    onFilesDrop: handleFilesDrop,
    accept: 'image/*',
    multiple: false,
  });

  return (
    <PDFPageLayout
      variant="image"
      title={t.imageCompress.title}
      description={t.imageCompress.description}
      icon={Minimize2}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        <PDFDropzone
          variant="image"
          inputId="image-compress-input"
          dropText={t.dropzone.dropTextActive}
          dropSubtext={t.dropzone.singleFile}
          isDragOver={isDragging}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(e);
          }}
          onDragOver={(e) => { e.preventDefault(); handleDragOver(e); }}
          onDragLeave={(e) => { e.preventDefault(); handleDragLeave(e); }}
          onFileInput={handleFileInput}
          accept="image/*"
          multiple={false}
        />

        {file && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClear}>
                {t.dropzone.clear}
              </Button>
            </div>
            <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Original */}
              <div>
                <Label className="mb-2 block">{t.imageCompress.original}</Label>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  {preview && (
                    <img
                      src={preview}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Compressed */}
              <div>
                <Label className="mb-2 block">{t.imageCompress.compressed}</Label>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  {compressedPreview ? (
                    <img
                      src={compressedPreview}
                      alt="Compressed"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {t.imageCompress.notCompressedYet}
                    </div>
                  )}
                </div>
                {compressedBlob && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {formatFileSize(compressedBlob.size)}
                    {t.imageCompress.reducedBy.replace('{ratio}', compressionRatio.toString())}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <Label>{t.imageCompress.qualityLabel.replace('{quality}', quality.toString())}</Label>
              </div>
              <Slider
                value={[quality]}
                onValueChange={(v) => setQuality(v[0])}
                min={10}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t.imageCompress.lowQualityNote}
              </p>
            </div>

            {processing && (
              <div className="mb-6">
                <ProgressBar progress={progress} label={t.imageCompress.compressing} />
              </div>
            )}

            <Button
              onClick={handleCompress}
              disabled={processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                t.imageCompress.processing
              ) : compressedBlob ? (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.imageCompress.compressAgainAndDownload}
                </>
              ) : (
                <>
                  <Minimize2 className="w-5 h-5 mr-2" />
                  {t.imageCompress.compressAndDownload}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </>
        )}
      </div>
    </PDFPageLayout>
  );
};
