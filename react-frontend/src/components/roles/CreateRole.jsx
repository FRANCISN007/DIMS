import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateRole.css";

const CreateRole = ({ onClose }) => {
  /* =========================================================
     CURRENT USER
     ========================================================= */

  const storedUser = localStorage.getItem("user");

  let currentUser = null;

  try {
    currentUser = storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch (error) {
    console.error("Unable to read logged-in user:", error);
  }

  /*
   * Super Admin has no business_id.
   *
   * Therefore:
   *
   * business_id === null / undefined
   *       => Super Admin
   *
   * business_id exists
   *       => Business Admin / normal business user
   */
  const isSuperAdmin =
    currentUser?.business_id === null ||
    currentUser?.business_id === undefined;

  /* =========================================================
     STATE
     ========================================================= */

  const [formData, setFormData] = useState({
    business_id: "",
    name: "",
    code: "",
    description: "",
    status: "active",
  });

  const [businesses, setBusinesses] = useState([]);

  const [loadingBusinesses, setLoadingBusinesses] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  /* =========================================================
     AUTO HIDE MESSAGE
     ========================================================= */

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  /* =========================================================
     LOAD BUSINESSES
     
     Only Super Admin needs the business dropdown.
     ========================================================= */

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    const fetchBusinesses = async () => {
      try {
        setLoadingBusinesses(true);

        const response = await axiosWithAuth().get(
          "/business/simple"
        );

        console.log(
          "BUSINESS SIMPLE RESPONSE:",
          response.data
        );

        setBusinesses(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load businesses:",
          error?.response?.data || error
        );

        setMessage(
          error?.response?.data?.detail ||
            "Failed to load businesses."
        );

        setMessageType("error");
      } finally {
        setLoadingBusinesses(false);
      }
    };

    fetchBusinesses();
  }, [isSuperAdmin]);

  /* =========================================================
     CLOSE FORM
     ========================================================= */

  const handleClose = () => {
    if (submitting) {
      return;
    }

    if (typeof onClose === "function") {
      onClose();
    }
  };

  /* =========================================================
     HANDLE INPUT
     ========================================================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (message) {
      setMessage("");
      setMessageType("");
    }
  };

  /* =========================================================
     VALIDATION
     ========================================================= */

  const validateForm = () => {
    /* -------------------------------------------------------
       SUPER ADMIN BUSINESS
       ------------------------------------------------------- */

    if (isSuperAdmin && !formData.business_id) {
      setMessage(
        "Please select a business for this role."
      );

      setMessageType("error");

      return false;
    }

    /* -------------------------------------------------------
       ROLE NAME
       ------------------------------------------------------- */

    if (!formData.name.trim()) {
      setMessage("Role name is required.");
      setMessageType("error");

      return false;
    }

    /* -------------------------------------------------------
       ROLE CODE
       ------------------------------------------------------- */

    if (!formData.code.trim()) {
      setMessage("Role code is required.");
      setMessageType("error");

      return false;
    }

    return true;
  };

  /* =========================================================
     CREATE ROLE
     ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      /* =====================================================
         PAYLOAD
         ===================================================== */

      const payload = {
        name: formData.name.trim(),

        code: formData.code.trim(),

        description:
          formData.description.trim() || null,

        status: formData.status,
      };

      /*
       * IMPORTANT
       *
       * Only Super Admin sends business_id.
       *
       * For Business Admin, the backend determines:
       *
       * current_user.business_id
       */

      if (isSuperAdmin) {
        payload.business_id =
          Number(formData.business_id);
      }

      console.log(
        "CREATE ROLE PAYLOAD:",
        payload
      );

      /* =====================================================
         POST
         ===================================================== */

      const response = await axiosWithAuth().post(
        "/roles",
        payload
      );

      console.log(
        "CREATE ROLE RESPONSE:",
        response.data
      );

      /* =====================================================
         SUCCESS
         ===================================================== */

      setMessage(
        "Role created successfully."
      );

      setMessageType("success");

      /* =====================================================
         RESET FORM
         ===================================================== */

      setFormData({
        business_id: "",
        name: "",
        code: "",
        description: "",
        status: "active",
      });
    } catch (error) {
      console.error(
        "Create role error:",
        error?.response?.data || error
      );

      const responseStatus =
        error?.response?.status;

      const detail =
        error?.response?.data?.detail;

      if (responseStatus === 409) {
        setMessage(
          detail ||
            "Role name or code already exists."
        );
      } else if (responseStatus === 400) {
        setMessage(
          detail ||
            "Please check the information provided."
        );
      } else if (responseStatus === 403) {
        setMessage(
          detail ||
            "You do not have permission to create this role."
        );
      } else if (responseStatus === 404) {
        setMessage(
          detail ||
            "Business not found."
        );
      } else if (responseStatus === 422) {
        setMessage(
          detail ||
            "Please provide all required role information."
        );
      } else {
        setMessage(
          detail ||
            "Failed to create role. Please try again."
        );
      }

      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     RESET
     ========================================================= */

  const handleReset = () => {
    setFormData({
      business_id: "",
      name: "",
      code: "",
      description: "",
      status: "active",
    });

    setMessage("");
    setMessageType("");
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="create-role-page">
      <form
        className="create-role-form"
        onSubmit={handleSubmit}
      >
        {/* ===================================================
            CLOSE BUTTON
            =================================================== */}

        <button
          type="button"
          className="create-role-close"
          onClick={handleClose}
          disabled={submitting}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>

        {/* ===================================================
            HEADER
            =================================================== */}

        <div className="create-role-header">
          <div>
            <h2>Create Role</h2>

            <p>
              {isSuperAdmin
                ? "Create a role for a selected business."
                : "Create a new role for your business."}
            </p>
          </div>
        </div>

        {/* ===================================================
            MESSAGE
            =================================================== */}

        {message && (
          <div
            className={`role-message ${
              messageType === "success"
                ? "role-message-success"
                : "role-message-error"
            }`}
          >
            <span className="role-message-icon">
              {messageType === "success"
                ? "✓"
                : "⚠"}
            </span>

            <span>{message}</span>
          </div>
        )}

        {/* ===================================================
            BUSINESS
             
            ONLY SUPER ADMIN
            =================================================== */}

        {isSuperAdmin && (
          <div className="form-group">
            <label htmlFor="business_id">
              Business{" "}
              <span className="required">*</span>
            </label>

            <select
              id="business_id"
              name="business_id"
              value={formData.business_id}
              onChange={handleChange}
              disabled={
                submitting ||
                loadingBusinesses
              }
            >
              <option value="">
                {loadingBusinesses
                  ? "Loading businesses..."
                  : "Select business"}
              </option>

              {businesses.map((business) => (
                <option
                  key={business.id}
                  value={business.id}
                >
                  {business.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ===================================================
            ROLE NAME
            =================================================== */}

        <div className="form-group">
          <label htmlFor="name">
            Role Name{" "}
            <span className="required">*</span>
          </label>

          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter role name"
            maxLength={100}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            ROLE CODE
            =================================================== */}

        <div className="form-group">
          <label htmlFor="code">
            Role Code{" "}
            <span className="required">*</span>
          </label>

          <input
            id="code"
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Example: company_admin"
            maxLength={50}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            DESCRIPTION
            =================================================== */}

        <div className="form-group">
          <label htmlFor="description">
            Description
          </label>

          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief description of the role"
            rows={2}
            maxLength={500}
            disabled={submitting}
          />
        </div>

        {/* ===================================================
            STATUS
            =================================================== */}

        <div className="form-group">
          <label htmlFor="status">
            Status
          </label>

          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={submitting}
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

        {/* ===================================================
            ACTIONS
            =================================================== */}

        <div className="form-actions">
          <button
            type="button"
            className="reset-role-button"
            onClick={handleReset}
            disabled={submitting}
          >
            Reset
          </button>

          <button
            type="submit"
            className="create-role-button"
            disabled={
              submitting ||
              loadingBusinesses
            }
          >
            {submitting ? (
              <>
                <span className="role-spinner"></span>
                Creating...
              </>
            ) : (
              "Create Role"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRole;