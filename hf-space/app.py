# app.py - Hugging Face Spaces için PDF to Word API
# Hugging Face Spaces'te 0.0.0.0:7860 üzerinde çalışır
import os
import shutil
import uuid
import tempfile
import logging
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime, timedelta
from enum import Enum

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import pikepdf

from adobe.pdfservices.operation.auth.service_principal_credentials import ServicePrincipalCredentials
from adobe.pdfservices.operation.exception.exceptions import ServiceApiException, ServiceUsageException, SdkException
from adobe.pdfservices.operation.pdf_services import PDFServices
from adobe.pdfservices.operation.pdf_services_media_type import PDFServicesMediaType
from adobe.pdfservices.operation.pdfjobs.jobs.export_pdf_job import ExportPDFJob
from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_params import ExportPDFParams
from adobe.pdfservices.operation.pdfjobs.params.export_pdf.export_pdf_target_format import ExportPDFTargetFormat
from adobe.pdfservices.operation.pdfjobs.result.export_pdf_result import ExportPDFResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF to Word Converter", version="3.0.0")

# CORS - Hugging Face ve tüm kaynaklardan gelen isteklere izin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PDF_SERVICES_CLIENT_ID = os.getenv("PDF_SERVICES_CLIENT_ID")
PDF_SERVICES_CLIENT_SECRET = os.getenv("PDF_SERVICES_CLIENT_SECRET")


# ==================== JOB STATUS TRACKING ====================

class JobStatus(str, Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"


class JobInfo(BaseModel):
    job_id: str
    status: JobStatus
    progress: int
    message: str
    filename: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


jobs_db: Dict[str, JobInfo] = {}
JOB_RETENTION_HOURS = 1


def update_job_status(
    job_id: str,
    status: JobStatus,
    progress: int,
    message: str,
    filename: Optional[str] = None,
    error: Optional[str] = None,
):
    if job_id in jobs_db:
        jobs_db[job_id].status = status
        jobs_db[job_id].progress = progress
        jobs_db[job_id].message = message
        jobs_db[job_id].updated_at = datetime.now()
        if filename:
            jobs_db[job_id].filename = filename
        if error:
            jobs_db[job_id].error = error
        logger.info(f"[job:{job_id}] {status.value} - {progress}% - {message}")


def cleanup_old_jobs():
    cutoff_time = datetime.now() - timedelta(hours=JOB_RETENTION_HOURS)
    to_delete = [job_id for job_id, job in jobs_db.items() if job.updated_at < cutoff_time]
    for job_id in to_delete:
        del jobs_db[job_id]
        logger.info(f"[cleanup] Silindi: {job_id}")


# ==================== HELPER FUNCTIONS ====================

def get_pdf_services() -> PDFServices:
    if not PDF_SERVICES_CLIENT_ID or not PDF_SERVICES_CLIENT_SECRET:
        raise ValueError("Adobe PDF Services credentials bulunamadı. Hugging Face Secrets'a PDF_SERVICES_CLIENT_ID ve PDF_SERVICES_CLIENT_SECRET ekleyin.")
    credentials = ServicePrincipalCredentials(
        client_id=PDF_SERVICES_CLIENT_ID,
        client_secret=PDF_SERVICES_CLIENT_SECRET
    )
    return PDFServices(credentials=credentials)


def remove_pdf_restrictions(input_path: str, output_path: str) -> bool:
    try:
        pdf = pikepdf.open(input_path, allow_overwriting_input=False)
        if pdf.is_encrypted:
            pdf.save(output_path)
            pdf.close()
            return True
        pdf.close()
        shutil.copy(input_path, output_path)
        return False
    except pikepdf.PasswordError:
        raise HTTPException(status_code=400, detail="Bu PDF şifreli. Lütfen şifresiz bir PDF yükleyin.")
    except Exception as e:
        logger.error(f"[pdf] pikepdf hatası: {e}")
        shutil.copy(input_path, output_path)
        return False


def cleanup_files(*file_paths: str) -> None:
    for file_path in file_paths:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"[cleanup] Silindi: {file_path}")
        except OSError as e:
            logger.error(f"[cleanup] Hata: {e}")


# ==================== BACKGROUND JOB PROCESSOR ====================

def process_conversion_job(
    job_id: str,
    file_path: str,
    file_clean_path: str,
    output_path: str,
    original_filename: str,
):
    try:
        update_job_status(job_id, JobStatus.UPLOADING, 20, "PDF hazırlanıyor...")
        was_encrypted = remove_pdf_restrictions(file_path, file_clean_path)
        if was_encrypted:
            logger.info(f"[job:{job_id}] PDF kısıtlamaları kaldırıldı")

        update_job_status(job_id, JobStatus.PROCESSING, 30, "Adobe AI'ya bağlanılıyor...")
        pdf_services = get_pdf_services()

        update_job_status(job_id, JobStatus.PROCESSING, 40, "PDF yükleniyor...")
        with open(file_clean_path, "rb") as pdf_file:
            input_asset = pdf_services.upload(
                input_stream=pdf_file,
                mime_type=PDFServicesMediaType.PDF
            )
        logger.info(f"[job:{job_id}] PDF Adobe'ye yüklendi")

        update_job_status(job_id, JobStatus.PROCESSING, 50, "Word formatına dönüştürülüyor...")
        export_pdf_params = ExportPDFParams(target_format=ExportPDFTargetFormat.DOCX)
        export_pdf_job = ExportPDFJob(
            input_asset=input_asset,
            export_pdf_params=export_pdf_params
        )

        update_job_status(job_id, JobStatus.PROCESSING, 60, "Adobe AI işliyor...")
        location = pdf_services.submit(export_pdf_job)

        update_job_status(job_id, JobStatus.PROCESSING, 80, "Dönüştürme tamamlanıyor...")
        pdf_services_response = pdf_services.get_job_result(location, ExportPDFResult)

        update_job_status(job_id, JobStatus.DOWNLOADING, 90, "Word dosyası indiriliyor...")
        result_asset = pdf_services_response.get_result().get_asset()
        stream_asset = pdf_services.get_content(result_asset)

        with open(output_path, "wb") as docx_file:
            docx_file.write(stream_asset.get_input_stream())

        logger.info(f"[job:{job_id}] DOCX oluşturuldu: {output_path}")

        output_filename = f"{os.path.splitext(original_filename)[0]}.docx"
        update_job_status(job_id, JobStatus.COMPLETED, 100, "Dönüştürme tamamlandı!", filename=output_filename)

    except HTTPException as e:
        update_job_status(job_id, JobStatus.FAILED, 0, "Hata oluştu", error=e.detail)
        cleanup_files(file_path, file_clean_path, output_path)
        raise

    except ValueError as e:
        update_job_status(job_id, JobStatus.FAILED, 0, "Konfigürasyon hatası", error=str(e))
        cleanup_files(file_path, file_clean_path, output_path)

    except ServiceApiException as e:
        error_msg = "Bu PDF şifreli. Lütfen şifresiz bir PDF yükleyin." if "PDF_ENCRYPTED" in str(e) else str(e)
        update_job_status(job_id, JobStatus.FAILED, 0, "API hatası", error=error_msg)
        cleanup_files(file_path, file_clean_path, output_path)

    except ServiceUsageException as e:
        update_job_status(job_id, JobStatus.FAILED, 0, "Limit aşıldı", error="Aylık dönüşüm limiti aşıldı.")
        cleanup_files(file_path, file_clean_path, output_path)

    except Exception as e:
        update_job_status(job_id, JobStatus.FAILED, 0, "Sistem hatası", error=str(e))
        cleanup_files(file_path, file_clean_path, output_path)


# ==================== API ENDPOINTS ====================

@app.get("/health")
async def health_check():
    cleanup_old_jobs()
    return {
        "status": "healthy",
        "version": "3.0.0",
        "engine": "Adobe PDF Services",
        "credentials_configured": bool(PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET),
        "active_jobs": len(jobs_db),
    }


@app.post("/convert/start")
async def start_conversion(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir PDF dosyası yükleyin.")

    job_id = str(uuid.uuid4())
    tmp_dir = tempfile.gettempdir()
    pdf_path = os.path.join(tmp_dir, f"temp_{job_id}.pdf")
    pdf_clean_path = os.path.join(tmp_dir, f"clean_{job_id}.pdf")
    docx_path = os.path.join(tmp_dir, f"result_{job_id}.docx")

    try:
        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"[convert] PDF kaydedildi: {file.filename} -> {pdf_path}")

        jobs_db[job_id] = JobInfo(
            job_id=job_id,
            status=JobStatus.PENDING,
            progress=0,
            message="İşlem başlatıldı",
            filename=file.filename,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        background_tasks.add_task(
            process_conversion_job,
            job_id,
            pdf_path,
            pdf_clean_path,
            docx_path,
            file.filename,
        )

        return {"job_id": job_id, "status": "started"}

    except Exception as e:
        cleanup_files(pdf_path, pdf_clean_path, docx_path)
        logger.error(f"[convert] Başlatma hatası: {e}")
        raise HTTPException(status_code=500, detail=f"İşlem başlatılamadı: {str(e)}")


@app.get("/convert/status/{job_id}")
async def get_conversion_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    job = jobs_db[job_id]
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "filename": job.filename,
        "error": job.error,
    }


@app.get("/convert/download/{job_id}")
async def download_result(background_tasks: BackgroundTasks, job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job bulunamadı")
    job = jobs_db[job_id]
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Job henüz tamamlanmadı. Durum: {job.status}")

    tmp_dir = tempfile.gettempdir()
    docx_path = os.path.join(tmp_dir, f"result_{job_id}.docx")

    if not os.path.exists(docx_path):
        raise HTTPException(status_code=404, detail="Dönüştürülmüş dosya bulunamadı")

    pdf_path = os.path.join(tmp_dir, f"temp_{job_id}.pdf")
    pdf_clean_path = os.path.join(tmp_dir, f"clean_{job_id}.pdf")
    background_tasks.add_task(cleanup_files, pdf_path, pdf_clean_path, docx_path)
    background_tasks.add_task(lambda: jobs_db.pop(job_id, None))

    return FileResponse(
        docx_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=job.filename or "converted.docx",
    )
