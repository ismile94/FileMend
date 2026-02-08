"""
PDF Compression API Service
FastAPI backend for intelligent PDF compression
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
import logging
from typing import Optional
from PIL import Image
import fitz  # PyMuPDF
import tempfile
import os

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI App
app = FastAPI(
    title="PDF Compress API",
    description="Intelligent PDF compression with hybrid text/image optimization",
    version="1.0.0"
)

# CORS - Vercel deployment için
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://*.hf.space",
        "https://filemend.com",
        "https://www.filemend.com",
        "http://filemend.com",
        "http://www.filemend.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def compress_image(image_bytes: bytes, quality: int, scale: float = 1.0) -> bytes:
    """Compress image with given quality and scale"""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # RGB'ye çevir (RGBA varsa)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Scale uygula
        if scale != 1.0:
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # JPEG olarak sıkıştır
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Image compression error: {e}")
        return image_bytes


def analyze_page_content(page) -> dict:
    """Analyze page to determine if it's text-heavy or image-heavy"""
    try:
        text = page.get_text()
        text_length = len(text.strip())
        
        # Görsel sayısı
        image_list = page.get_images()
        image_count = len(image_list)
        
        # Sayfa boyutu
        rect = page.rect
        page_area = rect.width * rect.height
        
        # Basit sınıflandırma: 
        # - Eğer 100'den fazla karakter varsa ve görsel yoksa -> text-heavy
        # - Eğer görsel varsa -> image-heavy
        is_text_heavy = text_length > 100 and image_count == 0
        
        return {
            'is_text_heavy': is_text_heavy,
            'text_length': text_length,
            'image_count': image_count
        }
    except Exception as e:
        logger.error(f"Page analysis error: {e}")
        return {'is_text_heavy': False, 'text_length': 0, 'image_count': 0}


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "PDF Compress API",
        "version": "1.0.0"
    }


@app.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium")
):
    """
    Compress PDF file with intelligent hybrid approach
    
    Parameters:
    - file: PDF file to compress
    - level: Compression level (low/medium/extreme)
    """
    
    # Compression settings
    settings = {
        'low': {'quality': 85, 'scale': 1.0, 'min_compression': 3},
        'medium': {'quality': 65, 'scale': 1.0, 'min_compression': 5},
        'extreme': {'quality': 45, 'scale': 0.85, 'min_compression': 10}
    }
    
    if level not in settings:
        level = 'medium'
    
    config = settings[level]
    
    try:
        # PDF'i oku
        pdf_bytes = await file.read()
        original_size = len(pdf_bytes)
        
        # Temporary file oluştur
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_input:
            tmp_input.write(pdf_bytes)
            tmp_input_path = tmp_input.name
        
        # PyMuPDF ile aç
        pdf_document = fitz.open(tmp_input_path)
        
        # Yeni PDF oluştur
        output_pdf_path = tempfile.mktemp(suffix='.pdf')
        output_pdf = fitz.open()
        
        text_heavy_count = 0
        image_heavy_count = 0
        
        # Her sayfayı işle
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            analysis = analyze_page_content(page)
            
            if analysis['is_text_heavy']:
                # Text-heavy: Direkt kopyala (lossless)
                text_heavy_count += 1
                output_pdf.insert_pdf(pdf_document, from_page=page_num, to_page=page_num)
            else:
                # Image-heavy: Render edip sıkıştır
                image_heavy_count += 1
                
                # Sayfayı resme çevir
                mat = fitz.Matrix(config['scale'], config['scale'])
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img_bytes = pix.tobytes("jpeg", jpg_quality=config['quality'])
                
                # Yeni sayfa oluştur ve görseli ekle
                rect = page.rect
                new_page = output_pdf.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(rect, stream=img_bytes)
        
        # PDF'i kaydet
        output_pdf.save(output_pdf_path, garbage=4, deflate=True, clean=True)
        output_pdf.close()
        pdf_document.close()
        
        # Compressed PDF'i oku
        with open(output_pdf_path, 'rb') as f:
            compressed_bytes = f.read()
        
        compressed_size = len(compressed_bytes)
        compression_ratio = ((original_size - compressed_size) / original_size) * 100
        
        # Cleanup
        os.unlink(tmp_input_path)
        os.unlink(output_pdf_path)
        
        # Eğer yeterli sıkıştırma olmadıysa orijinali döndür
        if compression_ratio < config['min_compression']:
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
                    "X-Original-Size": str(original_size),
                    "X-Compressed-Size": str(original_size),
                    "X-Compression-Ratio": "0",
                    "X-Already-Optimized": "true",
                    "X-Text-Heavy-Pages": str(text_heavy_count),
                    "X-Image-Heavy-Pages": str(image_heavy_count)
                }
            )
        
        # Başarılı sıkıştırma
        return StreamingResponse(
            io.BytesIO(compressed_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
                "X-Original-Size": str(original_size),
                "X-Compressed-Size": str(compressed_size),
                "X-Compression-Ratio": f"{compression_ratio:.2f}",
                "X-Already-Optimized": "false",
                "X-Text-Heavy-Pages": str(text_heavy_count),
                "X-Image-Heavy-Pages": str(image_heavy_count),
                "X-Compression-Level": level
            }
        )
        
    except Exception as e:
        logger.error(f"Compression error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF compression failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
