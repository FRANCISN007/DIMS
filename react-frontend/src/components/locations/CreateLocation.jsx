
// src/components/CreateLocation.jsx

import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateLocation.css";

const CreateLocation = ({ onClose }) => {
  /* =========================================================
     STATE
  ========================================================= */

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    description: "",
    status: "active",
  });

  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  /* =========================================================
     AUTO HIDE MESSAGE
     Message disappears after 3 seconds
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

    /*
     * Clear any existing message when
     * the user starts making changes.
     */
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
      setMessage("Location name is required.");
      setMessageType("error");
      return false;
    }

    if (!formData.code.trim()) {
      setMessage("Location code is required.");
      setMessageType("error");
      return false;
    }

    return true;
  };

  /* =========================================================
     CREATE LOCATION
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
       * Business ID is NOT included here.
       *
       * For normal business users, the backend gets
       * the business from current_user.business_id.
       *
       * For Super Admin, the backend currently requires
       * business_id as a query parameter.
       *
       * If your Create Location screen later includes
       * a Business selector for Super Admin, we can add
       * that without changing the rest of this form.
       */

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        description: formData.description.trim() || null,
        status: formData.status,
      };

      console.log(
        "CREATE LOCATION PAYLOAD:",
        payload
      );

      const response = await axiosWithAuth().post(
        "/locations",
        payload
      );

      console.log(
        "CREATE LOCATION RESPONSE:",
        response.data
      );

      /* =====================================================
         SUCCESS
      ===================================================== */

      setMessage(
        "Location created successfully."
      );

      setMessageType("success");

      /*
       * Clear the form after successful creation.
       */
      setFormData({
        name: "",
        code: "",
        address: "",
        phone: "",
        description: "",
        status: "active",
      });
    } catch (error) {
      console.error(
        "Create location error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;

      const detail =
        error?.response?.data?.detail;

      /* =====================================================
         ERROR HANDLING
      ===================================================== */

      if (status === 400) {
        setMessage(
          detail ||
            "Location name or code already exists."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to create this location."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Business not found."
        );
      } else {
        setMessage(
          detail ||
            "Failed to create location. Please try again."
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
      address: "",
      phone: "",
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
    <div className="create-location-page">

      <form
        className="create-location-form"
        onSubmit={handleSubmit}
      >

        {/* ===================================================
            CLOSE BUTTON
        =================================================== */}

        <button
          type="button"
          className="create-location-close"
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

        <div className="create-location-header">
          <div>
            <h2>Create Location</h2>

            <p>
              Create a new location for your business.
            </p>
          </div>
        </div>

        {/* ===================================================
            MESSAGE
        =================================================== */}

        {message && (
          <div
            className={`location-message ${
              messageType === "success"
                ? "location-message-success"
                : "location-message-error"
            }`}
          >
            <span className="location-message-icon">
              {messageType === "success"
                ? "✓"
                : "⚠"}
            </span>

            <span>{message}</span>
          </div>
        )}

        {/* ===================================================
            LOCATION NAME
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-name">
            Location Name{" "}
            <span className="required">*</span>
          </label>

          <input
            id="location-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter location name"
            maxLength={100}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            LOCATION CODE
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-code">
            Location Code{" "}
            <span className="required">*</span>
          </label>

          <input
            id="location-code"
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Example: LOC001"
            maxLength={30}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            ADDRESS
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-address">
            Address
          </label>

          <input
            id="location-address"
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter location address"
            maxLength={255}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            PHONE
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-phone">
            Phone
          </label>

          <input
            id="location-phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Enter phone number"
            maxLength={20}
            disabled={submitting}
            autoComplete="off"
          />
        </div>

        {/* ===================================================
            DESCRIPTION
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-description">
            Description
          </label>

          <textarea
            id="location-description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief description of the location"
            rows={2}
            maxLength={255}
            disabled={submitting}
          />
        </div>

        {/* ===================================================
            STATUS
        =================================================== */}

        <div className="form-group">
          <label htmlFor="location-status">
            Status
          </label>

          <select
            id="location-status"
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
            className="reset-location-button"
            onClick={handleReset}
            disabled={submitting}
          >
            Reset
          </button>

          <button
            type="submit"
            className="create-location-button"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="location-spinner"></span>
                Creating...
              </>
            ) : (
              "Create Location"
            )}
          </button>

        </div>

      </form>
    </div>
  );
};

export default CreateLocation;

