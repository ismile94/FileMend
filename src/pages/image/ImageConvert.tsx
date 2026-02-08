import { useState, useCallback } from 'react';
import { Move, Download } from 'lucide-react';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { useDragDrop } from '@/hooks/useDragDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useImage } from '@/hooks/useImage';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob } from '@/utils/fileHelpers';
import { IMAGE_FORMATS } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';

export const ImageConvert = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState('png');
  const { convertImage, processing, progress } = useImage();
  const { toast } = useToast();

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const imageFile = Array.from(fileList).find(
      f => f.type.startsWith('image/') || 
           ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some(ext => 
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
    
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(imageFile);
  }, [toast]);

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setOutputFormat('png');
  };

  const handleConvert = async () => {
    if (!file) return;

    try {
      const blob = await convertImage(file, outputFormat, 0.9);
      
      const outputName = file.name.replace(/\.[^/.]+$/, `.${outputFormat}`);
      downloadBlob(blob, outputName);
      
      toast({
        title: t.messages.success,
        description: t.imageConvert.imageConverted,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.imageConvert.convertError,
        variant: 'destructive',
      });
    }
  };

  const { isDragging, handleDragOver, handleDragLeave, handleDrop, handleFileInput } = useDragDrop({
    onFilesDrop: handleFilesDrop,
    accept: 'image/*',
    multiple: false,
  });

  return (
    <PDFPageLayout
      variant="image"
      title={t.imageConvert.title}
      description={t.imageConvert.description}
      icon={Move}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        <PDFDropzone
          variant="image"
          inputId="image-convert-input"
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
            {preview && (
              <div className="mb-6">
                <Label className="mb-2 block">{t.imageConvert.preview}</Label>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="mb-6">
              <Label htmlFor="format" className="text-base font-medium mb-2 block">
                {t.imageConvert.outputFormat}
              </Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.imageConvert.selectFormat} />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_FORMATS.map((format) => (
                    <SelectItem key={format.extension} value={format.extension}>
                      {format.format} (.{format.extension})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {processing && (
              <div className="mb-6">
                <ProgressBar progress={progress} label={t.imageConvert.converting} />
              </div>
            )}

            <Button
              onClick={handleConvert}
              disabled={processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                t.imageConvert.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.imageConvert.convertAndDownload}
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
