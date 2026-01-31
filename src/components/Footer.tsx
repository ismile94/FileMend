import { Heart } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import logoSrc from '@/assets/FileMend_logo.png';

export const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <img src={logoSrc} alt="FileMend" className="h-9 w-auto object-contain" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.footer.brand.description}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.quickLinks.title}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/pdf/edit" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.nav.pdfEdit}
                </a>
              </li>
              <li>
                <a href="/audio/convert" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.quickLinks.audioConvert}
                </a>
              </li>
              <li>
                <a href="/image/compress" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.footer.quickLinks.imageCompress}
                </a>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-semibold mb-4">{t.footer.features.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t.footer.features.browserBased}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t.footer.features.privacyFocused}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t.footer.features.freeUsage}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t.footer.features.mobileFriendly}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t.footer.copyright}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            {t.footer.madeWith} <Heart className="w-4 h-4 text-red-500 fill-red-500" /> {t.footer.forYou}
          </p>
        </div>
      </div>
    </footer>
  );
};
