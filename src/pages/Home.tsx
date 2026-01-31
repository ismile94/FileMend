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
  Menu,
  X,
  Globe,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type ToolCategory = 'pdf' | 'audio' | 'image';
type Language = 'tr' | 'en' | 'pt';

interface Tool {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  color: string;
  category: ToolCategory;
}

export const Home = () => {
  const { t, language, setLanguage } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('pdf');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Scroll listener for header styling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const languages = [
    { code: 'en' as Language, label: 'English', flag: '🇺🇸' },
    { code: 'tr' as Language, label: 'Türkçe', flag: '🇹🇷' },
    { code: 'pt' as Language, label: 'Português', flag: '🇵🇹' },
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
  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Sticky ve Modern */}
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
          scrolled 
            ? "bg-background/95 backdrop-blur-md border-border shadow-sm py-3" 
            : "bg-background border-transparent py-5"
        )}
      >
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-none tracking-tight">FileMend</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    activeCategory === cat.id
                      ? `${cat.bg} ${cat.color}`
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
              <div className="w-px h-6 bg-border mx-2" />
              <Link 
                to="/about" 
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                About
              </Link>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Language Selector - Desktop */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span className="uppercase text-xs font-bold">{currentLang.code}</span>
                </button>
                
                {/* Language Dropdown */}
                {isLangMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsLangMenuOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-40 py-1 bg-popover border rounded-lg shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLangMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted transition-colors",
                            language === lang.code ? "text-foreground font-medium" : "text-muted-foreground"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </span>
                          {language === lang.code && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* CTA Button - Desktop */}
              <Button asChild size="sm" className="hidden sm:flex">
                <Link to="/pdf/edit">
                  Get Started
                </Link>
              </Button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-md border-b shadow-lg animate-in slide-in-from-top-2">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <nav className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Tools</span>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-left",
                      activeCategory === cat.id
                        ? `${cat.bg} ${cat.color}`
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <cat.icon className="w-5 h-5" />
                    {cat.label} Tools
                  </button>
                ))}
                
                <div className="h-px bg-border my-2" />
                
                <Link 
                  to="/about" 
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About Us
                </Link>
              </nav>

              {/* Mobile Language Selector */}
              <div className="pt-2 border-t">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2 block">Language</span>
                <div className="flex gap-2 px-3">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                        language === lang.code
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button asChild className="w-full mt-2">
                <Link to="/pdf/edit" onClick={() => setIsMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section - Header yüksekliği kadar boşluk bırak */}
      <section className="pt-32 pb-12 lg:pt-40 lg:pb-16 border-b bg-gradient-to-b from-muted/30 to-background">
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
            
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg" className="gap-2 px-8">
                <Link to="/pdf/edit">
                  <FileEdit className="w-4 h-4" />
                  {t.home.hero.primaryButton}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link to="/audio/convert">
                  <Music className="w-4 h-4" />
                  {t.home.hero.secondaryButton}
                </Link>
              </Button>
            </div>
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

          {/* Category Info */}
          <div className="flex items-center gap-3 mb-6">
            <div className={cn("p-2.5 rounded-xl border shadow-sm", currentCategory.bg, currentCategory.color, currentCategory.border)}>
              <currentCategory.icon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{currentCategory.label} Tools</h2>
              <p className="text-sm text-muted-foreground">
                {activeCategory === 'pdf' && "Edit, split, and optimize your documents"}
                {activeCategory === 'audio' && "Convert, trim, and merge audio files"}
                {activeCategory === 'image' && "Compress, resize, and convert images"}
              </p>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredTools.map((tool) => (
              <Link 
                key={tool.path} 
                to={tool.path}
                className="group flex flex-col p-5 rounded-xl border bg-card hover:shadow-lg transition-all hover:border-primary/50 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn("p-3 rounded-xl shadow-sm", tool.color)}>
                    <tool.icon className="w-6 h-6 text-white" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
                
                <h3 className="font-semibold mb-1.5 line-clamp-1">
                  {tool.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {tool.description}
                </p>
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