import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Menu,
  FileText,
  Music,
  Image,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Language } from '@/locales';
import logoSrc from '@/assets/FileMend_logo.png';

type CategoryId = 'pdf' | 'audio' | 'image';

interface CategoryItem {
  id: CategoryId;
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  bg: string;
  border: string;
  children: { title: string; path: string }[];
}

export const Navigation = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, language, setLanguage } = useTranslation();
  const homeCategory = location.pathname === '/' ? (searchParams.get('category') || 'pdf') : null;

  const categories: CategoryItem[] = [
    {
      id: 'pdf',
      label: 'PDF',
      icon: FileText,
      path: '/pdf',
      color: 'text-red-500',
      bg: 'bg-red-50',
      border: 'border-red-200',
      children: [
        { title: t.nav.pdfEdit, path: '/pdf/edit' },
        { title: t.nav.pdfSplit, path: '/pdf/split' },
        { title: t.nav.pdfCompress, path: '/pdf/compress' },
      ],
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: Music,
      path: '/audio',
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      children: [
        { title: t.nav.audioConvert, path: '/audio/convert' },
        { title: t.nav.audioTrim, path: '/audio/trim' },
        { title: t.nav.audioMerge, path: '/audio/merge' },
      ],
    },
    {
      id: 'image',
      label: 'Image',
      icon: Image,
      path: '/image',
      color: 'text-green-500',
      bg: 'bg-green-50',
      border: 'border-green-200',
      children: [
        { title: t.nav.imageCompress, path: '/image/compress' },
        { title: t.nav.imageConvert, path: '/image/convert' },
        { title: t.nav.imageResize, path: '/image/resize' },
        { title: t.nav.imageRotate, path: '/image/rotate' },
      ],
    },
  ];

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const isCategoryActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-50 w-full transition-all duration-300 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-5">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between">
        {/* Logo - masaüstü ve mobil header'da */}
        <Link to="/" className="flex items-center group shrink-0">
          <img src={logoSrc} alt="FileMend" className="h-[2.25rem] w-auto max-w-[140px] object-contain" />
        </Link>

        {/* Desktop: PDF, Audio, Image (renkli), About */}
        <nav className="hidden md:flex items-center gap-1">
          {categories.map((cat) => (
            <DropdownMenu key={cat.path}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    isCategoryActive(cat.path)
                      ? `${cat.bg} ${cat.color}`
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to={`/?category=${cat.id}`} className="cursor-pointer">
                    {t.nav.home ?? 'Anasayfa'}
                  </Link>
                </DropdownMenuItem>
                {cat.children.map((child) => (
                  <DropdownMenuItem key={child.path} asChild>
                    <Link
                      to={child.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'cursor-pointer',
                        location.pathname === child.path && 'bg-accent'
                      )}
                    >
                      {child.title}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          <div className="w-px h-6 bg-border mx-2" />
          <Link
            to="/about"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            About
          </Link>
        </nav>

        {/* Dil butonu: masaüstünde ve mobilde (hamburgerin solunda) */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="text-sm font-medium">{t.language.flags[language]}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleLanguageChange('tr')}
                className={cn(
                  'cursor-pointer flex items-center gap-2',
                  language === 'tr' && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <span className="text-lg">{t.language.flags.tr}</span>
                {t.language.turkish}
                {language === 'tr' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleLanguageChange('en')}
                className={cn(
                  'cursor-pointer flex items-center gap-2',
                  language === 'en' && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <span className="text-lg">{t.language.flags.en}</span>
                {t.language.english}
                {language === 'en' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleLanguageChange('pt')}
                className={cn(
                  'cursor-pointer flex items-center gap-2',
                  language === 'pt' && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                <span className="text-lg">{t.language.flags.pt}</span>
                {t.language.portuguese}
                {language === 'pt' && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]" hideCloseButton>
              <div className="flex flex-col gap-4 mt-8">
                <nav className="flex flex-col gap-1">
                  {categories.map((cat) => (
                    <Link
                      key={cat.path}
                      to={`/?category=${cat.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        homeCategory === cat.id ? `${cat.bg} ${cat.color}` : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <cat.icon className="w-5 h-5" />
                      {cat.label}
                    </Link>
                  ))}
                  <Link
                    to="/about"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    About
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
