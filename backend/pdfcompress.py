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

# CORS - Vercel deployment için (expose_headers: frontend custom header'ları okuyabilsin)
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
    expose_headers=[
        "X-Original-Size",
        "X-Compressed-Size",
        "X-Compression-Ratio",
        "X-Already-Optimized",
        "X-Text-Heavy-Pages",
        "X-Image-Heavy-Pages",
        "X-Compression-Level",
    ],
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
    """
    Sayfa içeriğini analiz et: metin alanı oranına göre text-heavy / image-heavy.
    Küçük logo + çok metin (banka ekstresi vb.) = metin ağırlıklı, kayıpsız kopyala.
    """
    try:
        rect = page.rect
        page_area = rect.width * rect.height
        if page_area <= 0:
            return {'is_text_heavy': True, 'text_length': 0, 'image_count': 0, 'text_area_ratio': 0}

        text = page.get_text()
        text_length = len(text.strip())
        image_list = page.get_images()
        image_count = len(image_list)

        # Metin bloklarının toplam alanı (bbox'lardan)
        text_area = 0.0
        try:
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                bbox = block.get("bbox")
                if bbox and len(bbox) >= 4:
                    w = max(0, bbox[2] - bbox[0])
                    h = max(0, bbox[3] - bbox[1])
                    text_area += w * h
        except Exception:
            pass

        text_area_ratio = text_area / page_area if page_area else 0

        # Metin ağırlıklı = sayfanın önemli kısmı metin (örn. %10+) VEYA uzun metin ve az/orta görsel
        # Böylece banka ekstresi (küçük logo + çok metin) kayıpsız kalır
        if text_area_ratio >= 0.10:
            is_text_heavy = True
        elif text_length > 300 and image_count <= 2:
            is_text_heavy = True
        elif text_length > 100 and image_count == 0:
            is_text_heavy = True
        else:
            is_text_heavy = False

        return {
            'is_text_heavy': is_text_heavy,
            'text_length': text_length,
            'image_count': image_count,
            'text_area_ratio': text_area_ratio,
        }
    except Exception as e:
        logger.error(f"Page analysis error: {e}")
        return {'is_text_heavy': False, 'text_length': 0, 'image_count': 0, 'text_area_ratio': 0}


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
    
    # Compression settings: Low=kalite öncelikli, Medium=dengeli, High=maksimum sıkıştırma
    settings = {
        'low': {'quality': 92, 'scale': 1.0, 'min_compression': 2},
        'medium': {'quality': 80, 'scale': 1.0, 'min_compression': 4},
        'extreme': {'quality': 55, 'scale': 0.92, 'min_compression': 8}
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
