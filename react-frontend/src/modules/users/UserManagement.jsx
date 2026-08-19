import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import "./UserManagement.css";
import getBaseUrl from "../../api/config";

const API_BASE_URL = getBaseUrl();

const SUPER_ADMIN_ROLE = "super_admin";
const ADMIN_ROLE = "admin";

/* =========================================================
   HELPERS
========================================================= */

const normalizeRoleCode = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    value =
      value.code ??
      value.role_code ??
      value.name ??
      value.role_name ??
      "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
};

const getRoleCode = (role) => {
  if (!role) {
    return "";
  }

  if (typeof role === "string") {
    return normalizeRoleCode(role);
  }

  return normalizeRoleCode(
    role.code ??
      role.role_code ??
      role.name ??
      role.role_name
  );
};

const getRoleId = (role) => {
  if (!role) {
    return null;
  }

  if (
    typeof role === "number" ||
    typeof role === "string"
  ) {
    const value = Number(role);

    return Number.isInteger(value)
      ? value
      : null;
  }

  const value = Number(
    role.id ?? role.role_id
  );

  return Number.isInteger(value)
    ? value
    : null;
};

const parseJsonResponse = async (response) => {
  return response
    .json()
    .catch(() => ({}));
};

/* =========================================================
   USER MANAGEMENT
========================================================= */

const UserManagement = () => {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  /* =======================================================
     CURRENT USER
  ======================================================= */

  const storedUser = useMemo(() => {
    let rawUser = {};

    try {
      rawUser = JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch (error) {
      console.error(
        "Invalid stored user:",
        error
      );
    }

    const nestedUser =
      rawUser?.user &&
      typeof rawUser.user === "object"
        ? rawUser.user
        : {};

    const user = {
      ...rawUser,
      ...nestedUser,
    };

    if (
      !user.business_id &&
      rawUser?.business?.id
    ) {
      user.business_id =
        rawUser.business.id;
    }

    if (
      !user.business_name &&
      rawUser?.business?.name
    ) {
      user.business_name =
        rawUser.business.name;
    }

    return user;
  }, []);

  /* =======================================================
     ROLE HELPERS
  ======================================================= */

  const extractUserRoles = useCallback(
    (user) => {
      if (!user) {
        return [];
      }

      const roles = [];

      if (Array.isArray(user.roles)) {
        roles.push(...user.roles);
      }

      if (user.role) {
        if (Array.isArray(user.role)) {
          roles.push(...user.role);
        } else {
          roles.push(user.role);
        }
      }

      if (user.role_code) {
        roles.push(user.role_code);
      }

      if (user.role_name) {
        roles.push(user.role_name);
      }

      return [
        ...new Set(
          roles
            .map(getRoleCode)
            .filter(Boolean)
        ),
      ];
    },
    []
  );

  const currentRoles = useMemo(
    () =>
      extractUserRoles(storedUser),
    [storedUser, extractUserRoles]
  );

  const isSuperAdmin =
    currentRoles.includes(
      SUPER_ADMIN_ROLE
    ) ||
    storedUser.business_id == null;

  const isAdmin =
    isSuperAdmin ||
    currentRoles.includes(
      ADMIN_ROLE
    );

  /* =======================================================
     MAIN STATE
  ======================================================= */

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [businesses, setBusinesses] =
    useState([]);
  const [locations, setLocations] =
    useState([]);

  const [error, setError] =
    useState("");

  const [popupMsg, setPopupMsg] =
    useState("");

  const [selectedAction, setSelectedAction] =
    useState("list");

  /* =======================================================
     CREATE USER
  ======================================================= */

  const emptyNewUser = {
    username: "",
    full_name: "",
    phone: "",
    password: "",
    business_id: isSuperAdmin
      ? ""
      : String(
          storedUser.business_id || ""
        ),
    role_id: "",
    location_id: "",
  };

  const [newUser, setNewUser] =
    useState(emptyNewUser);

  /* =======================================================
     EDIT USER
  ======================================================= */

  const [editingUser, setEditingUser] =
    useState(null);

  const [editRoleId, setEditRoleId] =
    useState("");

  const [editBusinessId, setEditBusinessId] =
    useState("");

  const [editLocationId, setEditLocationId] =
    useState("");

  /* =======================================================
     RESET PASSWORD
  ======================================================= */

  const [resetUser, setResetUser] =
    useState(null);

  const [resetPassword, setResetPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  /* =======================================================
     DELETE USER
  ======================================================= */

  const [userToDelete, setUserToDelete] =
    useState(null);

  /* =======================================================
     BUSINESS
  ======================================================= */

  const [editingBusiness, setEditingBusiness] =
    useState(null);

  const emptyBusiness = {
    name: "",
    address: "",
    phone: "",
    email: "",
    owner_username: "",
  };

  const [newBusiness, setNewBusiness] =
    useState(emptyBusiness);

  const [businessToDelete, setBusinessToDelete] =
    useState(null);

  /* =======================================================
     LICENSE
  ======================================================= */

  const [licenseStatuses, setLicenseStatuses] =
  useState([]);

  const emptyLicense = {
    license_password: "",
    key: "",
    duration_days: 365,
    business_id: "",
  };

  const [newLicense, setNewLicense] =
    useState(emptyLicense);

  /* =======================================================
     POPUP
  ======================================================= */

  const showPopup = useCallback(
    (message) => {
      setPopupMsg(message);

      setTimeout(() => {
        setPopupMsg("");
      }, 3000);
    },
    []
  );

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

        const response = await fetch(
          `${API_BASE_URL}/users/`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept:
                "application/json",
            },
          }
        );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Failed to load users."
          );
        }

        const list = Array.isArray(
          data
        )
          ? data
          : [];

        list.sort((a, b) =>
          String(
            a.username || ""
          ).localeCompare(
            String(
              b.username || ""
            )
          )
        );

        setUsers(list);
      } catch (err) {
        console.error(
          "Fetch users error:",
          err
        );

        setError(
          err.message ||
            "Could not load users."
        );
      }
    },
    [token]
  );

  /* =======================================================
     FETCH ROLES
  ======================================================= */

  const fetchRoles = useCallback(
    async () => {
      if (!token) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/roles/simple`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Failed to load roles."
          );
        }

        const list = Array.isArray(
          data
        )
          ? data
          : [];

        list.sort((a, b) =>
          String(
            a.name ||
              a.code ||
              ""
          ).localeCompare(
            String(
              b.name ||
                b.code ||
                ""
            )
          )
        );

        setRoles(list);
      } catch (err) {
        console.error(
          "Fetch roles error:",
          err
        );

        setRoles([]);

        showPopup(
          err.message ||
            "Could not load roles."
        );
      }
    },
    [token, showPopup]
  );

  /* =======================================================
     FETCH BUSINESSES
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
        const response =
          await fetch(
            `${API_BASE_URL}/business/`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Failed to load businesses."
          );
        }

        const list =
          Array.isArray(data)
            ? data
            : data.businesses || [];

        list.sort((a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          )
        );

        setBusinesses(list);
      } catch (err) {
        console.error(
          "Fetch businesses error:",
          err
        );

        setBusinesses([]);

        showPopup(
          err.message ||
            "Could not load businesses."
        );
      }
    }, [
      token,
      isSuperAdmin,
      showPopup,
    ]);

  /* =======================================================
     FETCH LOCATIONS
  ======================================================= */

  const fetchLocations =
    useCallback(
      async (businessId) => {
        if (!token) {
          return;
        }

        if (!businessId) {
          setLocations([]);
          return;
        }

        try {
          const response =
            await fetch(
              `${API_BASE_URL}/locations/?business_id=${encodeURIComponent(
                businessId
              )}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                  Accept:
                    "application/json",
                },
              }
            );

          const data =
            await parseJsonResponse(
              response
            );

          if (!response.ok) {
            throw new Error(
              data.detail ||
                "Failed to load locations."
            );
          }

          const list =
            Array.isArray(data)
              ? data
              : data.locations || [];

          list.sort((a, b) =>
            String(
              a.name || ""
            ).localeCompare(
              String(
                b.name || ""
              )
            )
          );

          setLocations(list);
        } catch (err) {
          console.error(
            "Fetch locations error:",
            err
          );

          setLocations([]);

          showPopup(
            err.message ||
              "Could not load locations."
          );
        }
      },
      [token, showPopup]
    );

  const fetchLicenseStatus =
  useCallback(async () => {
    if (
      !token ||
      !isSuperAdmin
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/license/management`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await parseJsonResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to load license information."
        );
      }

      setLicenseStatuses(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(
        "License management error:",
        err
      );

      setLicenseStatuses([]);

      showPopup(
        err.message ||
          "Could not load license information."
      );
    }
  }, [
    token,
    isSuperAdmin,
    showPopup,
  ]);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    if (!token) {
      setError(
        "You must be logged in."
      );
      return;
    }

    if (!isAdmin) {
      return;
    }

    fetchUsers();
    fetchRoles();

    if (isSuperAdmin) {
      fetchBusinesses();
      fetchLicenseStatus();
    }
  }, [
    token,
    isAdmin,
    isSuperAdmin,
    fetchUsers,
    fetchRoles,
    fetchBusinesses,
    fetchLicenseStatus,
  ]);

  /* =======================================================
     INITIALIZE CREATE USER BUSINESS
     
     IMPORTANT:
     Non-Super-Admin users already belong to a business.
     Therefore we automatically use their business ID.
  ======================================================= */

  useEffect(() => {
    if (
      selectedAction !== "add"
    ) {
      return;
    }

    if (!isSuperAdmin) {
      const businessId =
        storedUser.business_id
          ? String(
              storedUser.business_id
            )
          : "";

      setNewUser((previous) => {
        if (
          previous.business_id ===
          businessId
        ) {
          return previous;
        }

        return {
          ...previous,
          business_id:
            businessId,
        };
      });
    }
  }, [
    selectedAction,
    isSuperAdmin,
    storedUser.business_id,
  ]);

  /* =======================================================
     LOAD LOCATIONS FOR CREATE USER
  ======================================================= */

  useEffect(() => {
    if (
      selectedAction !== "add"
    ) {
      return;
    }

    if (!newUser.business_id) {
      setLocations([]);
      return;
    }

    fetchLocations(
      newUser.business_id
    );
  }, [
    selectedAction,
    newUser.business_id,
    fetchLocations,
  ]);

  /* =======================================================
     LOAD LOCATIONS FOR EDIT USER
  ======================================================= */

  useEffect(() => {
    if (
      selectedAction !== "update"
    ) {
      return;
    }

    if (!editBusinessId) {
      setLocations([]);
      return;
    }

    fetchLocations(
      editBusinessId
    );
  }, [
    selectedAction,
    editBusinessId,
    fetchLocations,
  ]);

  /* =======================================================
     AVAILABLE ROLES
  ======================================================= */

  const availableRoles = useMemo(() => {
    return roles.filter((role) => {
      const code =
        getRoleCode(role);

      if (
        code ===
          SUPER_ADMIN_ROLE &&
        !isSuperAdmin
      ) {
        return false;
      }

      return true;
    });
  }, [
    roles,
    isSuperAdmin,
  ]);

  /* =======================================================
     CREATE USER
  ======================================================= */

  const submitAddUser =
    async (event) => {
      event.preventDefault();

      if (!isAdmin) {
        showPopup(
          "Insufficient permissions."
        );
        return;
      }

      if (
        !newUser.username.trim()
      ) {
        showPopup(
          "Username is required."
        );
        return;
      }

      if (
        !newUser.full_name.trim()
      ) {
        showPopup(
          "Full name is required."
        );
        return;
      }

      if (!newUser.password) {
        showPopup(
          "Password is required."
        );
        return;
      }

      if (!newUser.role_id) {
        showPopup(
          "Please select a role."
        );
        return;
      }

      let businessId = null;

      if (isSuperAdmin) {
        if (newUser.business_id) {
          businessId = Number(
            newUser.business_id
          );

          if (
            !Number.isInteger(
              businessId
            ) ||
            businessId <= 0
          ) {
            showPopup(
              "Invalid business."
            );
            return;
          }
        }
      } else {
        businessId = Number(
          storedUser.business_id
        );

        if (
          !Number.isInteger(
            businessId
          ) ||
          businessId <= 0
        ) {
          showPopup(
            "Your account is not assigned to a valid business."
          );
          return;
        }
      }

      let locationId = null;

      if (newUser.location_id) {
        locationId = Number(
          newUser.location_id
        );

        if (
          !Number.isInteger(
            locationId
          ) ||
          locationId <= 0
        ) {
          showPopup(
            "Invalid location."
          );
          return;
        }
      }

      const roleId = Number(
        newUser.role_id
      );

      if (
        !Number.isInteger(
          roleId
        ) ||
        roleId <= 0
      ) {
        showPopup(
          "Invalid role."
        );
        return;
      }

      /*
       * Super Admin without a business
       * cannot have a location.
       */
      if (!businessId) {
        locationId = null;
      }

      const payload = {
        username:
          newUser.username
            .trim()
            .toLowerCase(),

        full_name:
          newUser.full_name.trim(),

        phone:
          newUser.phone.trim() ||
          null,

        password:
          newUser.password,

        role_ids: [roleId],

        business_id:
          businessId,

        location_id:
          locationId,

        status:
          newUser.status || "active",
      };

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/users/register`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "User creation failed."
          );
        }

        showPopup(
          `User "${newUser.username}" created successfully.`
        );

        setNewUser({
          ...emptyNewUser,
          business_id:
            isSuperAdmin
              ? ""
              : String(
                  storedUser.business_id ||
                    ""
                ),
        });

        setLocations([]);

        setSelectedAction(
          "list"
        );

        await fetchUsers();
      } catch (err) {
        console.error(
          "Create user error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to create user."
        );
      }
    };

  /* =======================================================
     EDIT USER
  ======================================================= */

  const handleEditClick = (
    user
  ) => {
    let roleId = "";

    if (
      Array.isArray(
        user.roles
      ) &&
      user.roles.length > 0
    ) {
      roleId =
        getRoleId(
          user.roles[0]
        ) || "";
    }

    if (
      !roleId &&
      user.role_id
    ) {
      roleId = Number(
        user.role_id
      );
    }

    if (
      !roleId &&
      Array.isArray(
        user.role_ids
      ) &&
      user.role_ids.length > 0
    ) {
      roleId = Number(
        user.role_ids[0]
      );
    }

    setEditingUser({
      ...user,
      status:
        user.status === "inactive"
          ? "inactive"
          : "active",
    });

    setEditRoleId(
      roleId
        ? String(roleId)
        : ""
    );

    setEditBusinessId(
      user.business_id
        ? String(
            user.business_id
          )
        : ""
    );

    setEditLocationId(
      user.location_id
        ? String(
            user.location_id
          )
        : ""
    );

    setLocations([]);

    setError("");

    setSelectedAction(
      "update"
    );
  };

  /* =======================================================
     UPDATE USER
  ======================================================= */

  const submitUpdate =
    async (event) => {
      event.preventDefault();

      if (!editingUser) {
        return;
      }

      if (!editRoleId) {
        showPopup(
          "Please select a role."
        );
        return;
      }

      const selectedRole =
        roles.find(
          (role) =>
            Number(
              role.id
            ) ===
            Number(
              editRoleId
            )
        );

      if (
        !isSuperAdmin &&
        getRoleCode(
          selectedRole
        ) ===
          SUPER_ADMIN_ROLE
      ) {
        showPopup(
          "You cannot assign Super Admin role."
        );
        return;
      }

      let businessId = null;

      if (isSuperAdmin) {
        if (editBusinessId) {
          businessId = Number(
            editBusinessId
          );

          if (
            !Number.isInteger(
              businessId
            ) ||
            businessId <= 0
          ) {
            showPopup(
              "Invalid business."
            );
            return;
          }
        }
      } else {
        businessId = Number(
          storedUser.business_id
        );

        if (
          !Number.isInteger(
            businessId
          ) ||
          businessId <= 0
        ) {
          showPopup(
            "Invalid business."
          );
          return;
        }
      }

      let locationId = null;

      if (editLocationId) {
        locationId = Number(
          editLocationId
        );

        if (
          !Number.isInteger(
            locationId
          ) ||
          locationId <= 0
        ) {
          showPopup(
            "Invalid location."
          );
          return;
        }
      }

      /*
       * A user without a business
       * cannot have a location.
       */
      if (!businessId) {
        locationId = null;
      }

      const payload = {
        full_name:
          editingUser.full_name?.trim() ||
          "",

        phone:
          editingUser.phone?.trim() ||
          null,

        role_ids: [
          Number(editRoleId),
        ],

        business_id:
          businessId,

        location_id:
          locationId,

        status:
          editingUser.status === "inactive"
            ? "inactive"
            : "active",
      };

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/users/${encodeURIComponent(
              editingUser.username
            )}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "User update failed."
          );
        }

        showPopup(
          `User "${editingUser.username}" updated successfully.`
        );

        setEditingUser(null);
        setEditRoleId("");
        setEditBusinessId("");
        setEditLocationId("");
        setLocations([]);

        setSelectedAction(
          "list"
        );

        await fetchUsers();
      } catch (err) {
        console.error(
          "Update user error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to update user."
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
        "You cannot delete your own account."
      );
      return;
    }

    setUserToDelete(
      username
    );
  };

  const handleConfirmDelete =
    async () => {
      if (!userToDelete) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/users/${encodeURIComponent(
              userToDelete
            )}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Delete failed."
          );
        }

        showPopup(
          `User "${userToDelete}" deleted successfully.`
        );

        setUserToDelete(
          null
        );

        await fetchUsers();
      } catch (err) {
        console.error(
          "Delete user error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to delete user."
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
          "Please enter a new password."
        );
        return;
      }

      if (
        resetPassword !==
        confirmPassword
      ) {
        showPopup(
          "Passwords do not match."
        );
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/users/${encodeURIComponent(
              resetUser.username
            )}/reset-password`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  new_password:
                    resetPassword,
                }),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Password reset failed."
          );
        }

        showPopup(
          "Password reset successfully."
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
            "Failed to reset password."
        );
      }
    };

  /* =======================================================
     ROLE DISPLAY
  ======================================================= */

  const getRoleDisplay = (
    user
  ) => {
    if (
      Array.isArray(
        user.roles
      ) &&
      user.roles.length
    ) {
      return user.roles
        .map(
          (role) =>
            role.name ||
            role.code ||
            role.role_name ||
            role.role_code ||
            ""
        )
        .filter(Boolean)
        .join(", ");
    }

    if (
      Array.isArray(
        user.role_ids
      )
    ) {
      return user.role_ids
        .map((id) => {
          const role =
            roles.find(
              (item) =>
                Number(
                  item.id
                ) ===
                Number(id)
            );

          return (
            role?.name ||
            role?.code ||
            ""
          );
        })
        .filter(Boolean)
        .join(", ");
    }

    if (user.role_name) {
      return user.role_name;
    }

    if (user.role_code) {
      return user.role_code;
    }

    return "—";
  };

  /* =======================================================
     CHECK USER SUPER ADMIN
  ======================================================= */

  const userIsSuperAdmin = (
    user
  ) => {
    if (
      user.business_id ===
      null
    ) {
      return true;
    }

    if (
      Array.isArray(
        user.roles
      )
    ) {
      return user.roles.some(
        (role) =>
          getRoleCode(
            role
          ) ===
          SUPER_ADMIN_ROLE
      );
    }

    if (
      Array.isArray(
        user.role_ids
      )
    ) {
      return user.role_ids.some(
        (id) => {
          const role =
            roles.find(
              (item) =>
                Number(
                  item.id
                ) ===
                Number(id)
            );

          return (
            getRoleCode(
              role
            ) ===
            SUPER_ADMIN_ROLE
          );
        }
      );
    }

    return (
      normalizeRoleCode(
        user.role_code
      ) ===
      SUPER_ADMIN_ROLE
    );
  };

  /* =======================================================
     CREATE BUSINESS
  ======================================================= */

  const handleCreateBusiness =
    async (event) => {
      event.preventDefault();

      if (!isSuperAdmin) {
        showPopup(
          "Only Super Admin can manage businesses."
        );
        return;
      }

      if (
        !newBusiness.name.trim()
      ) {
        showPopup(
          "Business name is required."
        );
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/business/`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify(
                  newBusiness
                ),
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Business creation failed."
          );
        }

        showPopup(
          "Business created successfully."
        );

        setNewBusiness({
          ...emptyBusiness,
        });

        setSelectedAction(
          "list-businesses"
        );

        await fetchBusinesses();
      } catch (err) {
        console.error(
          "Create business error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to create business."
        );
      }
    };

  /* =======================================================
     UPDATE BUSINESS
  ======================================================= */

  const handleUpdateBusiness =
    async (event) => {
      event.preventDefault();

      if (!isSuperAdmin) {
        showPopup(
          "Only Super Admin can manage businesses."
        );
        return;
      }

      if (
        !editingBusiness ||
        !editingBusiness.id
      ) {
        showPopup(
          "No business selected."
        );
        return;
      }

      if (
        !editingBusiness.name?.trim()
      ) {
        showPopup(
          "Business name is required."
        );
        return;
      }

      const businessId = Number(
        editingBusiness.id
      );

      if (
        !Number.isInteger(
          businessId
        ) ||
        businessId <= 0
      ) {
        showPopup(
          "Invalid business ID."
        );
        return;
      }

      const payload = {
        name:
          editingBusiness.name.trim(),

        owner_username:
          editingBusiness.owner_username?.trim() ||
          null,

        address:
          editingBusiness.address?.trim() ||
          null,

        phone:
          editingBusiness.phone?.trim() ||
          null,

        email:
          editingBusiness.email?.trim() ||
          null,
      };

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/business/${businessId}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const responseText =
          await response.text();

        let data = {};

        try {
          data = responseText
            ? JSON.parse(
                responseText
              )
            : {};
        } catch {
          data = {
            detail:
              responseText,
          };
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              `Business update failed (${response.status}).`
          );
        }

        showPopup(
          "Business updated successfully."
        );

        setEditingBusiness(null);

        setSelectedAction(
          "list-businesses"
        );

        await fetchBusinesses();
        await fetchUsers();
      } catch (err) {
        console.error(
          "UPDATE BUSINESS ERROR:",
          err
        );

        if (
          err instanceof TypeError
        ) {
          showPopup(
            "Failed to connect to the server. Check the API URL, backend server, and CORS."
          );
          return;
        }

        showPopup(
          err.message ||
            "Failed to update business."
        );
      }
    };

  /* =======================================================
     DELETE BUSINESS
  ======================================================= */

  const handleDeleteBusiness =
    async () => {
      if (
        !isSuperAdmin ||
        businessToDelete ===
          null
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/business/${businessToDelete}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Business deletion failed."
          );
        }

        showPopup(
          "Business deleted successfully."
        );

        setBusinessToDelete(
          null
        );

        await fetchBusinesses();
        await fetchUsers();
      } catch (err) {
        console.error(
          "Delete business error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to delete business."
        );
      }
    };

  /* =======================================================
     GENERATE LICENSE
  ======================================================= */

  const handleGenerateLicense =
    async (event) => {
      event.preventDefault();

      if (!isSuperAdmin) {
        return;
      }

      if (
        !newLicense.license_password ||
        !newLicense.key ||
        !newLicense.business_id
      ) {
        showPopup(
          "License password, key and business are required."
        );
        return;
      }

      const durationDays = Number(
        newLicense.duration_days
      );

      if (
        !Number.isInteger(
          durationDays
        ) ||
        durationDays <= 0
      ) {
        showPopup(
          "License duration must be greater than zero."
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
            durationDays
          )
        );

        formData.append(
          "business_id",
          String(
            newLicense.business_id
          )
        );

        const response =
          await fetch(
            `${API_BASE_URL}/license/generate`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const data =
          await parseJsonResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "License generation failed."
          );
        }

        showPopup(
          "License generated successfully."
        );

        setNewLicense({
          ...emptyLicense,
        });

        setSelectedAction(
          "license-management"
        );

        await fetchLicenseStatus();
        await fetchBusinesses();
      } catch (err) {
        console.error(
          "Generate license error:",
          err
        );

        showPopup(
          err.message ||
            "Failed to generate license."
        );
      }
    };

  /* =======================================================
     REFRESH
  ======================================================= */

  const refreshAll =
    async () => {
      try {
        await fetchUsers();
        await fetchRoles();

        if (isSuperAdmin) {
          await fetchBusinesses();
          await fetchLicenseStatus();
        }

        showPopup(
          "Data refreshed successfully."
        );
      } catch (err) {
        console.error(
          "Refresh error:",
          err
        );
      }
    };

  /* =======================================================
     CLOSE EDIT USER
  ======================================================= */

  const cancelEditUser = () => {
    setEditingUser(null);
    setEditRoleId("");
    setEditBusinessId("");
    setEditLocationId("");
    setLocations([]);
    setSelectedAction("list");
  };

  /* =======================================================
     CLOSE MAIN SCREEN
  ======================================================= */

  const closeManagement = () => {
    navigate(
      "/dashboard/rooms/status",
      {
        replace: true,
      }
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
          <h3>
            🚫 Access Denied
          </h3>

          <p>
            You do not have
            permission to manage
            users.
          </p>
        </div>
      ) : (
        <>
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="user-heading-row">
            <h2 className="user-heading">
              {isSuperAdmin
                ? "Super Admin Tools"
                : "User Management"}
            </h2>

            <div className="header-right">
              <select
                value={
                  selectedAction
                }
                onChange={(event) => {
                  const value =
                    event.target
                      .value;

                  setSelectedAction(
                    value
                  );

                  setEditingUser(
                    null
                  );

                  setEditingBusiness(
                    null
                  );

                  if (
                    value !==
                    "update"
                  ) {
                    setLocations(
                      []
                    );
                  }

                  /*
                   * When opening Create User
                   * for a normal business admin,
                   * immediately restore the
                   * current business.
                   */
                  if (
                    value === "add" &&
                    !isSuperAdmin
                  ) {
                    setNewUser(
                      (previous) => ({
                        ...previous,
                        business_id:
                          String(
                            storedUser.business_id ||
                              ""
                          ),
                        location_id:
                          "",
                      })
                    );
                  }
                }}
              >
                <option value="list">
                  List Users
                </option>

                <option value="add">
                  Create User
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

              <button
                className="btn refresh"
                type="button"
                onClick={
                  refreshAll
                }
              >
                🔄 Refresh
              </button>

              {selectedAction ===
                "list" && (
                <button
                  className="close-main-button"
                  type="button"
                  onClick={
                    closeManagement
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
              USER LIST
          ================================================= */}

          {selectedAction ===
            "list" && (
            <div className="user-table compact">
              <div className="table-header">
                <div>ID</div>
                <div>Username</div>
                <div>Name</div>
                <div>Roles</div>
                <div>Business</div>
                <div>Location</div>
                <div>Status</div>
                <div>Actions</div>
              </div>

              {users.length ===
              0 ? (
                <div className="no-data">
                  No users found.
                </div>
              ) : (
                users.map(
                  (user) => {
                    const userIsSuper =
                      userIsSuperAdmin(
                        user
                      );

                    const protectedUser =
                      !isSuperAdmin &&
                      userIsSuper;

                    return (
                      <div
                        className="table-row"
                        key={
                          user.id ??
                          user.username
                        }
                      >
                        <div>
                          {
                            user.id
                          }
                        </div>

                        <div>
                          {
                            user.username
                          }
                        </div>

                        <div>
                          {
                            user.full_name ||
                            "—"
                          }
                        </div>

                        <div>
                          {getRoleDisplay(
                            user
                          )}
                        </div>

                        <div>
                          {user.business_name ||
                            (user.business_id
                              ? `Business #${user.business_id}`
                              : "— Global —")}
                        </div>

                        <div>
                          {
                            user.location_name ||
                            "—"
                          }
                        </div>

                        <div>
                          {
                            user.status ||
                            "—"
                          }
                        </div>

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
                              protectedUser
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
                              protectedUser
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
                              protectedUser
                            }
                          >
                            🔑 Reset PW
                          </button>
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          )}

          {/* =================================================
              CREATE USER
          ================================================= */}

          {selectedAction ===
            "add" && (
            <form
              onSubmit={
                submitAddUser
              }
              className="edit-form compact-form"
            >
              <div className="edit-header">
                <h4>
                  Create New User
                </h4>
              </div>

              <label>
                Username:

                <input
                  type="text"
                  value={
                    newUser.username
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      username:
                        event.target
                          .value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Full Name:

                <input
                  type="text"
                  value={
                    newUser.full_name
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      full_name:
                        event.target
                          .value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Phone:

                <input
                  type="text"
                  value={
                    newUser.phone
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      phone:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                Password:

                <input
                  type="password"
                  value={
                    newUser.password
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      password:
                        event.target
                          .value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Business:

                {isSuperAdmin ? (
                  <select
                    value={
                      newUser.business_id
                    }
                    onChange={(
                      event
                    ) =>
                      setNewUser({
                        ...newUser,
                        business_id:
                          event.target
                            .value,
                        location_id:
                          "",
                      })
                    }
                  >
                    <option value="">
                      Global / No Business
                    </option>

                    {businesses.map(
                      (
                        business
                      ) => (
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
                ) : (
                  <input
                    type="text"
                    value={
                      storedUser.business_name ||
                      `Business #${storedUser.business_id}`
                    }
                    readOnly
                  />
                )}
              </label>

              <label>
                Role:

                <select
                  value={
                    newUser.role_id
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      role_id:
                        event.target
                          .value,
                    })
                  }
                  required
                >
                  <option value="">
                    Select Role
                  </option>

                  {availableRoles.map(
                    (role) => (
                      <option
                        key={
                          role.id
                        }
                        value={
                          role.id
                        }
                      >
                        {
                          role.name ||
                          role.code
                        }
                      </option>
                    )
                  )}
                </select>
              </label>


              <label>
              Account Status:

              <select
                value={newUser.status}
                onChange={(event) =>
                  setNewUser({
                    ...newUser,
                    status:
                      event.target.value,
                  })
                }
                required
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </label>

              {/* =================================================
                  LOCATION

                  IMPORTANT:
                  Location is NOT controlled by role.

                  It is available for every business role.
                  It is disabled only when there is no business.
              ================================================= */}

              <label>
                Location:

                <select
                  value={
                    newUser.location_id
                  }
                  onChange={(event) =>
                    setNewUser({
                      ...newUser,
                      location_id:
                        event.target
                          .value,
                    })
                  }
                  disabled={
                    !newUser.business_id
                  }
                >
                  <option value="">
                    No Location / Not Assigned
                  </option>

                  {locations.map(
                    (
                      location
                    ) => (
                      <option
                        key={
                          location.id
                        }
                        value={
                          location.id
                        }
                      >
                        {
                          location.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              {newUser.business_id &&
                locations.length ===
                  0 && (
                  <small className="form-help">
                    No locations are currently available for this business.
                  </small>
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
                    Edit User:{" "}
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
                      editingUser.username ||
                      ""
                    }
                    readOnly
                  />
                </label>

                <label>
                  Full Name:

                  <input
                    type="text"
                    value={
                      editingUser.full_name ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setEditingUser({
                        ...editingUser,
                        full_name:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Phone:

                  <input
                    type="text"
                    value={
                      editingUser.phone ||
                      ""
                    }
                    onChange={(
                      event
                    ) =>
                      setEditingUser({
                        ...editingUser,
                        phone:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Business:

                  {isSuperAdmin ? (
                    <select
                      value={
                        editBusinessId
                      }
                      onChange={(
                        event
                      ) => {
                        setEditBusinessId(
                          event.target
                            .value
                        );

                        setEditLocationId(
                          ""
                        );

                        setLocations(
                          []
                        );
                      }}
                    >
                      <option value="">
                        Global / No Business
                      </option>

                      {businesses.map(
                        (
                          business
                        ) => (
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
                  ) : (
                    <input
                      type="text"
                      value={
                        editingUser.business_name ||
                        `Business #${storedUser.business_id}`
                      }
                      readOnly
                    />
                  )}
                </label>

                <label>
                  Role:

                  <select
                    value={
                      editRoleId
                    }
                    onChange={(event) =>
                      setEditRoleId(
                        event.target
                          .value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select Role
                    </option>

                    {availableRoles.map(
                      (role) => (
                        <option
                          key={
                            role.id
                          }
                          value={
                            role.id
                          }
                        >
                          {
                            role.name ||
                            role.code
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                Account Status:

                <select
                  value={
                    editingUser.status || "active"
                  }
                  onChange={(event) =>
                    setEditingUser({
                      ...editingUser,
                      status:
                        event.target.value,
                    })
                  }
                  required
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </label>

                {/* =================================================
                    LOCATION
                ================================================= */}

                <label>
                  Location:

                  <select
                    value={
                      editLocationId
                    }
                    onChange={(event) =>
                      setEditLocationId(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      !editBusinessId
                    }
                  >
                    <option value="">
                      No Location / Not Assigned
                    </option>

                    {locations.map(
                      (
                        location
                      ) => (
                        <option
                          key={
                            location.id
                          }
                          value={
                            location.id
                          }
                        >
                          {
                            location.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                {editBusinessId &&
                  locations.length ===
                    0 && (
                    <small className="form-help">
                      No locations are currently available for this business.
                    </small>
                  )}

                <div className="form-buttons">
                  <button type="submit">
                    💾 Save Changes
                  </button>

                  <button
                    type="button"
                    onClick={
                      cancelEditUser
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
                onClick={(event) =>
                  event.stopPropagation()
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
                  onChange={(event) =>
                    setResetPassword(
                      event.target
                        .value
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
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target
                        .value
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

                <div className="user-table compact">
                  <div className="table-header">
                    <div>ID</div>
                    <div>Name</div>
                    <div>Owner</div>
                    <div>Email</div>
                    <div>License</div>
                    <div>Actions</div>
                  </div>

                  {businesses.length ===
                  0 ? (
                    <div className="no-data">
                      No businesses found.
                    </div>
                  ) : (
                    businesses.map(
                      (
                        business
                      ) => (
                        <div
                          className="table-row"
                          key={
                            business.id
                          }
                        >
                          <div>
                            {
                              business.id
                            }
                          </div>

                          <div>
                            {
                              business.name
                            }
                          </div>

                          <div>
                            {
                              business.owner_username ||
                              "—"
                            }
                          </div>

                          <div>
                            {
                              business.email ||
                              "—"
                            }
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

                          <div className="action-buttons">
                            <button
                              className="btn edit"
                              type="button"
                              onClick={() => {
                                setEditingBusiness(
                                  {
                                    ...business,
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
                                  business.id
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
                className="edit-form compact-form"
              >
                <h3>
                  Create New Business
                </h3>

                <label>
                  Business Name:

                  <input
                    type="text"
                    value={
                      newBusiness.name
                    }
                    onChange={(event) =>
                      setNewBusiness({
                        ...newBusiness,
                        name:
                          event.target
                            .value,
                      })
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
                    onChange={(event) =>
                      setNewBusiness({
                        ...newBusiness,
                        owner_username:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Address:

                  <input
                    type="text"
                    value={
                      newBusiness.address
                    }
                    onChange={(event) =>
                      setNewBusiness({
                        ...newBusiness,
                        address:
                          event.target
                            .value,
                      })
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
                    onChange={(event) =>
                      setNewBusiness({
                        ...newBusiness,
                        phone:
                          event.target
                            .value,
                      })
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
                    onChange={(event) =>
                      setNewBusiness({
                        ...newBusiness,
                        email:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <div className="form-buttons">
                  <button type="submit">
                    Create Business
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

          {/* =================================================
              EDIT BUSINESS
          ================================================= */}

          {isSuperAdmin &&
            selectedAction ===
              "edit-business" &&
            editingBusiness && (
              <form
                onSubmit={
                  handleUpdateBusiness
                }
                className="edit-form compact-form"
              >
                <h3>
                  Edit Business
                </h3>

                <label>
                  Business Name:

                  <input
                    type="text"
                    value={
                      editingBusiness.name ||
                      ""
                    }
                    onChange={(event) =>
                      setEditingBusiness({
                        ...editingBusiness,
                        name:
                          event.target
                            .value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Owner Username:

                  <input
                    type="text"
                    value={
                      editingBusiness.owner_username ||
                      ""
                    }
                    onChange={(event) =>
                      setEditingBusiness({
                        ...editingBusiness,
                        owner_username:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Address:

                  <input
                    type="text"
                    value={
                      editingBusiness.address ||
                      ""
                    }
                    onChange={(event) =>
                      setEditingBusiness({
                        ...editingBusiness,
                        address:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Phone:

                  <input
                    type="text"
                    value={
                      editingBusiness.phone ||
                      ""
                    }
                    onChange={(event) =>
                      setEditingBusiness({
                        ...editingBusiness,
                        phone:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <label>
                  Email:

                  <input
                    type="email"
                    value={
                      editingBusiness.email ||
                      ""
                    }
                    onChange={(event) =>
                      setEditingBusiness({
                        ...editingBusiness,
                        email:
                          event.target
                            .value,
                      })
                    }
                  />
                </label>

                <div className="form-buttons">
                  <button type="submit">
                    💾 Save Changes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingBusiness(
                        null
                      );

                      setSelectedAction(
                        "list-businesses"
                      );
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

          {/* =================================================
              LICENSE MANAGEMENT
          ================================================= */}

          {isSuperAdmin &&
          selectedAction ===
            "license-management" && (
            <div className="license-management">
              <div className="section-header">
                <h3>
                  License Management
                </h3>

                <button
                  className="btn create"
                  type="button"
                  onClick={() =>
                    setSelectedAction(
                      "generate-license"
                    )
                  }
                >
                  + Generate License
                </button>
              </div>

              <div className="user-table compact">
                <div className="table-header">
                  <div>Business</div>
                  <div>Status</div>
                  <div>Start Date</div>
                  <div>Expiration Date</div>
                  <div>Days Remaining</div>
                </div>

                {licenseStatuses.length === 0 ? (
                  <div className="no-data">
                    No license information found.
                  </div>
                ) : (
                  licenseStatuses.map(
                    (license) => (
                      <div
                        className="table-row"
                        key={
                          license.business_id
                        }
                      >
                        <div>
                          {
                            license.business_name
                          }
                        </div>

                        <div>
                          {license.is_active ? (
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
                          {license.start_date
                            ? new Date(
                                license.start_date
                              ).toLocaleDateString()
                            : "—"}
                        </div>

                        <div>
                          {license.expiration_date
                            ? new Date(
                                license.expiration_date
                              ).toLocaleDateString()
                            : "—"}
                        </div>

                        <div>
                          {license.days_left}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          )}

          {/* =================================================
              GENERATE LICENSE
          ================================================= */}

          {isSuperAdmin &&
            selectedAction ===
              "generate-license" && (
              <form
                onSubmit={
                  handleGenerateLicense
                }
                className="edit-form compact-form"
              >
                <h3>
                  Generate New License
                </h3>

                <label>
                  License Password:

                  <input
                    type="password"
                    value={
                      newLicense.license_password
                    }
                    onChange={(event) =>
                      setNewLicense({
                        ...newLicense,
                        license_password:
                          event.target
                            .value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  License Key:

                  <input
                    type="text"
                    value={
                      newLicense.key
                    }
                    onChange={(event) =>
                      setNewLicense({
                        ...newLicense,
                        key:
                          event.target
                            .value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Duration:

                  <input
                    type="number"
                    min="1"
                    value={
                      newLicense.duration_days
                    }
                    onChange={(event) =>
                      setNewLicense({
                        ...newLicense,
                        duration_days:
                          event.target
                            .value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Business:

                  <select
                    value={
                      newLicense.business_id
                    }
                    onChange={(event) =>
                      setNewLicense({
                        ...newLicense,
                        business_id:
                          event.target
                            .value,
                      })
                    }
                    required
                  >
                    <option value="">
                      Select Business
                    </option>

                    {businesses.map(
                      (
                        business
                      ) => (
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
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <div className="form-buttons">
                  <button type="submit">
                    🔑 Generate License
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedAction(
                        "license-management"
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

          {/* =================================================
              DELETE USER MODAL
          ================================================= */}

          {userToDelete && (
            <div
              className="modal-overlay"
              onClick={() =>
                setUserToDelete(
                  null
                )
              }
            >
              <div
                className="modal-content"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <h3>
                  Delete User
                </h3>

                <p>
                  Are you sure you
                  want to delete user{" "}
                  <strong>
                    {
                      userToDelete
                    }
                  </strong>
                  ?
                </p>

                <p className="warning-text">
                  This action cannot
                  be undone.
                </p>

                <div className="modal-actions">
                  <button
                    className="action-btn delete"
                    type="button"
                    onClick={
                      handleConfirmDelete
                    }
                  >
                    🗑️ Delete User
                  </button>

                  <button
                    className="action-btn cancel"
                    type="button"
                    onClick={() =>
                      setUserToDelete(
                        null
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              DELETE BUSINESS MODAL
          ================================================= */}

          {isSuperAdmin &&
            businessToDelete !==
              null && (
              <div
                className="modal-overlay"
                onClick={() =>
                  setBusinessToDelete(
                    null
                  )
                }
              >
                <div
                  className="modal-content"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <h3>
                    Delete Business
                  </h3>

                  <p>
                    Are you sure you
                    want to delete
                    Business #
                    {
                      businessToDelete
                    }
                    ?
                  </p>

                  <p className="warning-text">
                    This action cannot
                    be undone.
                  </p>

                  <div className="modal-actions">
                    <button
                      className="action-btn delete"
                      type="button"
                      onClick={
                        handleDeleteBusiness
                      }
                    >
                      🗑️ Delete Business
                    </button>

                    <button
                      className="action-btn cancel"
                      type="button"
                      onClick={() =>
                        setBusinessToDelete(
                          null
                        )
                      }
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