"""
app/core/roles.py

Role Permission Groups
----------------------

This module contains reusable permission groups for DIMS.

Role names are stored in the database (roles table).
These constants are only used by the authorization layer.
"""

# ==========================================================
# SYSTEM ROLES
# (Used internally by the application)
# ==========================================================

SUPER_ADMIN = "super_admin"
ADMIN = "admin"


# ==========================================================
# ADMINISTRATION
# ==========================================================

ADMIN_ROLES = {
    SUPER_ADMIN,
    ADMIN,
}

BUSINESS_MANAGEMENT_ROLES = {
    SUPER_ADMIN,
}

USER_MANAGEMENT_ROLES = {
    SUPER_ADMIN,
    ADMIN,
}



    


# ==========================================================
# INVENTORY
# ==========================================================

WAREHOUSE_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "store",
}

PURCHASE_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "procurement",
    "accountant",
}

DISPATCH_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "store",
    "driver",
}

LOCATION_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "ops_manager",
    "camp_boss",
    "caterer",
}

ADJUSTMENT_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "store",
    "ops_manager",
}


# ==========================================================
# FINANCE
# ==========================================================

FINANCE_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "accountant",
}


# ==========================================================
# REPORTS
# ==========================================================

REPORT_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "ops_manager",
    "accountant",
    "store",
    "camp_boss",
    "viewer",
}


# ==========================================================
# VIEW INVENTORY
# ==========================================================

INVENTORY_VIEW_ROLES = {
    SUPER_ADMIN,
    ADMIN,
    "ops_manager",
    "store",
    "camp_boss",
    "caterer",
    "accountant",
    "viewer",
}