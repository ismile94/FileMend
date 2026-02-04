import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/Layout';
import { Home } from '@/pages/Home';
import { PDFEdit } from '@/pages/pdf/PDFEdit';
import { PDFSplit } from '@/pages/pdf/PDFSplit';
import { PDFCompress } from '@/pages/pdf/PDFCompress';
import { PDFRotate } from '@/pages/pdf/PDFRotate';
import { PDFtoWord } from '@/pages/pdf/PDFToWord';
import { AudioConvert } from '@/pages/audio/AudioConvert';
import { AudioTrim } from '@/pages/audio/AudioTrim';
import { AudioMerge } from '@/pages/audio/AudioMerge';
import { ImageCompress } from '@/pages/image/ImageCompress';
import { ImageConvert } from '@/pages/image/ImageConvert';
import { ImageResize } from '@/pages/image/ImageResize';
import { ImageRotate } from '@/pages/image/ImageRotate';
import { LanguageProvider } from '@/contexts/LanguageContext';
import './App.css';

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="pdf">
              <Route path="edit" element={<PDFEdit />} />
              <Route path="split" element={<PDFSplit />} />
              <Route path="compress" element={<PDFCompress />} />
              <Route path="rotate" element={<PDFRotate />} />
              <Route path="to-word" element={<PDFtoWord />} />
            </Route>
            <Route path="audio">
              <Route path="convert" element={<AudioConvert />} />
              <Route path="trim" element={<AudioTrim />} />
              <Route path="merge" element={<AudioMerge />} />
            </Route>
            <Route path="image">
              <Route path="compress" element={<ImageCompress />} />
              <Route path="convert" element={<ImageConvert />} />
              <Route path="resize" element={<ImageResize />} />
              <Route path="rotate" element={<ImageRotate />} />
            </Route>
          </Route>
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
