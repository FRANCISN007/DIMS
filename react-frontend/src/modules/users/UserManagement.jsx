
import React, {
  useEffect,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";

import "./UserManagement.css";
import getBaseUrl from "../../api/config";

const API_BASE_URL = getBaseUrl();

/* =========================================================
   ROLE CONSTANTS
========================================================= */

const SUPER_ADMIN_ROLE = "super_admin";
const ADMIN_ROLE = "admin";

const BASE_ROLE_OPTIONS = [
  "admin",
  "accountant",
  "store",
  "ops_manager",
  "camp_boss",
  "caterer",
  "procurement",
  "driver",
];

/* =========================================================
   USER MANAGEMENT
========================================================= */

const UserManagement = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  /* =======================================================
     CURRENT USER
  ======================================================= */

  let storedUserRaw = {};

  try {
    storedUserRaw = JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch (err) {
    console.error("Invalid stored user:", err);
    storedUserRaw = {};
  }

  

  /*
   * Support both:
   *
   * 1. {
   *    username,
   *    roles,
   *    business_id,
   *    business_name
   * }
   *
   * and:
   *
   * 2. {
   *    user: {...},
   *    business: {...},
   *    license: {...}
   * }
   */

  /* =========================================================
    NORMALIZE CURRENT USER
  ========================================================= */

  const normalizeRole = (role) => {
    if (role === null || role === undefined) {
      return "";
    }

    if (typeof role === "object") {
      role =
        role.code ??
        role.role_code ??
        role.name ??
        role.role_name ??
        role.role ??
        role.value ??
        "";
    }

    return String(role)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  };


  /* =========================================================
    READ LOCAL STORAGE
  ========================================================= */

  

  /* =========================================================
    NORMALIZE USER STRUCTURE
  ========================================================= */

  /*
    Login response can be:

    {
        user: {
          username,
          role_id,
          role_name,
          role_code
        },
        business: {...},
        license: {...}
    }

    OR localStorage may contain only:

    {
        username,
        role_id,
        role_name,
        role_code,
        business_id,
        business_name
    }
  */

  const nestedUser =
    storedUserRaw?.user &&
    typeof storedUserRaw.user === "object"
      ? storedUserRaw.user
      : null;

  const storedUser = {
    ...storedUserRaw,
    ...(nestedUser || {}),
  };


  /* =========================================================
    BUSINESS NORMALIZATION
  ========================================================= */

  if (
    !storedUser.business_id &&
    storedUserRaw?.business?.id
  ) {
    storedUser.business_id =
      storedUserRaw.business.id;
  }

  if (
    !storedUser.business_name &&
    storedUserRaw?.business?.name
  ) {
    storedUser.business_name =
      storedUserRaw.business.name;
  }


  /* =========================================================
    ROLE EXTRACTION
  ========================================================= */

  const extractRoles = (source) => {
    if (!source) {
      return [];
    }

    const roles = [];

    /*
    * 1. role_code
    *
    * Example:
    * role_code: "super_admin"
    */
    if (source.role_code) {
      roles.push(source.role_code);
    }

    /*
    * 2. role_name
    *
    * Example:
    * role_name: "Super Admin"
    */
    if (source.role_name) {
      roles.push(source.role_name);
    }

    /*
    * 3. role
    */
    if (source.role) {
      if (Array.isArray(source.role)) {
        roles.push(...source.role);
      } else {
        roles.push(source.role);
      }
    }

    /*
    * 4. roles
    */
    if (Array.isArray(source.roles)) {
      roles.push(...source.roles);
    } else if (
      typeof source.roles === "string"
    ) {
      roles.push(
        ...source.roles.split(",")
      );
    }

    /*
    * 5. user_role
    */
    if (source.user_role) {
      roles.push(source.user_role);
    }

    /*
    * 6. Nested user object
    */
    if (
      source.user &&
      typeof source.user === "object"
    ) {
      roles.push(
        ...extractRoles(source.user)
      );
    }

    /*
    * Normalize and remove duplicates
    */
    return [
      ...new Set(
        roles
          .map(normalizeRole)
          .filter(Boolean)
      ),
    ];
  };


  /* =========================================================
    CURRENT USER ROLES
  ========================================================= */

  const currentRoles =
    extractRoles(storedUser);


  /* =========================================================
    PERMISSION CHECK
  ========================================================= */

  const isSuperAdmin =
    currentRoles.includes(
      "super_admin"
    );

  const isAdmin =
    isSuperAdmin ||
    currentRoles.includes(
      "admin"
    );


  /* =========================================================
    DEBUG
  ========================================================= */

  console.log(
    "========== USER MANAGEMENT AUTH =========="
  );

  console.log(
    "RAW LOCAL STORAGE:",
    storedUserRaw
  );

  console.log(
    "NORMALIZED USER:",
    storedUser
  );

  console.log(
    "ROLE CODE:",
    storedUser?.role_code
  );

  console.log(
    "ROLE NAME:",
    storedUser?.role_name
  );

  console.log(
    "ROLE ID:",
    storedUser?.role_id
  );

  console.log(
    "BUSINESS ID:",
    storedUser?.business_id
  );

  console.log(
    "BUSINESS NAME:",
    storedUser?.business_name
  );

  console.log(
    "CURRENT ROLES:",
    currentRoles
  );

  console.log(
    "IS SUPER ADMIN:",
    isSuperAdmin
  );

  console.log(
    "IS ADMIN:",
    isAdmin
  );

  console.log(
    "=========================================="
  );

  /*
   * Super Admin can assign every role,
   * including super_admin.
   *
   * Normal Admin cannot assign super_admin.
   */
  const availableRoles = isSuperAdmin
    ? [
        ...BASE_ROLE_OPTIONS,
        SUPER_ADMIN_ROLE,
      ]
    : BASE_ROLE_OPTIONS;

  /* =======================================================
     DEBUG
  ======================================================= */

  console.log(
    "========== USER MANAGEMENT AUTH =========="
  );
  console.log(
    "Stored user:",
    storedUser
  );
  console.log(
    "Current roles:",
    currentRoles
  );
  console.log(
    "Business ID:",
    storedUser?.business_id
  );
  console.log(
    "Business Name:",
    storedUser?.business_name
  );
  console.log(
    "Is Super Admin:",
    isSuperAdmin
  );
  console.log(
    "Is Admin:",
    isAdmin
  );
  console.log(
    "=========================================="
  );

  /* =======================================================
     MAIN STATES
  ======================================================= */

  const [users, setUsers] =
    useState([]);

  const [error, setError] =
    useState("");

  const [popupMsg, setPopupMsg] =
    useState("");

  const [selectedAction, setSelectedAction] =
    useState("list");

  /* =======================================================
     USER STATES
  ======================================================= */

  const [editingUser, setEditingUser] =
    useState(null);

  const [editRoles, setEditRoles] =
    useState([]);

  const [newUsername, setNewUsername] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [newRoles, setNewRoles] =
    useState(["store"]);

  const [adminPassword, setAdminPassword] =
    useState("");

  const [newBusinessId, setNewBusinessId] =
    useState("");

  const [userToDelete, setUserToDelete] =
    useState(null);

  const [resetUser, setResetUser] =
    useState(null);

  const [resetPassword, setResetPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  /* =======================================================
     BUSINESS STATES
  ======================================================= */

  const [businesses, setBusinesses] =
    useState([]);

  const [editingBusiness, setEditingBusiness] =
    useState(null);

  const [newBusiness, setNewBusiness] =
    useState({
      name: "",
      address: "",
      phone: "",
      email: "",
      owner_username: "",
    });

  const [businessToDelete, setBusinessToDelete] =
    useState(null);

  /* =======================================================
     LICENSE STATES
  ======================================================= */

  const [licenseStatus, setLicenseStatus] =
    useState(null);

  const [newLicense, setNewLicense] =
    useState({
      license_password: "",
      key: "",
      duration_days: 365,
      business_id: "",
    });

  /* =======================================================
     POPUP
  ======================================================= */

  const showPopup = (msg) => {
    setPopupMsg(msg);

    setTimeout(() => {
      setPopupMsg("");
    }, 3000);
  };

  /* =======================================================
     ROLE TOGGLE
  ======================================================= */

  const toggleRole = (
    role,
    setter,
    currentSelectedRoles
  ) => {
    const normalizedRole =
      normalizeRole(role);

    /*
     * Normal Admin can never select
     * super_admin.
     */
    if (
      normalizedRole ===
        SUPER_ADMIN_ROLE &&
      !isSuperAdmin
    ) {
      return;
    }

    setter((previous) => {
      const current = Array.isArray(
        currentSelectedRoles
      )
        ? currentSelectedRoles
        : previous;

      if (
        current.includes(
          normalizedRole
        )
      ) {
        return current.filter(
          (item) =>
            item !== normalizedRole
        );
      }

      return [
        ...current,
        normalizedRole,
      ];
    });
  };

  /* =======================================================
     FETCH USERS
  ======================================================= */

  const fetchUsers = useCallback(
    async () => {
      if (!token) {
        return;
      }

      try {
        setError("");

        /*
         * Do not send business_only=true.
         *
         * Tenant filtering is already
         * handled by the backend.
         *
         * Super Admin receives all users.
         * Business Admin receives users
         * belonging to their business.
         */

        const res = await fetch(
          `${API_BASE_URL}/users/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const data =
          await res
            .json()
            .catch(() => []);

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Failed to load users"
          );
        }

        const userList =
          Array.isArray(data)
            ? data
            : [];

        const sortedUsers = [
          ...userList,
        ].sort((a, b) => {
          const businessA =
            Number(
              a.business_id
            ) || 0;

          const businessB =
            Number(
              b.business_id
            ) || 0;

          if (
            businessA !==
            businessB
          ) {
            return (
              businessA -
              businessB
            );
          }

          return (
            a.username || ""
          ).localeCompare(
            b.username || ""
          );
        });

        setUsers(sortedUsers);
      } catch (err) {
        console.error(
          "Fetch users error:",
          err
        );

        setError(
          err.message ||
            "Could not load users"
        );
      }
    },
    [token]
  );

  /* =======================================================
     FETCH BUSINESSES
     SUPER ADMIN ONLY
  ======================================================= */

  const fetchBusinesses =
    useCallback(async () => {
      if (
        !token ||
        !isSuperAdmin
      ) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/business/`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const data =
          await res
            .json()
            .catch(() => []);

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Failed to load businesses"
          );
        }

        const list =
          Array.isArray(data)
            ? data
            : data.businesses || [];

        const sorted = [
          ...list,
        ].sort((a, b) =>
          (
            a.name || ""
          ).localeCompare(
            b.name || ""
          )
        );

        setBusinesses(sorted);
      } catch (err) {
        console.error(
          "Fetch businesses error:",
          err
        );

        showPopup(
          err.message ||
            "Could not load businesses"
        );
      }
    }, [token, isSuperAdmin]);

  /* =======================================================
     FETCH LICENSE
     SUPER ADMIN ONLY
  ======================================================= */

  const fetchLicenseStatus =
    useCallback(async () => {
      if (
        !token ||
        !isSuperAdmin
      ) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/license/check`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Failed to load license status"
          );
        }

        setLicenseStatus(data);
      } catch (err) {
        console.error(
          "License status error:",
          err
        );

        showPopup(
          err.message ||
            "Could not load license status"
        );
      }
    }, [token, isSuperAdmin]);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (!token) {
      setError(
        "You must be logged in"
      );
      return;
    }

    if (!isAdmin) {
      return;
    }

    fetchUsers();

    if (isSuperAdmin) {
      fetchBusinesses();
      fetchLicenseStatus();
    }
  }, [
    token,
    isAdmin,
    isSuperAdmin,
    fetchUsers,
    fetchBusinesses,
    fetchLicenseStatus,
  ]);

  /* =======================================================
     EDIT USER
  ======================================================= */

  const handleEditClick = (
    user
  ) => {
    const roles =
      extractRoles(user);

    setEditingUser(user);
    setEditRoles(roles);
    setSelectedAction("update");
    setError("");
  };

  /* =======================================================
     CANCEL EDIT
  ======================================================= */

  const cancelEdit = () => {
    setEditingUser(null);
    setEditRoles([]);
    setSelectedAction("list");
  };

  /* =======================================================
     UPDATE USER
  ======================================================= */

  const submitUpdate = async (
    e
  ) => {
    e.preventDefault();

    if (!editingUser) {
      return;
    }

    if (
      editRoles.length === 0
    ) {
      showPopup(
        "Please select at least one role"
      );
      return;
    }

    if (
      !isSuperAdmin &&
      editRoles.includes(
        SUPER_ADMIN_ROLE
      )
    ) {
      showPopup(
        "You cannot assign super_admin"
      );
      return;
    }

    try {
      const payload = {
        roles: editRoles,
      };

      const res = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(
          editingUser.username
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await res
          .json()
          .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.detail ||
            "Update failed"
        );
      }

      showPopup(
        `User ${editingUser.username} updated successfully`
      );

      cancelEdit();
      fetchUsers();
    } catch (err) {
      console.error(
        "Update user error:",
        err
      );

      showPopup(
        err.message ||
          "Failed to update user"
      );
    }
  };

  /* =======================================================
     DELETE USER
  ======================================================= */

  const confirmDeleteUser = (
    username
  ) => {
    if (
      username ===
      storedUser.username
    ) {
      showPopup(
        "You cannot delete your own account"
      );
      return;
    }

    setUserToDelete(username);
  };

  const handleConfirmDelete =
    async () => {
      if (!userToDelete) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(
            userToDelete
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Delete failed"
          );
        }

        showPopup(
          `User ${userToDelete} deleted`
        );

        setUserToDelete(null);
        fetchUsers();
      } catch (err) {
        console.error(
          "Delete user error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to delete user"
        );
      }
    };

  /* =======================================================
     RESET PASSWORD
  ======================================================= */

  const submitResetPassword =
    async () => {
      if (!resetUser) {
        return;
      }

      if (!resetPassword) {
        showPopup(
          "Please enter a new password"
        );
        return;
      }

      if (
        resetPassword !==
        confirmPassword
      ) {
        showPopup(
          "Passwords do not match"
        );
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(
            resetUser.username
          )}/reset_password`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              new_password:
                resetPassword,
            }),
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Password reset failed"
          );
        }

        showPopup(
          "Password reset successful"
        );

        setResetUser(null);
        setResetPassword("");
        setConfirmPassword("");
      } catch (err) {
        console.error(
          "Reset password error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to reset password"
        );
      }
    };

  /* =======================================================
     ADD USER
  ======================================================= */

  const submitAddUser =
    async (e) => {
      e.preventDefault();

      if (!isAdmin) {
        showPopup(
          "Insufficient permissions"
        );
        return;
      }

      if (
        !newUsername.trim() ||
        !newPassword
      ) {
        showPopup(
          "Username and password are required"
        );
        return;
      }

      if (
        newRoles.length === 0
      ) {
        showPopup(
          "Please select at least one role"
        );
        return;
      }

      let businessIdPayload =
        null;

      /*
       * Super Admin may select
       * a business or create a
       * global user.
       */
      if (isSuperAdmin) {
        if (
          newBusinessId.trim()
        ) {
          const parsed =
            Number(
              newBusinessId
            );

          if (
            !Number.isInteger(
              parsed
            ) ||
            parsed <= 0
          ) {
            showPopup(
              "Invalid Business ID"
            );
            return;
          }

          businessIdPayload =
            parsed;
        }
      } else {
        /*
         * Normal Admin automatically
         * uses their own business.
         */
        const ownBusinessId =
          Number(
            storedUser.business_id
          );

        if (
          !Number.isInteger(
            ownBusinessId
          ) ||
          ownBusinessId <= 0
        ) {
          showPopup(
            "Your account is not assigned to a valid business"
          );
          return;
        }

        businessIdPayload =
          ownBusinessId;
      }

      /*
       * Business Admin requires
       * their own admin password.
       */
      if (
        !isSuperAdmin &&
        !adminPassword
      ) {
        showPopup(
          "Your admin password is required"
        );
        return;
      }

      /*
       * Normal Admin cannot create
       * a super_admin.
       */
      if (
        !isSuperAdmin &&
        newRoles.includes(
          SUPER_ADMIN_ROLE
        )
      ) {
        showPopup(
          "You cannot create a super_admin user"
        );
        return;
      }

      try {
        const payload = {
          username:
            newUsername
              .trim()
              .toLowerCase(),

          password:
            newPassword,

          roles:
            newRoles,
        };

        if (
          businessIdPayload !==
          null
        ) {
          payload.business_id =
            businessIdPayload;
        }

        if (!isSuperAdmin) {
          payload.admin_password =
            adminPassword;
        }

        const res = await fetch(
          `${API_BASE_URL}/users/register/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              payload
            ),
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "User creation failed"
          );
        }

        showPopup(
          `User "${newUsername}" created successfully`
        );

        setSelectedAction(
          "list"
        );

        setNewUsername("");
        setNewPassword("");
        setNewRoles(["store"]);
        setAdminPassword("");

        if (isSuperAdmin) {
          setNewBusinessId("");
        }

        fetchUsers();
      } catch (err) {
        console.error(
          "Create user error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to create user"
        );
      }
    };

  /* =======================================================
     CREATE BUSINESS
     SUPER ADMIN ONLY
  ======================================================= */

  const handleCreateBusiness =
    async (e) => {
      e.preventDefault();

      if (!isSuperAdmin) {
        showPopup(
          "Only Super Admin can manage businesses"
        );
        return;
      }

      if (
        !newBusiness.name.trim() ||
        !newBusiness.owner_username.trim()
      ) {
        showPopup(
          "Business name and owner username are required"
        );
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/business/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              newBusiness
            ),
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Business creation failed"
          );
        }

        showPopup(
          "Business created successfully"
        );

        setNewBusiness({
          name: "",
          address: "",
          phone: "",
          email: "",
          owner_username: "",
        });

        setSelectedAction(
          "list-businesses"
        );

        fetchBusinesses();
      } catch (err) {
        console.error(
          "Create business error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to create business"
        );
      }
    };

  /* =======================================================
     UPDATE BUSINESS
     SUPER ADMIN ONLY
  ======================================================= */

  const handleUpdateBusiness =
    async (e) => {
      e.preventDefault();

      if (
        !isSuperAdmin ||
        !editingBusiness
      ) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/business/${editingBusiness.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              editingBusiness
            ),
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Business update failed"
          );
        }

        showPopup(
          "Business updated successfully"
        );

        setEditingBusiness(null);
        setSelectedAction(
          "list-businesses"
        );

        fetchBusinesses();
        fetchUsers();
      } catch (err) {
        console.error(
          "Update business error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to update business"
        );
      }
    };

  /* =======================================================
     DELETE BUSINESS
     SUPER ADMIN ONLY
  ======================================================= */

  const handleDeleteBusiness =
    async () => {
      if (
        !isSuperAdmin ||
        businessToDelete === null
      ) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/business/${businessToDelete}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "Business deletion failed"
          );
        }

        showPopup(
          "Business deleted successfully"
        );

        setBusinessToDelete(null);

        fetchBusinesses();
        fetchUsers();
      } catch (err) {
        console.error(
          "Delete business error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to delete business"
        );
      }
    };

  /* =======================================================
     GENERATE LICENSE
     SUPER ADMIN ONLY
  ======================================================= */

  const handleGenerateLicense =
    async (e) => {
      e.preventDefault();

      if (!isSuperAdmin) {
        showPopup(
          "Only Super Admin can generate licenses"
        );
        return;
      }

      if (
        !newLicense.license_password ||
        !newLicense.key ||
        !newLicense.business_id
      ) {
        showPopup(
          "License password, key and business are required"
        );
        return;
      }

      try {
        const formData =
          new FormData();

        formData.append(
          "license_password",
          newLicense.license_password
        );

        formData.append(
          "key",
          newLicense.key
        );

        formData.append(
          "duration_days",
          String(
            newLicense.duration_days
          )
        );

        formData.append(
          "business_id",
          String(
            newLicense.business_id
          )
        );

        const res = await fetch(
          `${API_BASE_URL}/license/generate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const data =
          await res
            .json()
            .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.detail ||
              "License generation failed"
          );
        }

        showPopup(
          "License generated successfully"
        );

        setNewLicense({
          license_password: "",
          key: "",
          duration_days: 365,
          business_id: "",
        });

        setSelectedAction(
          "license-management"
        );

        fetchLicenseStatus();
        fetchBusinesses();
      } catch (err) {
        console.error(
          "Generate license error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to generate license"
        );
      }
    };

  /* =======================================================
     REFRESH
  ======================================================= */

  const refreshAll = () => {
    fetchUsers();

    if (isSuperAdmin) {
      fetchBusinesses();
      fetchLicenseStatus();
    }

    showPopup(
      "Data refreshed successfully"
    );
  };

  /* =======================================================
     ROLE DISPLAY
  ======================================================= */

  const getRoleDisplay = (
    roles
  ) => {
    const normalized = Array.isArray(
      roles
    )
      ? roles
          .map(normalizeRole)
          .filter(Boolean)
      : extractRoles({
          roles,
        });

    return normalized.length
      ? normalized.join(", ")
      : "—";
  };

  /* =======================================================
     USER IS SUPER ADMIN
  ======================================================= */

  const userIsSuperAdmin = (
    user
  ) => {
    return extractRoles(
      user
    ).includes(
      SUPER_ADMIN_ROLE
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className={`user-container small-frame ${
        isSuperAdmin
          ? "super-admin-mode"
          : ""
      }`}
    >
      {!isAdmin ? (
        <div className="access-denied">
          <h3>🚫 Access Denied</h3>

          <p>
            You do not have permission
            to manage users.
          </p>
        </div>
      ) : (
        <>
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="user-heading-row">
            <h2
              className={`user-heading ${
                isSuperAdmin
                  ? "super-admin"
                  : ""
              }`}
            >
              {isSuperAdmin
                ? "Super Admin Tools"
                : "Hotel User Management"}
            </h2>

            <div className="header-right">
              <select
                value={
                  selectedAction
                }
                onChange={(e) => {
                  const value =
                    e.target.value;

                  setSelectedAction(
                    value
                  );

                  setEditingUser(null);
                  setEditingBusiness(
                    null
                  );
                }}
              >
                <option value="list">
                  List Users
                </option>

                <option value="add">
                  Add User
                </option>

                {isSuperAdmin && (
                  <>
                    <option value="list-businesses">
                      Business Management
                    </option>

                    <option value="create-business">
                      Create Business
                    </option>

                    <option value="license-management">
                      License Management
                    </option>
                  </>
                )}
              </select>

              {isSuperAdmin && (
                <button
                  className="btn refresh"
                  onClick={
                    refreshAll
                  }
                  type="button"
                >
                  🔄 Refresh
                </button>
              )}

              {selectedAction ===
                "list" && (
                <button
                  className="close-main-button"
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dashboard/rooms/status",
                      {
                        replace: true,
                      }
                    )
                  }
                >
                  ❌
                </button>
              )}
            </div>
          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {popupMsg && (
            <div className="popup-inside success">
              {popupMsg}
            </div>
          )}

          {/* =================================================
              LIST USERS
          ================================================= */}

          {selectedAction ===
            "list" && (
            <div
              className={`user-table compact ${
                isSuperAdmin
                  ? "super-admin-table"
                  : ""
              }`}
            >
              <div
                className={`table-header ${
                  isSuperAdmin
                    ? "with-business"
                    : ""
                }`}
              >
                <div>ID</div>
                <div>Username</div>
                <div>Roles</div>

                {isSuperAdmin && (
                  <div>Business</div>
                )}

                <div>Actions</div>
              </div>

              {users.length === 0 ? (
                <div className="no-data">
                  No users found.
                </div>
              ) : (
                users.map((user) => {
                  const isSuper =
                    userIsSuperAdmin(
                      user
                    );

                  return (
                    <div
                      className={`table-row ${
                        isSuperAdmin
                          ? "with-business"
                          : ""
                      }`}
                      key={
                        user.id ??
                        user.username
                      }
                    >
                      <div>
                        {user.id}
                      </div>

                      <div>
                        {
                          user.username
                        }
                      </div>

                      <div>
                        {getRoleDisplay(
                          user.roles
                        )}
                      </div>

                      {isSuperAdmin && (
                        <div>
                          {user.business_id
                            ? user.business_name
                              ? `${user.business_name} (#${user.business_id})`
                              : `Business #${user.business_id}`
                            : "— Global —"}
                        </div>
                      )}

                      <div className="action-buttons">
                        <button
                          className="btn edit"
                          type="button"
                          onClick={() =>
                            handleEditClick(
                              user
                            )
                          }
                          disabled={
                            !isSuperAdmin &&
                            isSuper
                          }
                        >
                          ✏️ Edit
                        </button>

                        <button
                          className="btn delete"
                          type="button"
                          onClick={() =>
                            confirmDeleteUser(
                              user.username
                            )
                          }
                          disabled={
                            user.username ===
                              storedUser.username ||
                            (!isSuperAdmin &&
                              isSuper)
                          }
                        >
                          🗑️ Delete
                        </button>

                        <button
                          className="btn reset"
                          type="button"
                          onClick={() =>
                            setResetUser(
                              user
                            )
                          }
                          disabled={
                            !isSuperAdmin &&
                            isSuper
                          }
                        >
                          🔑 Reset PW
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* =================================================
              ADD USER
          ================================================= */}

          {selectedAction ===
            "add" && (
            <form
              onSubmit={
                submitAddUser
              }
              className={`edit-form compact-form ${
                isSuperAdmin
                  ? "super-admin-form"
                  : ""
              }`}
            >
              <div className="edit-header">
                <h4>
                  Add New User{" "}
                  {isSuperAdmin
                    ? "(Super Admin)"
                    : "(Business Level)"}
                </h4>
              </div>

              <label>
                Username:

                <input
                  type="text"
                  value={
                    newUsername
                  }
                  onChange={(e) =>
                    setNewUsername(
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Password:

                <input
                  type="password"
                  value={
                    newPassword
                  }
                  onChange={(e) =>
                    setNewPassword(
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              {isSuperAdmin ? (
                <label>
                  Business:

                  <select
                    value={
                      newBusinessId
                    }
                    onChange={(e) =>
                      setNewBusinessId(
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      Global / No Business
                    </option>

                    {businesses.map(
                      (business) => (
                        <option
                          key={
                            business.id
                          }
                          value={
                            business.id
                          }
                        >
                          {
                            business.name
                          }{" "}
                          — #
                          {
                            business.id
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>
              ) : (
                <label>
                  Business:

                  <input
                    type="text"
                    value={
                      storedUser.business_name ||
                      `Business #${
                        storedUser.business_id ||
                        ""
                      }`
                    }
                    readOnly
                  />
                </label>
              )}

              <label>
                Roles:
              </label>

              <div className="roles-checkboxes">
                {availableRoles.map(
                  (role) => (
                    <label
                      key={role}
                    >
                      <input
                        type="checkbox"
                        checked={newRoles.includes(
                          role
                        )}
                        onChange={() =>
                          toggleRole(
                            role,
                            setNewRoles,
                            newRoles
                          )
                        }
                      />

                      {role}
                    </label>
                  )
                )}
              </div>

              {!isSuperAdmin && (
                <label>
                  Your Admin Password
                  (required):

                  <input
                    type="password"
                    value={
                      adminPassword
                    }
                    onChange={(e) =>
                      setAdminPassword(
                        e.target.value
                      )
                    }
                    required
                    placeholder="Confirm your own admin password"
                  />
                </label>
              )}

              <div className="form-buttons">
                <button type="submit">
                  Create User
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedAction(
                      "list"
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* =================================================
              EDIT USER
          ================================================= */}

          {selectedAction ===
            "update" &&
            editingUser && (
              <form
                onSubmit={
                  submitUpdate
                }
                className="edit-form compact-form"
              >
                <div className="edit-header">
                  <h4>
                    Edit Roles:{" "}
                    {
                      editingUser.username
                    }
                  </h4>
                </div>

                <label>
                  Username:

                  <input
                    type="text"
                    value={
                      editingUser.username
                    }
                    readOnly
                  />
                </label>

                <label>
                  Business:

                  <input
                    type="text"
                    value={
                      editingUser.business_name
                        ? `${editingUser.business_name} (#${editingUser.business_id})`
                        : "— Global —"
                    }
                    readOnly
                  />
                </label>

                <label>
                  Roles:
                </label>

                <div className="roles-checkboxes">
                  {availableRoles.map(
                    (role) => (
                      <label
                        key={role}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.includes(
                            role
                          )}
                          onChange={() =>
                            toggleRole(
                              role,
                              setEditRoles,
                              editRoles
                            )
                          }
                          disabled={
                            !isSuperAdmin &&
                            role ===
                              SUPER_ADMIN_ROLE
                          }
                        />

                        {role}
                      </label>
                    )
                  )}
                </div>

                <div className="form-buttons">
                  <button type="submit">
                    Save Changes
                  </button>

                  <button
                    type="button"
                    onClick={
                      cancelEdit
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

          {/* =================================================
              RESET PASSWORD MODAL
          ================================================= */}

          {resetUser && (
            <div className="reset-password-modal">
              <div
                className="modal-overlay"
                onClick={() =>
                  setResetUser(
                    null
                  )
                }
              >
                <div
                  className="modal-content"
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >
                  <button
                    className="close-btn"
                    type="button"
                    onClick={() =>
                      setResetUser(
                        null
                      )
                    }
                  >
                    ✖
                  </button>

                  <h3>
                    Reset Password for{" "}
                    {
                      resetUser.username
                    }
                  </h3>

                  <label>
                    New Password:
                  </label>

                  <input
                    type="password"
                    value={
                      resetPassword
                    }
                    onChange={(e) =>
                      setResetPassword(
                        e.target.value
                      )
                    }
                  />

                  <label>
                    Confirm Password:
                  </label>

                  <input
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                  />

                  <div className="modal-actions">
                    <button
                      className="action-btn save"
                      type="button"
                      onClick={
                        submitResetPassword
                      }
                    >
                      ✅ Reset Password
                    </button>

                    <button
                      className="action-btn cancel"
                      type="button"
                      onClick={() =>
                        setResetUser(
                          null
                        )
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              BUSINESS MANAGEMENT
          ================================================= */}

          {isSuperAdmin &&
            selectedAction ===
              "list-businesses" && (
              <div className="business-section">
                <div className="section-header">
                  <h3>
                    Business Management
                  </h3>

                  <button
                    className="btn create"
                    type="button"
                    onClick={() =>
                      setSelectedAction(
                        "create-business"
                      )
                    }
                  >
                    + Create New Business
                  </button>
                </div>

                <div className="user-table compact super-admin-table with-business">
                  <div className="table-header with-business">
                    <div>ID</div>
                    <div>
                      Expiring Date
                    </div>
                    <div>Name</div>
                    <div>Owner</div>
                    <div>Email</div>
                    <div>License</div>
                    <div>Actions</div>
                  </div>

                  {businesses.length ===
                  0 ? (
                    <div className="no-data">
                      No businesses
                      found.
                    </div>
                  ) : (
                    businesses.map(
                      (biz) => (
                        <div
                          className="table-row with-business"
                          key={
                            biz.id
                          }
                        >
                          <div>
                            {
                              biz.id
                            }
                          </div>

                          <div>
                            {biz.expiration_date
                              ? new Date(
                                  biz.expiration_date
                                ).toLocaleDateString()
                              : "—"}
                          </div>

                          <div>
                            {
                              biz.name
                            }
                          </div>

                          <div>
                            {
                              biz.owner_username ||
                              "—"
                            }
                          </div>

                          <div>
                            {
                              biz.email ||
                              "—"
                            }
                          </div>

                          <div>
                            {biz.license_active ? (
                              <span className="status-active">
                                Yes
                              </span>
                            ) : (
                              <span className="status-expired">
                                No
                              </span>
                            )}
                          </div>

                          <div className="action-buttons">
                            <button
                              className="btn edit"
                              type="button"
                              onClick={() => {
                                setEditingBusiness(
                                  {
                                    ...biz,
                                  }
                                );

                                setSelectedAction(
                                  "edit-business"
                                );
                              }}
                            >
                              ✏️ Edit
                            </button>

                            <button
                              className="btn delete"
                              type="button"
                              onClick={() =>
                                setBusinessToDelete(
                                  biz.id
                                )
                              }
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            )}

          {/* =================================================
              CREATE BUSINESS
          ================================================= */}

          {isSuperAdmin &&
            selectedAction ===
              "create-business" && (
              <form
                onSubmit={
                  handleCreateBusiness
                }
                className="edit-form compact-form super-admin-form"
              >
                <div className="edit-header">
                  <h4>
                    Create New Business
                  </h4>
                </div>

                <label>
                  Business Name:

                  <input
                    type="text"
                    value={
                      newBusiness.name
                    }
                    onChange={(e) =>
                      setNewBusiness(
                        {
                          ...newBusiness,
                          name: e.target
                            .value,
                        }
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Owner Username:

                  <input
                    type="text"
                    value={
                      newBusiness.owner_username
                    }
                    onChange={(e) =>
                      setNewBusiness(
                        {
                          ...newBusiness,
                          owner_username:
                            e.target
                              .value,
                        }
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Address:

                  <input
                    type="text"
                    value={
                      newBusiness.address
                    }
                    onChange={(e) =>
                      setNewBusiness(
                        {
                          ...newBusiness,
                          address:
                            e.target
                              .value,
                        }
                      )
                    }
                  />
                </label>

                <label>
                  Phone:

                  <input
                    type="text"
                    value={
                      newBusiness.phone
                    }
                    onChange={(e) =>
                      setNewBusiness(
                        {
                          ...newBusiness,
                          phone: e.target
                            .value,
                        }
                      )
                    }
                  />
                </label>

                <label>
                  Email:

                  <input
                    type="email"
                    value={
                      newBusiness.email
                    }
                    onChange={(e) =>
                      setNewBusiness(
                        {
                          ...newBusiness,
                          email:
                            e.target
                              .value,
                        }
                      )
                    }
                  />
                </label>

                <div className="form-buttons">
                  <button type="submit">
                    Create
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAction(
                        "list-businesses"
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

                  {/* ================================================= EDIT BUSINESS ================================================= */}
        {isSuperAdmin &&
          selectedAction === "edit-business" &&
          editingBusiness && (
            <form
              onSubmit={handleUpdateBusiness}
              className="edit-form compact-form super-admin-form"
            >
              <h3>
                Edit Business (ID: {editingBusiness.id})
              </h3>

              {/* Business Name */}
              <label>
                Business Name:
                <input
                  type="text"
                  value={editingBusiness.name || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* Owner Username */}
              <label>
                Owner Username:
                <input
                  type="text"
                  value={editingBusiness.owner_username || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      owner_username: e.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* Address */}
              <label>
                Address:
                <input
                  type="text"
                  value={editingBusiness.address || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      address: e.target.value,
                    })
                  }
                />
              </label>

              {/* Phone */}
              <label>
                Phone:
                <input
                  type="text"
                  value={editingBusiness.phone || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      phone: e.target.value,
                    })
                  }
                />
              </label>

              {/* Email */}
              <label>
                Email:
                <input
                  type="email"
                  value={editingBusiness.email || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      email: e.target.value,
                    })
                  }
                />
              </label>

              <div className="form-actions">
                <button
                  className="action-btn save"
                  type="submit"
                >
                  💾 Save Changes
                </button>

                <button
                  className="action-btn cancel"
                  type="button"
                  onClick={() => {
                    setEditingBusiness(null);
                    setSelectedAction("list-businesses");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

        {/* ================================================= DELETE BUSINESS MODAL ================================================= */}
        {isSuperAdmin && businessToDelete !== null && (
          <div
            className="modal-overlay"
            onClick={() => setBusinessToDelete(null)}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close-btn"
                type="button"
                onClick={() => setBusinessToDelete(null)}
              >
                ✖
              </button>

              <h3>Delete Business</h3>

              <p>
                Are you sure you want to delete Business #
                {businessToDelete}?
              </p>

              <p className="warning-text">
                This action cannot be undone.
              </p>

              <div className="modal-actions">
                <button
                  className="action-btn delete"
                  type="button"
                  onClick={handleDeleteBusiness}
                >
                  🗑️ Delete Business
                </button>

                <button
                  className="action-btn cancel"
                  type="button"
                  onClick={() => setBusinessToDelete(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= LICENSE MANAGEMENT ================================================= */}
        {isSuperAdmin &&
          selectedAction === "license-management" && (
            <div className="license-management">
              <div className="section-header">
                <h3>License Management</h3>

                <button
                  className="btn create"
                  type="button"
                  onClick={() =>
                    setSelectedAction("generate-license")
                  }
                >
                  + Generate License
                </button>
              </div>

              {/* Current License Status */}
              <div className="license-status-card">
                <h4>Current License Status</h4>

                {licenseStatus ? (
                  <div className="license-info">
                    <div>
                      <strong>Status:</strong>{" "}
                      {licenseStatus.active ||
                      licenseStatus.license_active ? (
                        <span className="status-active">
                          Active
                        </span>
                      ) : (
                        <span className="status-inactive">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div>
                      <strong>Business:</strong>{" "}
                      {licenseStatus.business_name ||
                        (licenseStatus.business_id
                          ? `Business #${licenseStatus.business_id}`
                          : "—")}
                    </div>

                    <div>
                      <strong>Expiration:</strong>{" "}
                      {licenseStatus.expiration_date
                        ? new Date(
                            licenseStatus.expiration_date
                          ).toLocaleDateString()
                        : "—"}
                    </div>

                    {licenseStatus.days_remaining !==
                      undefined && (
                      <div>
                        <strong>Days Remaining:</strong>{" "}
                        {licenseStatus.days_remaining}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>No license information available.</p>
                )}
              </div>

              {/* Businesses / License Overview */}
              <div className="table-wrapper">
                <div className="user-table compact super-admin-table">
                  <div className="table-header with-business">
                    <div>ID</div>
                    <div>Business</div>
                    <div>Expiration</div>
                    <div>Status</div>
                  </div>

                  {businesses.length === 0 ? (
                    <div className="no-data">
                      No businesses found.
                    </div>
                  ) : (
                    businesses.map((business) => (
                      <div
                        className="table-row with-business"
                        key={business.id}
                      >
                        <div>{business.id}</div>

                        <div>
                          {business.name || "—"}
                        </div>

                        <div>
                          {business.expiration_date
                            ? new Date(
                                business.expiration_date
                              ).toLocaleDateString()
                            : "—"}
                        </div>

                        <div>
                          {business.license_active ? (
                            <span className="status-active">
                              Active
                            </span>
                          ) : (
                            <span className="status-inactive">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        {/* ================================================= GENERATE LICENSE ================================================= */}
        {isSuperAdmin &&
          selectedAction === "generate-license" && (
            <form
              onSubmit={handleGenerateLicense}
              className="edit-form compact-form super-admin-form"
            >
              <h3>Generate New License</h3>

              {/* License Password */}
              <label>
                License Password:
                <input
                  type="password"
                  value={newLicense.license_password}
                  onChange={(e) =>
                    setNewLicense({
                      ...newLicense,
                      license_password: e.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* License Key */}
              <label>
                License Key:
                <input
                  type="text"
                  value={newLicense.key}
                  onChange={(e) =>
                    setNewLicense({
                      ...newLicense,
                      key: e.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* Duration */}
              <label>
                Duration (Days):
                <input
                  type="number"
                  min="1"
                  value={newLicense.duration_days}
                  onChange={(e) =>
                    setNewLicense({
                      ...newLicense,
                      duration_days: e.target.value,
                    })
                  }
                  required
                />
              </label>

              {/* Business */}
              <label>
                Business:
                <select
                  value={newLicense.business_id}
                  onChange={(e) =>
                    setNewLicense({
                      ...newLicense,
                      business_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">
                    Select Business
                  </option>

                  {businesses.map((business) => (
                    <option
                      key={business.id}
                      value={business.id}
                    >
                      {business.name} — #{business.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-actions">
                <button
                  className="action-btn save"
                  type="submit"
                >
                  🔑 Generate License
                </button>

                <button
                  className="action-btn cancel"
                  type="button"
                  onClick={() =>
                    setSelectedAction("license-management")
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

        {/* ================================================= DELETE USER MODAL ================================================= */}
        {userToDelete && (
          <div
            className="modal-overlay"
            onClick={() => setUserToDelete(null)}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close-btn"
                type="button"
                onClick={() => setUserToDelete(null)}
              >
                ✖
              </button>

              <h3>Delete User</h3>

              <p>
                Are you sure you want to delete user{" "}
                <strong>{userToDelete}</strong>?
              </p>

              <p className="warning-text">
                This action cannot be undone.
              </p>

              <div className="modal-actions">
                <button
                  className="action-btn delete"
                  type="button"
                  onClick={handleConfirmDelete}
                >
                  🗑️ Delete User
                </button>

                <button
                  className="action-btn cancel"
                  type="button"
                  onClick={() => setUserToDelete(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )}
    </div>
  );
};

export default UserManagement;
