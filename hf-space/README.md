---
title: PDF Converter API
sdk: docker
emoji: 📄
colorFrom: blue
colorTo: gray
sdk_version: "3.10"
app_port: 7860
---

# PDF to Word Converter API

PDF dosyalarını Word (DOCX) formatına dönüştüren FastAPI API. Adobe PDF Services kullanır.

## API Endpoints

- `GET /health` - Sağlık kontrolü
- `POST /convert/start` - PDF yükle ve dönüştürmeyi başlat (job_id döner)
- `GET /convert/status/{job_id}` - Job durumunu sorgula
- `GET /convert/download/{job_id}` - Tamamlanan DOCX'i indir

## Secrets (Zorunlu)

Bu Space'in çalışması için Hugging Face Repository Secrets'a ekleyin:

- `PDF_SERVICES_CLIENT_ID` - Adobe PDF Services Client ID
- `PDF_SERVICES_CLIENT_SECRET` - Adobe PDF Services Client Secret
