// home.tsx
import { 
  FileText, 
  Music, 
  Image, 
  Merge, 
  Split, 
  Minimize2, 
  RotateCw,
  Scissors,
  Move,
  Shield,
  Zap,
  Lock,
  FileEdit,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type ToolCategory = 'pdf' | 'audio' | 'image';

interface Tool {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  category: ToolCategory;
}

const VALID_CATEGORIES: ToolCategory[] = ['pdf', 'audio', 'image'];

export const Home = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const initialCategory = (VALID_CATEGORIES.includes(categoryParam as ToolCategory) ? categoryParam : 'pdf') as ToolCategory;
  const [activeCategory, setActiveCategory] = useState<ToolCategory>(initialCategory);

  // URL'deki category değişince sekmeyi güncelle (örn. /?category=audio)
  useEffect(() => {
    if (VALID_CATEGORIES.includes(categoryParam as ToolCategory)) {
      setActiveCategory(categoryParam as ToolCategory);
    }
  }, [categoryParam]);
  const allTools: Tool[] = [
    // PDF Tools
    {
      title: t.home.pdfTools.edit.title,
      description: t.home.pdfTools.edit.description,
      icon: FileEdit,
      path: '/pdf/edit',
      color: 'bg-red-500',
      category: 'pdf',
    },
    {
      title: t.home.pdfTools.split.title,
      description: t.home.pdfTools.split.description,
      icon: Split,
      path: '/pdf/split',
      color: 'bg-red-500',
      category: 'pdf',
    },
    {
      title: t.home.pdfTools.compress.title,
      description: t.home.pdfTools.compress.description,
      icon: Minimize2,
      path: '/pdf/compress',
      color: 'bg-red-500',
      category: 'pdf',
    },
    {
      title: t.home.pdfTools.toWord.title,
      description: t.home.pdfTools.toWord.description,
      icon: Zap,
      path: '/pdf/to-word',
      color: 'bg-red-500',
      category: 'pdf',
    },
    // Audio Tools
    {
      title: t.home.audioTools.convert.title,
      description: t.home.audioTools.convert.description,
      icon: Music,
      path: '/audio/convert',
      color: 'bg-blue-500',
      category: 'audio',
    },
    {
      title: t.home.audioTools.trim.title,
      description: t.home.audioTools.trim.description,
      icon: Scissors,
      path: '/audio/trim',
      color: 'bg-blue-500',
      category: 'audio',
    },
    {
      title: t.home.audioTools.merge.title,
      description: t.home.audioTools.merge.description,
      icon: Merge,
      path: '/audio/merge',
      color: 'bg-blue-500',
      category: 'audio',
    },
    // Image Tools
    {
      title: t.home.imageTools.compress.title,
      description: t.home.imageTools.compress.description,
      icon: Minimize2,
      path: '/image/compress',
      color: 'bg-green-500',
      category: 'image',
    },
    {
      title: t.home.imageTools.convert.title,
      description: t.home.imageTools.convert.description,
      icon: Move,
      path: '/image/convert',
      color: 'bg-green-500',
      category: 'image',
    },
    {
      title: t.home.imageTools.resize.title,
      description: t.home.imageTools.resize.description,
      icon: Image,
      path: '/image/resize',
      color: 'bg-green-500',
      category: 'image',
    },
    {
      title: t.home.imageTools.rotate.title,
      description: t.home.imageTools.rotate.description,
      icon: RotateCw,
      path: '/image/rotate',
      color: 'bg-green-500',
      category: 'image',
    },
  ];

  const filteredTools = allTools.filter(tool => tool.category === activeCategory);

  const categories = [
    { id: 'pdf' as ToolCategory, label: 'PDF', icon: FileText, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'audio' as ToolCategory, label: 'Audio', icon: Music, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'image' as ToolCategory, label: 'Image', icon: Image, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
  ];

  const features = [
    {
      icon: Shield,
      title: t.home.features.secure.title,
      description: t.home.features.secure.description,
    },
    {
      icon: Zap,
      title: t.home.features.fast.title,
      description: t.home.features.fast.description,
    },
    {
      icon: Lock,
      title: t.home.features.private.title,
      description: t.home.features.private.description,
    },
  ];

  const currentCategory = categories.find(c => c.id === activeCategory)!;

  const themeBg = {
    pdf: 'bg-gradient-to-b from-red-50/80 via-background to-background dark:from-red-950/20 dark:via-background dark:to-background',
    audio: 'bg-gradient-to-b from-sky-50/80 via-background to-background dark:from-sky-950/20 dark:via-background dark:to-background',
    image: 'bg-gradient-to-b from-green-50/80 via-background to-background dark:from-green-950/20 dark:via-background dark:to-background',
  } as const;

  const heroBg = {
    pdf: 'bg-gradient-to-b from-red-50/60 to-background dark:from-red-950/15 dark:to-background border-red-200/30 dark:border-red-900/30',
    audio: 'bg-gradient-to-b from-sky-50/60 to-background dark:from-sky-950/15 dark:to-background border-sky-200/30 dark:border-sky-900/30',
    image: 'bg-gradient-to-b from-green-50/60 to-background dark:from-green-950/15 dark:to-background border-green-200/30 dark:border-green-900/30',
  } as const;

  return (
    <div className={cn('min-h-screen transition-colors duration-500', themeBg[activeCategory])}>
      {/* Hero Section - Layout Navigation tek header (tüm sayfalarda aynı) */}
      <section className={cn('pt-16 pb-12 lg:pt-20 lg:pb-16 border-b', heroBg[activeCategory])}>
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
              <Zap className="w-3 h-3" />
              {t.home.hero.badge}
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6">
              {t.home.hero.title}{' '}
              <span className="text-primary">{t.home.hero.titleHighlight}</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
              {t.home.hero.description}
            </p>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-8">
        <div className="container mx-auto px-4 max-w-5xl">
          
          {/* Category Tabs - Desktop için harici, mobilde zaten header'da var ama burada da olsun */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center bg-muted/50 p-1.5 rounded-xl">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? `${cat.bg} ${cat.color} shadow-sm border ${cat.border}`
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <cat.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{cat.label}</span>
                    <span className="sm:hidden">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredTools.map((tool) => (
              <Link 
                key={tool.path} 
                to={tool.path}
                className="group flex flex-row items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all hover:border-primary/50 hover:-translate-y-0.5"
              >
                <div className={cn("p-2 rounded-lg shadow-sm shrink-0", tool.color)}>
                  <tool.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm line-clamp-1">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {tool.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0" />
              </Link>
            ))}
          </div>

          {/* View All Link */}
          <div className="mt-8 text-center">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground gap-1 group">
              Browse all {currentCategory.label.toLowerCase()} tools
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 border-t bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-5 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-8 border-t bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
#            </div>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div>
              © 2026 FileMend. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};