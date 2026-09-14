"""
Synchronization API Routes

Provides endpoints for bidirectional sync between mobile/desktop clients and cloud.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from database.models import Product, PriceList, MasterProduct, User
from api.dependencies import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])


# Pydantic schemas for sync
class SyncChange(BaseModel):
    id: str
    updated_at: str
    deleted: bool


class ProductSyncChange(SyncChange):
    list_id: str
    code: str
    name: str
    brand: Optional[str] = None
    price_usd: float
    currency: str = "USD"
    review_status: str = "pending"


class PriceListSyncChange(SyncChange):
    name: str
    file_name: str
    file_type: str
    status: str = "pending"
    product_count: int = 0


class MasterProductSyncChange(SyncChange):
    code: str
    description: str
    brand: Optional[str] = None
    base_price_usd: float
    margin_percentage: Optional[float] = None
    final_price_usd: Optional[float] = None
    review_status: str = "pending"
    source_list_id: str
    index_number: int


class SyncPushRequest(BaseModel):
    changes: List[SyncChange]


class SyncPullResponse(BaseModel):
    changes: List[SyncChange]
    timestamp: str


# Pull endpoints (client pulls changes from server)
@router.get("/pull/products", response_model=SyncPullResponse)
async def pull_products(
    since: str = Query(..., description="ISO timestamp of last sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get product changes since the specified timestamp.
    """
    try:
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    # Query products updated after 'since' timestamp
    products = db.query(Product).filter(
        Product.updated_at > since_dt
    ).all()

    changes = []
    for product in products:
        changes.append({
            "id": str(product.id),
            "list_id": str(product.list_id),
            "code": product.code,
            "name": product.name,
            "brand": product.brand,
            "price_usd": float(product.price),
            "currency": product.currency or "USD",
            "review_status": product.review_status or "pending",
            "updated_at": product.updated_at.isoformat(),
            "deleted": False,  # Add soft delete support later
        })

    return {
        "changes": changes,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/pull/lists", response_model=SyncPullResponse)
async def pull_price_lists(
    since: str = Query(..., description="ISO timestamp of last sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get price list changes since the specified timestamp.
    """
    try:
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    lists = db.query(PriceList).filter(
        PriceList.user_id == current_user.id,
        PriceList.updated_at > since_dt
    ).all()

    changes = []
    for lst in lists:
        changes.append({
            "id": str(lst.id),
            "name": lst.name,
            "file_name": lst.file_name,
            "file_type": lst.file_type,
            "status": lst.status,
            "product_count": lst.product_count or 0,
            "updated_at": lst.updated_at.isoformat(),
            "deleted": False,
        })

    return {
        "changes": changes,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/pull/master-products", response_model=SyncPullResponse)
async def pull_master_products(
    since: str = Query(..., description="ISO timestamp of last sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get master product changes since the specified timestamp.
    """
    try:
        since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    master_products = db.query(MasterProduct).filter(
        MasterProduct.user_id == current_user.id,
        MasterProduct.updated_at > since_dt
    ).all()

    changes = []
    for mp in master_products:
        changes.append({
            "id": str(mp.id),
            "code": mp.code,
            "description": mp.description,
            "brand": mp.brand,
            "base_price_usd": float(mp.base_price_usd),
            "margin_percentage": float(mp.margin_percentage) if mp.margin_percentage else None,
            "final_price_usd": float(mp.final_price_usd) if mp.final_price_usd else None,
            "review_status": mp.review_status or "pending",
            "source_list_id": str(mp.source_list_id),
            "index_number": mp.index_number,
            "updated_at": mp.updated_at.isoformat(),
            "deleted": False,
        })

    return {
        "changes": changes,
        "timestamp": datetime.utcnow().isoformat(),
    }


# Push endpoints (client pushes changes to server)
@router.post("/push/products")
async def push_products(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receive product changes from client and merge into database.
    """
    synced_count = 0

    for change in request.changes:
        try:
            # Parse change data
            product_data = ProductSyncChange(**change.dict())
            
            # Check if product exists
            existing = db.query(Product).filter(Product.id == int(product_data.id)).first()

            if product_data.deleted:
                # Handle deletion
                if existing:
                    db.delete(existing)
                    synced_count += 1
            else:
                # Handle create/update
                if existing:
                    # Update existing
                    existing.code = product_data.code
                    existing.name = product_data.name
                    existing.brand = product_data.brand
                    existing.price = product_data.price_usd
                    existing.currency = product_data.currency
                    existing.review_status = product_data.review_status
                    existing.updated_at = datetime.fromisoformat(product_data.updated_at.replace('Z', '+00:00'))
                else:
                    # Create new (if client created offline)
                    new_product = Product(
                        id=int(product_data.id),
                        list_id=int(product_data.list_id),
                        code=product_data.code,
                        name=product_data.name,
                        brand=product_data.brand,
                        price=product_data.price_usd,
                        currency=product_data.currency,
                        review_status=product_data.review_status,
                        updated_at=datetime.fromisoformat(product_data.updated_at.replace('Z', '+00:00')),
                    )
                    db.add(new_product)
                
                synced_count += 1

        except Exception as e:
            print(f"Failed to sync product {change.id}: {e}")
            continue

    db.commit()

    return {
        "success": True,
        "synced_count": synced_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/push/lists")
async def push_price_lists(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receive price list changes from client.
    """
    synced_count = 0

    for change in request.changes:
        try:
            list_data = PriceListSyncChange(**change.dict())
            existing = db.query(PriceList).filter(PriceList.id == int(list_data.id)).first()

            if list_data.deleted:
                if existing:
                    db.delete(existing)
                    synced_count += 1
            else:
                if existing:
                    existing.name = list_data.name
                    existing.file_name = list_data.file_name
                    existing.file_type = list_data.file_type
                    existing.status = list_data.status
                    existing.product_count = list_data.product_count
                    existing.updated_at = datetime.fromisoformat(list_data.updated_at.replace('Z', '+00:00'))
                else:
                    new_list = PriceList(
                        id=int(list_data.id),
                        user_id=current_user.id,
                        name=list_data.name,
                        file_name=list_data.file_name,
                        file_type=list_data.file_type,
                        status=list_data.status,
                        product_count=list_data.product_count,
                        updated_at=datetime.fromisoformat(list_data.updated_at.replace('Z', '+00:00')),
                    )
                    db.add(new_list)
                
                synced_count += 1

        except Exception as e:
            print(f"Failed to sync list {change.id}: {e}")
            continue

    db.commit()

    return {
        "success": True,
        "synced_count": synced_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/push/master-products")
async def push_master_products(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Receive master product changes from client.
    """
    synced_count = 0

    for change in request.changes:
        try:
            master_data = MasterProductSyncChange(**change.dict())
            existing = db.query(MasterProduct).filter(MasterProduct.id == int(master_data.id)).first()

            if master_data.deleted:
                if existing:
                    db.delete(existing)
                    synced_count += 1
            else:
                if existing:
                    existing.code = master_data.code
                    existing.description = master_data.description
                    existing.brand = master_data.brand
                    existing.base_price_usd = master_data.base_price_usd
                    existing.margin_percentage = master_data.margin_percentage
                    existing.final_price_usd = master_data.final_price_usd
                    existing.review_status = master_data.review_status
                    existing.index_number = master_data.index_number
                    existing.updated_at = datetime.fromisoformat(master_data.updated_at.replace('Z', '+00:00'))
                else:
                    new_master = MasterProduct(
                        id=int(master_data.id),
                        user_id=current_user.id,
                        code=master_data.code,
                        description=master_data.description,
                        brand=master_data.brand,
                        base_price_usd=master_data.base_price_usd,
                        margin_percentage=master_data.margin_percentage,
                        final_price_usd=master_data.final_price_usd,
                        review_status=master_data.review_status,
                        source_list_id=int(master_data.source_list_id),
                        index_number=master_data.index_number,
                        updated_at=datetime.fromisoformat(master_data.updated_at.replace('Z', '+00:00')),
                    )
                    db.add(new_master)
                
                synced_count += 1

        except Exception as e:
            print(f"Failed to sync master product {change.id}: {e}")
            continue

    db.commit()

    return {
        "success": True,
        "synced_count": synced_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get sync status for current user.
    """
    product_count = db.query(Product).count()
    list_count = db.query(PriceList).filter(PriceList.user_id == current_user.id).count()
    master_count = db.query(MasterProduct).filter(MasterProduct.user_id == current_user.id).count()

    return {
        "user_id": current_user.id,
        "products": product_count,
        "price_lists": list_count,
        "master_products": master_count,
        "timestamp": datetime.utcnow().isoformat(),
    }
