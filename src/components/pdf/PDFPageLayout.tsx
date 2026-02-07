'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Proje kimliği: açık gök mavisi. Tüm PDF sayfalarında aynı arka plan ve kart yapısı. */
interface PDFPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
  /** Kart içeriğinin max genişliği (örn max-w-3xl, max-w-4xl). */
  maxWidth?: string;
  /** Header'ı merkeze al (PDFToWord gibi). Varsayılan true. */
  centerHeader?: boolean;
}

export function PDFPageLayout({
  title,
  description,
  icon: Icon,
  children,
  maxWidth = 'max-w-3xl',
  centerHeader = true,
}: PDFPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-50 dark:from-sky-950/10 dark:via-background dark:to-sky-950/10">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br from-sky-200/30 to-sky-300/30 dark:from-sky-600/10 dark:to-sky-700/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-gradient-to-tr from-sky-200/30 to-sky-300/30 dark:from-sky-600/10 dark:to-sky-700/10 rounded-full blur-3xl" />
      </div>

      <div className={cn('relative container mx-auto px-4 py-6 sm:px-6 sm:py-10', maxWidth)}>
        <div
          className={cn(
            'mb-6 sm:mb-8 space-y-4',
            centerHeader && 'text-center'
          )}
        >
          <div className={cn('inline-flex items-center justify-center gap-3 mb-2', !centerHeader && 'flex')}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl blur-lg opacity-60 animate-pulse" />
              <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl shadow-2xl">
                <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-sky-600 to-sky-600 dark:from-sky-400 dark:to-sky-500 bg-clip-text text-transparent leading-tight">
            {title}
          </h1>
          <p className={cn('text-muted-foreground text-sm sm:text-base leading-relaxed', centerHeader && 'max-w-lg mx-auto')}>
            {description}
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl blur opacity-20" />
          <div className="relative bg-white/80 dark:bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-sky-200/50 dark:border-sky-900/50 p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
