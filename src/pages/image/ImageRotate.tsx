import { useState, useCallback } from 'react';
import { RotateCw, Download, Image as ImageIcon, Redo2, Undo2 } from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useImage } from '@/hooks/useImage';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/utils/fileHelpers';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';

type RotationDegree = 90 | 180 | 270;

export const ImageRotate = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState<RotationDegree>(90);
  const { rotateImage, processing, progress } = useImage();
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
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(imageFile);
  }, [toast]);

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setRotation(90);
  };

  const handleRotate = async () => {
    if (!file) return;

    try {
      const blob = await rotateImage(file, rotation);
      const ext = file.name.split('.').pop() || 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dondurulmus.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: t.messages.success,
        description: t.imageRotate.imageRotated,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.imageRotate.rotateError,
        variant: 'destructive',
      });
    }
  };

  const rotationOptions: { value: RotationDegree; label: string; icon: React.ElementType }[] = [
    { value: 90, label: t.imageRotate.clockwise90, icon: Redo2 },
    { value: 180, label: t.imageRotate.degrees180, icon: RotateCw },
    { value: 270, label: t.imageRotate.counterClockwise90, icon: Undo2 },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="p-2 bg-green-500 rounded-lg">
            <RotateCw className="w-6 h-6 text-white" />
          </div>
          {t.imageRotate.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t.imageRotate.description}
        </p>
      </div>

      <FileDropzone
        onFilesDrop={handleFilesDrop}
        onClear={handleClear}
        accept="image/*"
        multiple={false}
        selectedFiles={file ? [file] : []}
      />

      {file && (
        <Card className="mt-6">
          <CardContent className="p-6">
            {preview && (
              <div className="mb-6">
                <Label className="mb-2 block">{t.imageConvert.preview}</Label>
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={preview}
                    alt="Preview"
                    className={cn(
                      'max-w-full max-h-full object-contain transition-transform duration-300',
                      rotation === 90 && 'rotate-90',
                      rotation === 180 && 'rotate-180',
                      rotation === 270 && '-rotate-90'
                    )}
                  />
                </div>
              </div>
            )}

            <div className="mb-6">
              <Label className="text-base font-medium mb-4 block">{t.imageRotate.rotationAngle}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {rotationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRotation(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      rotation === option.value
                        ? 'border-primary bg-primary/5'
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
                <ProgressBar progress={progress} label={t.imageRotate.rotating} />
              </div>
            )}

            <Button
              onClick={handleRotate}
              disabled={processing}
              className="w-full"
              size="lg"
            >
              {processing ? (
                t.imageRotate.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.imageRotate.rotateAndDownload}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
