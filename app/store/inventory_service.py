from sqlalchemy.orm import Session
from sqlalchemy import func

from app.store import models as store_models



from sqlalchemy import func


from sqlalchemy.orm import Session
from sqlalchemy import func

from app.store import models as store_models


# ==========================================================
# CALCULATE AVAILABLE STOCK
# ==========================================================

def calculate_available_stock(
    db: Session,
    business_id: int,
    item_id: int,
):
    """
    Calculate the actual current available store stock.

    Stock sources are:

        Remaining Purchase Stock
      + Remaining Opening Stock
      + Remaining Stock From Negative Adjustments

    Positive adjustments are stock removals, therefore they
    are NOT counted as stock.

    IMPORTANT:
    Purchase/opening quantities are already reduced by FIFO
    deductions, so we must NOT subtract adjustment totals
    again here.
    """

    # ------------------------------------------------------
    # REMAINING PURCHASE STOCK
    # ------------------------------------------------------

    purchased_stock = (
        db.query(
            func.coalesce(
                func.sum(
                    store_models.StoreStockEntry.quantity
                ),
                0,
            )
        )
        .filter(
            store_models.StoreStockEntry.business_id
            == business_id,

            store_models.StoreStockEntry.item_id
            == item_id,

            store_models.StoreStockEntry.quantity
            > 0,
        )
        .scalar()
        or 0
    )

    # ------------------------------------------------------
    # REMAINING OPENING STOCK
    # ------------------------------------------------------

    opening_stock = (
        db.query(
            func.coalesce(
                func.sum(
                    store_models.StoreInventory.quantity
                ),
                0,
            )
        )
        .filter(
            store_models.StoreInventory.business_id
            == business_id,

            store_models.StoreInventory.item_id
            == item_id,

            store_models.StoreInventory.quantity
            > 0,
        )
        .scalar()
        or 0
    )

    # ------------------------------------------------------
    # REMAINING NEGATIVE ADJUSTMENT STOCK
    #
    # Negative adjustment:
    #
    #     -20 = add 20 stock
    #
    # remaining_quantity represents the unused portion
    # of that added stock.
    # ------------------------------------------------------

    adjustment_stock = (
        db.query(
            func.coalesce(
                func.sum(
                    store_models.StoreInventoryAdjustment
                    .remaining_quantity
                ),
                0,
            )
        )
        .filter(
            store_models.StoreInventoryAdjustment.business_id
            == business_id,

            store_models.StoreInventoryAdjustment.item_id
            == item_id,

            store_models.StoreInventoryAdjustment.quantity_adjusted
            < 0,

            store_models.StoreInventoryAdjustment.remaining_quantity
            > 0,
        )
        .scalar()
        or 0
    )

    available = (
        float(purchased_stock)
        + float(opening_stock)
        + float(adjustment_stock)
    )

    return max(available, 0)




# ==========================================================
# DEDUCT FIFO STOCK
# ==========================================================

def deduct_fifo_stock(
    db: Session,
    business_id: int,
    item_id: int,
    quantity: float,
):
    """
    Deduct store stock using FIFO.

    Stock sources:

    1. Purchase batches
    2. Negative stock adjustments
    3. Opening stock

    Positive adjustments are NOT stock sources.
    """

    remaining = float(quantity)

    if remaining <= 0:
        return

    # ======================================================
    # 1. PURCHASE STOCK
    # ======================================================

    purchases = (
        db.query(
            store_models.StoreStockEntry
        )
        .filter(
            store_models.StoreStockEntry.business_id
            == business_id,

            store_models.StoreStockEntry.item_id
            == item_id,

            store_models.StoreStockEntry.quantity
            > 0,
        )
        .order_by(
            store_models.StoreStockEntry.purchase_date.asc(),
            store_models.StoreStockEntry.id.asc(),
        )
        .all()
    )

    for purchase in purchases:

        if remaining <= 0:
            break

        available = float(
            purchase.quantity or 0
        )

        if available <= 0:
            continue

        deduct = min(
            available,
            remaining,
        )

        purchase.quantity -= deduct

        if purchase.quantity < 0:
            purchase.quantity = 0

        remaining -= deduct

        db.add(purchase)

    # ======================================================
    # 2. NEGATIVE ADJUSTMENT STOCK
    #
    # Example:
    #
    # quantity_adjusted = -20
    #
    # means 20 units were added to stock.
    #
    # remaining_quantity = unused portion of those 20.
    # ======================================================

    if remaining > 0:

        adjustments = (
            db.query(
                store_models.StoreInventoryAdjustment
            )
            .filter(
                store_models.StoreInventoryAdjustment.business_id
                == business_id,

                store_models.StoreInventoryAdjustment.item_id
                == item_id,

                store_models.StoreInventoryAdjustment.quantity_adjusted
                < 0,

                store_models.StoreInventoryAdjustment.remaining_quantity
                > 0,
            )
            .order_by(
                store_models.StoreInventoryAdjustment.adjusted_at.asc(),
                store_models.StoreInventoryAdjustment.id.asc(),
            )
            .all()
        )

        for adjustment in adjustments:

            if remaining <= 0:
                break

            available = float(
                adjustment.remaining_quantity or 0
            )

            if available <= 0:
                continue

            deduct = min(
                available,
                remaining,
            )

            adjustment.remaining_quantity -= deduct

            if (
                adjustment.remaining_quantity
                < 0
            ):
                adjustment.remaining_quantity = 0

            remaining -= deduct

            db.add(adjustment)

    # ======================================================
    # 3. OPENING STOCK
    # ======================================================

    if remaining > 0:

        openings = (
            db.query(
                store_models.StoreInventory
            )
            .filter(
                store_models.StoreInventory.business_id
                == business_id,

                store_models.StoreInventory.item_id
                == item_id,

                store_models.StoreInventory.quantity
                > 0,
            )
            .order_by(
                store_models.StoreInventory.id.asc()
            )
            .all()
        )

        for opening in openings:

            if remaining <= 0:
                break

            available = float(
                opening.quantity or 0
            )

            if available <= 0:
                continue

            deduct = min(
                available,
                remaining,
            )

            opening.quantity -= deduct

            if opening.quantity < 0:
                opening.quantity = 0

            remaining -= deduct

            db.add(opening)

    # ======================================================
    # FINAL SAFETY CHECK
    # ======================================================

    if remaining > 0:

        raise ValueError(
            f"Unable to deduct {quantity}. "
            f"{remaining} units could not be deducted."
        )

    

        
def restore_fifo_stock(
    db: Session,
    business_id: int,
    item_id: int,
    quantity: float,
):
    """
    Restore stock in the reverse order:
    1. Negative adjustments
    2. Purchases
    3. Opening stock
    """

    remaining = quantity

    # -----------------------------------
    # Restore adjustment stock
    # -----------------------------------
    adjustments = (
        db.query(store_models.StoreInventoryAdjustment)
        .filter(
            store_models.StoreInventoryAdjustment.business_id == business_id,
            store_models.StoreInventoryAdjustment.item_id == item_id,
            store_models.StoreInventoryAdjustment.quantity_adjusted < 0,
        )
        .order_by(
            store_models.StoreInventoryAdjustment.adjusted_at.asc(),
            store_models.StoreInventoryAdjustment.id.asc(),
        )
        .all()
    )

    for adj in adjustments:

        if remaining <= 0:
            break

        original_added = abs(adj.quantity_adjusted)

        available_space = original_added - adj.remaining_quantity

        if available_space <= 0:
            continue

        restore = min(available_space, remaining)

        adj.remaining_quantity += restore
        remaining -= restore

    # -----------------------------------
    # Restore purchase stock
    # -----------------------------------
    if remaining > 0:

        purchases = (
            db.query(store_models.StoreStockEntry)
            .filter(
                store_models.StoreStockEntry.business_id == business_id,
                store_models.StoreStockEntry.item_id == item_id,
            )
            .order_by(
                store_models.StoreStockEntry.purchase_date.asc(),
                store_models.StoreStockEntry.id.asc(),
            )
            .all()
        )

        for purchase in purchases:

            if remaining <= 0:
                break

            purchase.quantity += remaining
            remaining = 0

    # -----------------------------------
    # Restore opening stock
    # -----------------------------------
    if remaining > 0:

        inventories = (
            db.query(store_models.StoreInventory)
            .filter(
                store_models.StoreInventory.business_id == business_id,
                store_models.StoreInventory.item_id == item_id,
            )
            .all()
        )

        for inventory in inventories:

            if remaining <= 0:
                break

            inventory.quantity += remaining
            remaining = 0


def increase_bar_inventory(
    db: Session,
    business_id: int,
    bar_id: int,
    item,
    quantity: float,
):
    """
    Increase bar inventory after an issue.
    """

    



def reset_purchase_inventory(
    db: Session,
    business_id: int,
):
    """
    Restore every purchase batch to its original quantity.
    """

    purchases = (
        db.query(store_models.StoreStockEntry)
        .filter(
            store_models.StoreStockEntry.business_id == business_id
        )
        .all()
    )

    for purchase in purchases:
        purchase.quantity = purchase.original_quantity



def reset_opening_inventory(
    db: Session,
    business_id: int,
):
    """
    Restore every opening stock item.
    """

    inventories = (
        db.query(store_models.StoreInventory)
        .filter(
            store_models.StoreInventory.business_id == business_id
        )
        .all()
    )

    for inv in inventories:
        inv.quantity = inv.opening_quantity


# ==========================================================
# REPLAY STORE ADJUSTMENTS
# ==========================================================

def replay_store_adjustments(
    db: Session,
    business_id: int,
):
    """
    Replay all stock adjustments chronologically.

    Positive adjustment:
        Removes stock.

    Negative adjustment:
        Adds stock and becomes available FIFO stock.
    """

    adjustments = (
        db.query(
            store_models.StoreInventoryAdjustment
        )
        .filter(
            store_models.StoreInventoryAdjustment.business_id
            == business_id
        )
        .order_by(
            store_models.StoreInventoryAdjustment.adjusted_at.asc(),
            store_models.StoreInventoryAdjustment.id.asc(),
        )
        .all()
    )

    for adjustment in adjustments:

        quantity = float(
            adjustment.quantity_adjusted or 0
        )

        # --------------------------------------------------
        # POSITIVE = REMOVE STOCK
        # --------------------------------------------------

        if quantity > 0:

            deduct_fifo_stock(
                db=db,
                business_id=business_id,
                item_id=adjustment.item_id,
                quantity=quantity,
            )

            adjustment.remaining_quantity = 0

        # --------------------------------------------------
        # NEGATIVE = ADD STOCK
        #
        # The stock was already reset by
        # reset_adjustment_inventory().
        # --------------------------------------------------

        elif quantity < 0:

            adjustment.remaining_quantity = abs(
                quantity
            )

        # --------------------------------------------------
        # ZERO
        # --------------------------------------------------

        else:

            adjustment.remaining_quantity = 0

        db.add(adjustment)

        db.flush()




# ==========================================================
# RESET STOCK ADJUSTMENTS
# ==========================================================

def reset_adjustment_inventory(
    db: Session,
    business_id: int,
):
    """
    Reset adjustment stock before rebuilding inventory.

    Positive adjustment:
        +20 = remove 20 stock
        remaining stock = 0

    Negative adjustment:
        -20 = add 20 stock
        remaining stock = 20
    """

    adjustments = (
        db.query(
            store_models.StoreInventoryAdjustment
        )
        .filter(
            store_models.StoreInventoryAdjustment.business_id
            == business_id
        )
        .all()
    )

    for adjustment in adjustments:

        quantity_adjusted = float(
            adjustment.quantity_adjusted or 0
        )

        if quantity_adjusted < 0:

            adjustment.remaining_quantity = abs(
                quantity_adjusted
            )

        else:

            adjustment.remaining_quantity = 0

        db.add(adjustment)

    db.flush()



# ==========================================================
# REPLAY STORE ISSUES
# ==========================================================

def replay_store_issues(
    db: Session,
    business_id: int,
):
    """
    Replay every store issue chronologically.

    The database is queried fresh so the edited issue and
    its newly-created issue items are used.
    """

    issues = (
        db.query(
            store_models.StoreIssue
        )
        .filter(
            store_models.StoreIssue.business_id
            == business_id
        )
        .order_by(
            store_models.StoreIssue.issue_date.asc(),
            store_models.StoreIssue.id.asc(),
        )
        .all()
    )

    for issue in issues:

        # ----------------------------------------------
        # Ensure issue items are loaded from DB
        # ----------------------------------------------

        issue_items = (
            db.query(
                store_models.StoreIssueItem
            )
            .filter(
                store_models.StoreIssueItem.issue_id
                == issue.id,

                store_models.StoreIssueItem.business_id
                == business_id,
            )
            .order_by(
                store_models.StoreIssueItem.id.asc()
            )
            .all()
        )

        for issue_item in issue_items:

            deduct_fifo_stock(
                db=db,
                business_id=business_id,
                item_id=issue_item.item_id,
                quantity=issue_item.quantity,
            )

        db.flush()




# ==========================================================
# REBUILD STORE INVENTORY
# ==========================================================

def rebuild_store_inventory(
    db: Session,
    business_id: int,
):
    """
    Completely rebuild store inventory from the original
    stock sources.

    Rebuild order:

        1. Restore purchases
        2. Restore opening stock
        3. Reset adjustment stock
        4. Replay adjustments
        5. Replay all issues

    This makes UPDATE and DELETE operations safe because
    the inventory is reconstructed from the transaction
    history instead of trying to manually reverse FIFO.
    """

    # ======================================================
    # 1. RESTORE PURCHASES
    # ======================================================

    reset_purchase_inventory(
        db=db,
        business_id=business_id,
    )

    # ======================================================
    # 2. RESTORE OPENING STOCK
    # ======================================================

    reset_opening_inventory(
        db=db,
        business_id=business_id,
    )

    # ======================================================
    # 3. RESET ADJUSTMENTS
    #
    # THIS WAS MISSING FROM YOUR CURRENT REBUILD.
    # ======================================================

    reset_adjustment_inventory(
        db=db,
        business_id=business_id,
    )

    # ======================================================
    # 4. REPLAY ADJUSTMENTS
    # ======================================================

    replay_store_adjustments(
        db=db,
        business_id=business_id,
    )

    # ======================================================
    # 5. REPLAY ISSUES
    # ======================================================

    replay_store_issues(
        db=db,
        business_id=business_id,
    )

    db.flush()

    



def rebuild_everything(
    db: Session,
    business_id: int,
):
    """
    Complete inventory rebuild.

    Safe after any
    UPDATE
    DELETE
    IMPORT
    ADJUSTMENT
    """

    rebuild_store_inventory(
        db,
        business_id,
    )

    