import { useState, useCallback } from 'react';
import { Image as ImageIcon, Download, Lock, Unlock } from 'lucide-react';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { useDragDrop } from '@/hooks/useDragDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useImage } from '@/hooks/useImage';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';

export const ImageResize = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const { resizeImage, processing, progress } = useImage();
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
    
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
        setWidth(img.width);
        setHeight(img.height);
      };
      img.src = reader.result as string;
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(imageFile);
  }, [toast]);

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setOriginalDimensions({ width: 0, height: 0 });
    setWidth(0);
    setHeight(0);
  };

  const handleWidthChange = (value: number) => {
    setWidth(value);
    if (maintainAspectRatio && originalDimensions.width > 0) {
      const ratio = originalDimensions.height / originalDimensions.width;
      setHeight(Math.round(value * ratio));
    }
  };

  const handleHeightChange = (value: number) => {
    setHeight(value);
    if (maintainAspectRatio && originalDimensions.height > 0) {
      const ratio = originalDimensions.width / originalDimensions.height;
      setWidth(Math.round(value * ratio));
    }
  };

  const handleResize = async () => {
    if (!file || width <= 0 || height <= 0) return;

    try {
      const blob = await resizeImage(file, width, height, maintainAspectRatio);
      const ext = file.name.split('.').pop() || 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boyutlandirilmis.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: t.messages.success,
        description: t.imageResize.imageResized,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.imageResize.resizeError,
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
      title={t.imageResize.title}
      description={t.imageResize.description}
      icon={ImageIcon}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        <PDFDropzone
          variant="image"
          inputId="image-resize-input"
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
              <div>
                <Label className="mb-2 block">{t.imageResize.originalSize}</Label>
                <p className="text-sm text-muted-foreground">
                  {originalDimensions.width} x {originalDimensions.height} {t.imageResize.pixels}
                </p>
              </div>
              {preview && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-6 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {maintainAspectRatio ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{t.imageResize.maintainAspectRatio}</span>
              </div>
              <Switch
                checked={maintainAspectRatio}
                onCheckedChange={setMaintainAspectRatio}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <Label htmlFor="width" className="mb-2 block">
                  {t.imageResize.width} ({t.imageResize.pixels})
                </Label>
                <Input
                  id="width"
                  type="number"
                  min={1}
                  value={width}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="height" className="mb-2 block">
                  {t.imageResize.height} ({t.imageResize.pixels})
                </Label>
                <Input
                  id="height"
                  type="number"
                  min={1}
                  value={height}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {processing && (
              <div className="mb-6">
                <ProgressBar progress={progress} label={t.imageResize.resizing} />
              </div>
            )}

            <Button
              onClick={handleResize}
              disabled={processing || width <= 0 || height <= 0}
              className="w-full"
              size="lg"
            >
              {processing ? (
                t.imageResize.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.imageResize.resizeAndDownload}
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
