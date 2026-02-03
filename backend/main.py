# main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from pdf2docx import Converter
import os
import shutil
import uuid

app = FastAPI()

@app.post("/convert-pdf-to-word")
async def convert_pdf(file: UploadFile = File(...)):
    # 1. Benzersiz dosya isimleri oluştur
    job_id = str(uuid.uuid4())
    pdf_path = f"temp_{job_id}.pdf"
    docx_path = f"result_{job_id}.docx"

    # 2. Gelen PDF'i kaydet
    with open(pdf_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # 3. DİDİK DİDİK TARAMA (Dönüştürme)
        # pdf2docx; tabloları, resimleri ve paragrafları otomatik analiz eder.
        cv = Converter(pdf_path)
        cv.convert(docx_path, start=0, end=None) # Tüm sayfalar
        cv.close()

        # 4. Word dosyasını kullanıcıya gönder
        return FileResponse(
            docx_path, 
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            filename=f"{file.filename.split('.')[0]}.docx"
        )
    finally:
        # 5. İşlem bitince geçici dosyaları temizle (arka planda yapmak daha iyi olur)
        if os.path.exists(pdf_path): os.remove(pdf_path)
        # Not: docx dosyasını hemen silersek gönderim hata verebilir. 
        # Gerçek projede bir 'cleanup' task'ı eklenmeli.