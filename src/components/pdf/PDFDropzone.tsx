'use client';

import { useRef, useCallback } from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** PDF sayfalarında ortak "sürükle-bırak veya tıkla" alanı. Açık gök mavisi tema, biraz küçültülmüş. */
interface PDFDropzoneProps {
  dropText: string;
  dropSubtext?: string;
  isDragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
  inputId: string;
  className?: string;
  /** Tıklanabilir alan için ek keyboard handler (Enter/Space). */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function PDFDropzone({
  dropText,
  dropSubtext,
  isDragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInput,
  accept = '.pdf',
  multiple = false,
  inputId,
  className,
  onKeyDown,
}: PDFDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-8 sm:p-10 transition-all duration-300 cursor-pointer',
        'flex flex-col items-center justify-center gap-4 min-h-[200px] group',
        'hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 hover:shadow-lg',
        isDragOver
          ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 scale-[1.02] shadow-lg'
          : 'border-sky-300/50 dark:border-sky-700/50',
        className
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onFileInput}
        className="hidden"
      />

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-sky-500 rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
        <FileUp className="relative w-12 h-12 sm:w-14 sm:h-14 text-sky-500 dark:text-sky-400 transition-transform duration-300 group-hover:scale-110" />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-base sm:text-lg font-semibold text-foreground">
          {dropText}
        </p>
        {dropSubtext && (
          <p className="text-sm text-muted-foreground">{dropSubtext}</p>
        )}
      </div>
    </div>
  );
}
