import React, { useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateRole.css";

const CreateRole = ({ onClose }) => {
  /* =========================================================
     STATE
  ========================================================= */

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "active",
  });

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

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
    if (!formData.name.trim()) {
      setMessage("Role name is required.");
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

      /*
       * Business ID is NOT included.
       *
       * The backend determines the business
       * from the logged-in user.
       */
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        description: formData.description.trim() || null,
        status: formData.status,
      };

      console.log(
        "CREATE ROLE PAYLOAD:",
        payload
      );

      const response =
        await axiosWithAuth().post(
          "/roles",
          payload
        );

      console.log(
        "CREATE ROLE RESPONSE:",
        response.data
      );

      setMessage(
        "Role created successfully."
      );

      setMessageType("success");

      setFormData({
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

      const status =
        error?.response?.status;

      const detail =
        error?.response?.data?.detail;

      if (status === 409) {
        setMessage(
          detail ||
            "Role name or code already exists."
        );
      } else if (status === 400) {
        setMessage(
          detail ||
            "Please check the information provided."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to create this role."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Business not found."
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
              Create a new role for your business.
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
            Role Code
          </label>

          <input
            id="code"
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Example: STO222"
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
            disabled={submitting}
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