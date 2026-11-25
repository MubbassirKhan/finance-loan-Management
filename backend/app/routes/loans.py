"""API endpoints for Loan Management, Disbursements, and Transactional History."""
from pathlib import Path
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.connection import get_db
from app.dependencies.auth import get_current_admin, require_password_changed
from app.models.admin import Admin
from app.models.document import Document
from app.models.enums import DocTypeEnum
from app.models.loan import Loan
from app.models.user import User
from app.schemas.loan import (
    LoanCreate,
    LoanListResponse,
    LoanPaymentCreate,
    LoanPaymentResponse,
    LoanResponse,
    LoanUpdate,
    UserLoanHistoryResponse,
)
from app.services import loan_service

router = APIRouter(prefix="/loans", tags=["Loan Management"])


@router.post(
    "",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Disburse / Create New Loan",
    description="Creates a new loan record for an existing police personnel member.",
)
def create_loan(
    payload: LoanCreate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Create a new loan."""
    loan_obj, err = loan_service.create_loan(db, payload)
    if not loan_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    return loan_service.get_loan_by_id(db, loan_obj.loan_id)


@router.get(
    "",
    response_model=LoanListResponse,
    summary="List Loans",
    description="Lists loan records with pagination, search, station, loan type, and status filters.",
)
def list_loans(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    ps_id: Optional[int] = Query(None),
    loan_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    kgid: Optional[str] = Query(None),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve paginated loans."""
    clean_page = page if isinstance(page, int) else 1
    clean_size = size if isinstance(size, int) else 20
    clean_search = search if isinstance(search, str) else None
    clean_ps_id = ps_id if isinstance(ps_id, int) else None
    clean_loan_type = loan_type if isinstance(loan_type, str) else None
    clean_status = status if isinstance(status, str) else None
    clean_kgid = kgid if isinstance(kgid, str) else None

    items, total = loan_service.get_loans(
        db=db,
        page=clean_page,
        size=clean_size,
        search=clean_search,
        ps_id=clean_ps_id,
        loan_type=clean_loan_type,
        status=clean_status,
        kgid=clean_kgid,
    )
    return LoanListResponse(
        items=[LoanResponse(**item) for item in items],
        total=total,
        page=clean_page,
        size=clean_size,
    )


@router.get(
    "/user/{kgid}/history",
    response_model=UserLoanHistoryResponse,
    summary="Get Officer Loan & Transactional History",
    description="Returns complete officer details, all loans, and full payment transactional history.",
)
def get_user_loan_history(
    kgid: str,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve full transactional history for an officer by KGID."""
    history = loan_service.get_user_transactional_history(db, kgid)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with KGID '{kgid}' not found.",
        )
    return history


@router.get(
    "/{loan_id}",
    response_model=LoanResponse,
    summary="Get Loan Details",
)
def get_loan(
    loan_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve a single loan by ID."""
    loan = loan_service.get_loan_by_id(db, loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found.")
    return loan


@router.put(
    "/{loan_id}",
    response_model=LoanResponse,
    summary="Update Loan Record",
)
def update_loan(
    loan_id: int,
    payload: LoanUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Update loan details."""
    loan_obj, err = loan_service.update_loan(db, loan_id, payload)
    if not loan_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    return loan_service.get_loan_by_id(db, loan_obj.loan_id)


@router.post(
    "/{loan_id}/payments",
    response_model=LoanPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Loan Payment",
    description="Records a loan installment recovery and updates remaining balance.",
)
def record_payment(
    loan_id: int,
    payload: LoanPaymentCreate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Record a loan installment payment."""
    payment, err = loan_service.record_loan_payment(db, loan_id, payload)
    if not payment:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    return payment


@router.get(
    "/{loan_id}/payments",
    response_model=List[LoanPaymentResponse],
    summary="List Loan Payments",
)
def list_loan_payments(
    loan_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve payment transactions for a specific loan."""
    loan = loan_service.get_loan_by_id(db, loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found.")
    return loan_service.get_loan_payments(db, loan_id)


@router.post(
    "/{loan_id}/attachment",
    response_model=LoanResponse,
    summary="Upload Loan Attachment",
    description="Uploads a PDF or image attachment for a loan and links it to the loan record.",
)
def upload_loan_attachment(
    loan_id: int,
    file: UploadFile = File(...),
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Upload attachment for an existing loan."""
    loan = db.get(Loan, loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loan not found.")

    member = db.get(User, loan.kgid)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    filename = Path(file.filename or "loan_attachment").name
    extension = Path(filename).suffix.lower().lstrip(".")
    if extension not in settings.extensions_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, JPEG, and PNG files are allowed.",
        )

    content = file.file.read(max_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB limit.",
        )

    upload_root = settings.upload_path.resolve()
    upload_dir = upload_root / "loans"
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^A-Za-z0-9]+", "_", member.full_name if member else loan.kgid).strip("_") or "loan"
    seq = db.query(func.count(Document.doc_id)).filter(Document.kgid == loan.kgid).scalar() or 0
    seq += 1
    ext_with_dot = Path(filename).suffix.lower()
    generated_name = f"{safe_name}_loan_{loan.loan_id}_{seq}{ext_with_dot}"
    stored_path = upload_dir / generated_name
    while stored_path.exists():
        seq += 1
        generated_name = f"{safe_name}_loan_{loan.loan_id}_{seq}{ext_with_dot}"
        stored_path = upload_dir / generated_name

    stored_path.write_bytes(content)
    rel_path = str(stored_path.relative_to(upload_root))

    try:
        loan.document_attachment = rel_path
        doc = Document(
            doc_type=DocTypeEnum.LOAN_APPLICATION,
            kgid=loan.kgid,
            file_path=rel_path,
            original_filename=filename,
            file_size_bytes=len(content),
        )
        db.add(doc)
        db.commit()
    except Exception:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise

    return loan_service.get_loan_by_id(db, loan.loan_id)


@router.get(
    "/{loan_id}/attachment/download",
    summary="Download Loan Attachment",
)
def download_loan_attachment(
    loan_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Download the attached file for a loan."""
    loan = db.get(Loan, loan_id)
    if not loan or not loan.document_attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    upload_root = settings.upload_path.resolve()
    file_path = (upload_root / loan.document_attachment).resolve()
    try:
        file_path.relative_to(upload_root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found.")

    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file is missing.")

    return FileResponse(file_path, filename=file_path.name)
