
import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListLocation.css";

const ListLocation = () => {
  /* =========================================================
     STATE
  ========================================================= */

  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [editingLocation, setEditingLocation] = useState(null);

  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    description: "",
    status: "active",
  });

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [changingStatusId, setChangingStatusId] = useState(null);

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
     FETCH LOCATIONS
  ========================================================= */

  const fetchLocations = async () => {
    try {
      setLoading(true);

      const params = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await axiosWithAuth().get(
        "/locations",
        { params }
      );

      setLocations(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Fetch locations error:",
        error?.response?.data || error
      );

      setMessage(
        error?.response?.data?.detail ||
          "Failed to load locations."
      );

      setMessageType("error");

      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchLocations();
  }, []);

  /* =========================================================
     SEARCH
  ========================================================= */

  const handleSearch = (e) => {
    e.preventDefault();

    fetchLocations();
  };

  /* =========================================================
     FILTER
  ========================================================= */

  const handleFilter = () => {
    fetchLocations();
  };

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const handleClear = () => {
    setSearch("");
    setStatusFilter("");

    setTimeout(() => {
      fetchLocations();
    }, 0);
  };

  /* =========================================================
     START EDIT
  ========================================================= */

  const handleEdit = (location) => {
    setEditingLocation(location);

    setEditForm({
      name: location.name || "",
      code: location.code || "",
      address: location.address || "",
      phone: location.phone || "",
      description: location.description || "",
      status: location.status || "active",
    });

    setMessage("");
    setMessageType("");
  };

  /* =========================================================
     CLOSE EDIT
  ========================================================= */

  const handleCancelEdit = () => {
    if (saving) {
      return;
    }

    setEditingLocation(null);

    setEditForm({
      name: "",
      code: "",
      address: "",
      phone: "",
      description: "",
      status: "active",
    });
  };

  /* =========================================================
     HANDLE EDIT INPUT
  ========================================================= */

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================================================
     SAVE EDIT
  ========================================================= */

  const handleSaveEdit = async (e) => {
    e.preventDefault();

    if (!editingLocation) {
      return;
    }

    if (!editForm.name.trim()) {
      setMessage("Location name is required.");
      setMessageType("error");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: editForm.name.trim(),
        code: editForm.code.trim().toUpperCase(),
        address: editForm.address.trim() || null,
        phone: editForm.phone.trim() || null,
        description: editForm.description.trim() || null,
        status: editForm.status,
      };

      console.log(
        "UPDATE LOCATION PAYLOAD:",
        payload
      );

      const response = await axiosWithAuth().put(
        `/locations/${editingLocation.id}`,
        payload
      );

      console.log(
        "UPDATE LOCATION RESPONSE:",
        response.data
      );

      setMessage(
        "Location updated successfully."
      );
      setMessageType("success");

      setEditingLocation(null);

      await fetchLocations();
    } catch (error) {
      console.error(
        "Update location error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "Location name or code already exists."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to update this location."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Location not found."
        );
      } else {
        setMessage(
          detail ||
            "Failed to update location. Please try again."
        );
      }

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     CHANGE STATUS
  ========================================================= */

  const handleStatusChange = async (
    location,
    newStatus
  ) => {
    if (
      !location ||
      location.status === newStatus
    ) {
      return;
    }

    try {
      setChangingStatusId(location.id);

      const response = await axiosWithAuth().patch(
        `/locations/${location.id}/status`,
        {
          status: newStatus,
        }
      );

      console.log(
        "LOCATION STATUS RESPONSE:",
        response.data
      );

      setLocations((prev) =>
        prev.map((item) =>
          item.id === location.id
            ? {
                ...item,
                status:
                  response.data?.status ||
                  newStatus,
              }
            : item
        )
      );

      setMessage(
        `Location ${
          newStatus === "active"
            ? "activated"
            : "deactivated"
        } successfully.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Change location status error:",
        error?.response?.data || error
      );

      setMessage(
        error?.response?.data?.detail ||
          "Failed to change location status."
      );

      setMessageType("error");
    } finally {
      setChangingStatusId(null);
    }
  };

  /* =========================================================
     DELETE LOCATION
  ========================================================= */

  const handleDelete = async (location) => {
    if (!location) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${location.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(location.id);

      const response = await axiosWithAuth().delete(
        `/locations/${location.id}`
      );

      console.log(
        "DELETE LOCATION RESPONSE:",
        response.data
      );

      setMessage(
        response.data?.detail ||
          "Location deleted successfully."
      );

      setMessageType("success");

      setLocations((prev) =>
        prev.filter(
          (item) => item.id !== location.id
        )
      );

      if (
        editingLocation &&
        editingLocation.id === location.id
      ) {
        setEditingLocation(null);
      }
    } catch (error) {
      console.error(
        "Delete location error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "This location cannot be deleted."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to delete this location."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Location not found."
        );
      } else {
        setMessage(
          detail ||
            "Failed to delete location. Please try again."
        );
      }

      setMessageType("error");
    } finally {
      setDeletingId(null);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="list-location-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="list-location-header">
        <div>
          <h2>Locations</h2>

          <p>
            Manage locations for your business.
          </p>
        </div>

        <span className="location-count">
          {locations.length}{" "}
          {locations.length === 1
            ? "Location"
            : "Locations"}
        </span>
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

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

      {/* =====================================================
          FILTER BAR
      ===================================================== */}

      <div className="location-filter-bar">

        <form
          className="location-search-form"
          onSubmit={handleSearch}
        >
          <input
            type="text"
            className="location-search-input"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search location name or code..."
          />

          <button
            type="submit"
            className="location-search-button"
            disabled={loading}
          >
            Search
          </button>
        </form>

        <div className="location-status-filter">

          <select
            className="location-filter-select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="">
              All Status
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>

          <button
            type="button"
            className="location-filter-button"
            onClick={handleFilter}
            disabled={loading}
          >
            Filter
          </button>

          <button
            type="button"
            className="location-clear-button"
            onClick={handleClear}
          >
            Clear
          </button>

        </div>
      </div>

      {/* =====================================================
          EDIT PANEL
      ===================================================== */}

      {editingLocation && (
        <div className="location-edit-panel">

          <div className="location-edit-header">

            <div>
              <h3>
                Edit Location
              </h3>

              <span>
                Update location information.
              </span>
            </div>

            <button
              type="button"
              className="location-edit-close"
              onClick={handleCancelEdit}
              disabled={saving}
              aria-label="Close edit"
              title="Close"
            >
              ×
            </button>

          </div>

          <form
            className="location-edit-form"
            onSubmit={handleSaveEdit}
          >

            <div className="location-edit-group">
              <label>
                Name <span className="required">*</span>
              </label>

              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                maxLength={100}
                disabled={saving}
              />
            </div>

            <div className="location-edit-group">
              <label>
                Code
              </label>

              <input
                type="text"
                name="code"
                value={editForm.code}
                onChange={handleEditChange}
                maxLength={30}
                disabled={saving}
              />
            </div>

            <div className="location-edit-group">
              <label>
                Address
              </label>

              <input
                type="text"
                name="address"
                value={editForm.address}
                onChange={handleEditChange}
                maxLength={255}
                disabled={saving}
              />
            </div>

            <div className="location-edit-group">
              <label>
                Phone
              </label>

              <input
                type="text"
                name="phone"
                value={editForm.phone}
                onChange={handleEditChange}
                maxLength={20}
                disabled={saving}
              />
            </div>

            <div className="location-edit-group">
              <label>
                Status
              </label>

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                disabled={saving}
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </div>

            <div className="location-edit-group location-edit-description">
              <label>
                Description
              </label>

              <textarea
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                maxLength={255}
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="location-edit-actions">

              <button
                type="button"
                className="location-edit-cancel"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="location-edit-save"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save"}
              </button>

            </div>

          </form>
        </div>
      )}

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="locations-table-container">

        {loading ? (
          <div className="locations-loading">

            <span className="location-loading-spinner"></span>

            Loading locations...

          </div>
        ) : locations.length === 0 ? (
          <div className="locations-empty">

            <div className="locations-empty-icon">
              📍
            </div>

            <h3>
              No locations found
            </h3>

            <p>
              No locations match your current search or filter.
            </p>

          </div>
        ) : (
          <table className="locations-table">

            <thead>
              <tr>
                <th>S/N</th>
                <th>ID</th>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {locations.map(
                (location, index) => (
                  <tr key={location.id}>

                    <td>
                      {index + 1}
                    </td>

                    <td className="location-id">
                      {location.id}
                    </td>

                    <td className="location-name-cell">
                      {location.name}
                    </td>

                    <td>
                      <span className="location-code">
                        {location.code || "—"}
                      </span>
                    </td>

                    <td className="location-address-cell">
                      {location.address || "—"}
                    </td>

                    <td>
                      {location.phone || "—"}
                    </td>

                    <td className="location-description-cell">
                      {location.description || "—"}
                    </td>

                    {/* =======================================
                        STATUS SELECTOR
                    ======================================= */}

                    <td>
                      <select
                        className={`location-status-select ${
                          location.status ===
                          "active"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                        value={
                          location.status ||
                          "inactive"
                        }
                        onChange={(e) =>
                          handleStatusChange(
                            location,
                            e.target.value
                          )
                        }
                        disabled={
                          changingStatusId ===
                          location.id
                        }
                      >
                        <option value="active">
                          Active
                        </option>

                        <option value="inactive">
                          Inactive
                        </option>
                      </select>
                    </td>

                    {/* =======================================
                        ACTIONS
                    ======================================= */}

                    <td>
                      <div className="location-actions">

                        <button
                          type="button"
                          className="location-action-edit"
                          onClick={() =>
                            handleEdit(location)
                          }
                          disabled={
                            deletingId ===
                            location.id
                          }
                        >
                          ✏️ Edit
                        </button>

                        <button
                          type="button"
                          className="location-action-delete"
                          onClick={() =>
                            handleDelete(location)
                          }
                          disabled={
                            deletingId ===
                            location.id
                          }
                        >
                          {deletingId ===
                          location.id
                            ? "Deleting..."
                            : "🗑️ Delete"}
                        </button>

                      </div>
                    </td>

                  </tr>
                )
              )}

            </tbody>
          </table>
        )}

      </div>
    </div>
  );
};

export default ListLocation;

