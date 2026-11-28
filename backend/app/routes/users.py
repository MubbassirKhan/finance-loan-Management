"""API endpoints for Police Personnel Membership operations."""
from pathlib import Path
import re
from datetime import date
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.connection import get_db
from app.dependencies.auth import get_current_admin, require_password_changed
from app.models.admin import Admin
from app.models.document import Document
from app.models.enums import DocTypeEnum
from app.models.user import User
from app.schemas.user import (
    DocumentResponse,
    UserCreate,
    UserResponse,
    UserDetailResponse,
    UserListResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.schemas.membership_fee import (
    MembershipFeeCreate,
    MembershipFeeStatusUpdate,
    MembershipFeeUpdate,
    MembershipFeeResponse,
)
from app.schemas.membership_record import MembershipRecordResponse
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Members & Personnel"])


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register New Member",
    description="Registers a police personnel member with assigned Police Station and Fee Tier.",
)
def register_member(
    payload: UserCreate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Register police personnel member."""
    user_obj, err = user_service.create_member(db, payload)
    if not user_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Return formatted profile with masked bank account
    profile = user_service.get_member_by_kgid(db, user_obj.kgid)
    return profile


@router.get(
    "",
    response_model=UserListResponse,
    summary="List Members",
    description="Lists police personnel members with pagination, status filter, and multi-field search.",
)
def list_members(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by KGID, name, buckle number, or station"),
    ps_id: Optional[int] = Query(None, description="Filter by Police Station ID"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Retired, etc.)"),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve members list."""
    clean_page = page if isinstance(page, int) else 1
    clean_size = size if isinstance(size, int) else 20
    clean_search = search if isinstance(search, str) else None
    clean_ps_id = ps_id if isinstance(ps_id, int) else None
    clean_status = status if isinstance(status, str) else None

    items, total = user_service.get_members(
        db=db,
        page=clean_page,
        size=clean_size,
        search=clean_search,
        ps_id=clean_ps_id,
        status=clean_status,
    )
    return UserListResponse(
        items=[UserResponse(**item) for item in items],
        total=total,
        page=clean_page,
        size=clean_size,
    )


@router.get(
    "/kgid-availability",
    summary="Check KGID Availability",
)
def check_kgid_availability(
    kgid: str = Query(..., min_length=1, max_length=50),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return {"available": user_service.is_kgid_available(db, kgid)}


@router.get(
    "/field-availability",
    summary="Check Member Identifier Availability",
)
def check_member_field_availability(
    field: Literal["share_number", "buckle_number"] = Query(...),
    value: str = Query(..., min_length=1, max_length=50),
    exclude_kgid: Optional[str] = Query(None, max_length=50),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return {
        "available": user_service.is_member_field_available(
            db,
            field,
            value,
            exclude_kgid=exclude_kgid,
        )
    }


@router.get(
    "/membership-fees",
    response_model=List[MembershipFeeResponse],
    summary="List Membership Fee Tiers",
    description="Returns available configurable fee tiers for member registration.",
)
def get_fee_tiers(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List fee tiers."""
    fees = user_service.list_membership_fees(db)
    return fees


@router.put(
    "/{kgid}",
    response_model=UserDetailResponse,
    summary="Update Member",
    description="Updates member details while keeping the KGID identifier unchanged.",
)
def update_member(
    kgid: str,
    payload: UserUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    member, err = user_service.update_member(db, kgid, payload)
    if not member:
        if err == "Member not found.":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    return user_service.get_member_by_kgid(db, member.kgid)


@router.patch(
    "/{kgid}/status",
    response_model=UserResponse,
    summary="Set Member Status",
    description="Marks a member Active or Inactive without deleting their record.",
)
def update_member_status(
    kgid: str,
    payload: UserStatusUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    member = user_service.set_member_status(db, kgid, payload.status)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
    return user_service.get_member_by_kgid(db, member.kgid)


@router.post(
    "/{kgid}/documents",
    response_model=List[DocumentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload Member Documents",
    description="Uploads PDF or image attachments for a registered member.",
)
def upload_member_documents(
    kgid: str,
    files: List[UploadFile] = File(...),
    doc_type: DocTypeEnum = Form(DocTypeEnum.MEMBERSHIP),
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    member = db.get(User, kgid.strip())
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    prepared = []
    for upload in files:
        filename = Path(upload.filename or "document").name
        extension = Path(filename).suffix.lower().lstrip(".")
        if extension not in settings.extensions_list:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, JPG, JPEG, and PNG files are allowed.")
        content = upload.file.read(max_bytes + 1)
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{filename} is empty.")
        if len(content) > max_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"{filename} exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB limit.")
        prepared.append((Path(filename).suffix.lower(), content))

    upload_root = settings.upload_path.resolve()
    upload_dir = upload_root / "members"
    upload_dir.mkdir(parents=True, exist_ok=True)
    member_filename = re.sub(r"[^A-Za-z0-9]+", "_", member.full_name).strip("_") or "member"
    doc_type_name = doc_type.value.lower().replace(" ", "_")
    sequence = db.query(func.count(Document.doc_id)).filter(
        Document.kgid == member.kgid,
        Document.doc_type == doc_type,
    ).scalar() or 0
    saved_paths = []
    documents = []
    try:
        for extension, content in prepared:
            sequence += 1
            generated_name = f"{member_filename}_{doc_type_name}_{sequence}{extension}"
            stored_path = upload_dir / generated_name
            while stored_path.exists():
                sequence += 1
                generated_name = f"{member_filename}_{doc_type_name}_{sequence}{extension}"
                stored_path = upload_dir / generated_name
            stored_path.write_bytes(content)
            saved_paths.append(stored_path)
            document = Document(
                doc_type=doc_type,
                kgid=member.kgid,
                file_path=str(stored_path.relative_to(upload_root)),
                original_filename=generated_name,
                file_size_bytes=len(content),
            )
            db.add(document)
            documents.append(document)
        db.commit()
        for document in documents:
            db.refresh(document)
    except Exception:
        db.rollback()
        for stored_path in saved_paths:
            stored_path.unlink(missing_ok=True)
        raise
    return documents


@router.get(
    "/{kgid}/documents",
    response_model=List[DocumentResponse],
    summary="List Member Documents",
)
def list_member_documents(
    kgid: str,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not db.get(User, kgid.strip()):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
    return db.query(Document).filter(Document.kgid == kgid.strip()).order_by(Document.created_at.desc()).all()


@router.get(
    "/{kgid}/documents/{doc_id}/download",
    summary="Download Member Document",
)
def download_member_document(
    kgid: str,
    doc_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    document = db.get(Document, doc_id)
    if not document or document.kgid != kgid.strip():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    upload_root = settings.upload_path.resolve()
    file_path = (upload_root / document.file_path).resolve()
    try:
        file_path.relative_to(upload_root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file is missing.")
    return FileResponse(file_path, filename=document.original_filename or file_path.name)


@router.post(
    "/membership-fees",
    response_model=MembershipFeeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Membership Fee Tier",
    description="Creates a new configurable fee tier.",
)
def create_fee_tier(
    payload: MembershipFeeCreate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Create membership fee tier."""
    fee = user_service.create_membership_fee_tier(db, payload)
    return fee


@router.put(
    "/membership-fees/{mf_id}",
    response_model=MembershipFeeResponse,
    summary="Update Membership Fee Tier",
    description="Updates an existing configurable fee tier.",
)
def update_fee_tier(
    mf_id: int,
    payload: MembershipFeeUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    fee = user_service.update_membership_fee_tier(db, mf_id, payload)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership fee tier not found.",
        )
    return fee


@router.patch(
    "/membership-fees/{mf_id}/status",
    response_model=MembershipFeeResponse,
    summary="Update Membership Fee Tier Status",
    description="Activates or marks a fee tier inactive without deleting it.",
)
def update_fee_tier_status(
    mf_id: int,
    payload: MembershipFeeStatusUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    fee = user_service.update_membership_fee_tier_status(db, mf_id, payload)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership fee tier not found.",
        )
    return fee


@router.get(
    "/{kgid}/membership-records",
    response_model=List[MembershipRecordResponse],
    summary="List Member Membership History",
)
def get_membership_records(
    kgid: str,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not db.get(User, kgid.strip()):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")
    return user_service.list_membership_records(db, kgid)


@router.post(
    "/membership-records/generate",
    summary="Generate Monthly Membership Subscriptions",
)
def generate_membership_subscriptions(
    year: Optional[int] = Query(None, ge=1, le=9999),
    month: Optional[int] = Query(None, ge=1, le=12),
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    current_date = date.today()
    target_year = year or current_date.year
    target_month = month or current_date.month
    generated = user_service.generate_monthly_subscriptions(db, target_year, target_month)
    return {"year": target_year, "month": target_month, "generated": generated}


@router.get(
    "/{kgid}",
    response_model=UserDetailResponse,
    summary="Get Member Detail by KGID",
    description="Fetches complete member profile including bank details. Requires authenticated admin.",
)
def get_member(
    kgid: str,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get single member by KGID."""
    profile = user_service.get_member_by_kgid(db, kgid)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with KGID '{kgid}' was not found.",
        )
    return profile
