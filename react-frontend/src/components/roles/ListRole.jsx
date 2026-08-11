
import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRole.css";

const ListRole = () => {
  /* =========================================================
     STATE
  ========================================================= */

  const [roles, setRoles] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [editingRole, setEditingRole] = useState(null);

  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    description: "",
    status: "active",
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [changingStatusId, setChangingStatusId] = useState(null);

  /* =========================================================
     AUTO HIDE SUCCESS / ERROR MESSAGE
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
     FETCH ROLES
  ========================================================= */

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setMessage("");
      setMessageType("");

      const params = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await axiosWithAuth().get("/roles", {
        params,
      });

      const data = Array.isArray(response.data)
        ? response.data
        : [];

      setRoles(data);
    } catch (error) {
      console.error(
        "Failed to load roles:",
        error?.response?.data || error
      );

      setRoles([]);

      setMessage(
        error?.response?.data?.detail ||
          "Failed to load roles."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchRoles();
  }, []);

  /* =========================================================
     SEARCH
  ========================================================= */

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRoles();
  };

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("");

    fetchRolesWithoutFilters();
  };

  const fetchRolesWithoutFilters = async () => {
    try {
      setLoading(true);
      setMessage("");
      setMessageType("");

      const response = await axiosWithAuth().get("/roles");

      const data = Array.isArray(response.data)
        ? response.data
        : [];

      setRoles(data);
    } catch (error) {
      console.error(
        "Failed to load roles:",
        error?.response?.data || error
      );

      setRoles([]);

      setMessage(
        error?.response?.data?.detail ||
          "Failed to load roles."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     EDIT ROLE
  ========================================================= */

  const handleEdit = (role) => {
    setEditingRole(role);

    setEditForm({
      name: role.name || "",
      code: role.code || "",
      description: role.description || "",
      status: role.status || "active",
    });

    setMessage("");
    setMessageType("");
  };

  /* =========================================================
     EDIT INPUT
  ========================================================= */

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* =========================================================
     CANCEL EDIT
  ========================================================= */

  const handleCancelEdit = () => {
    setEditingRole(null);

    setEditForm({
      name: "",
      code: "",
      description: "",
      status: "active",
    });
  };

  /* =========================================================
     SAVE EDIT
  ========================================================= */

  const handleSaveEdit = async (e) => {
    e.preventDefault();

    if (!editForm.name.trim()) {
      setMessage("Role name is required.");
      setMessageType("error");
      return;
    }

    try {
      setSavingEdit(true);
      setMessage("");
      setMessageType("");

      const payload = {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        description:
          editForm.description.trim() || null,
        status: editForm.status,
      };

      const response = await axiosWithAuth().put(
        `/roles/${editingRole.id}`,
        payload
      );

      const updatedRole = response.data;

      /* Update table immediately */
      setRoles((prevRoles) =>
        prevRoles.map((role) =>
          role.id === updatedRole.id
            ? updatedRole
            : role
        )
      );

      setEditingRole(null);

      setEditForm({
        name: "",
        code: "",
        description: "",
        status: "active",
      });

      setMessage("Role updated successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(
        "Update role error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "Role name or code already exists."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to update this role."
        );
      } else if (status === 404) {
        setMessage(
          detail || "Role not found."
        );
      } else {
        setMessage(
          detail || "Failed to update role."
        );
      }

      setMessageType("error");
    } finally {
      setSavingEdit(false);
    }
  };

  /* =========================================================
     CHANGE STATUS
  ========================================================= */

  const handleStatusChange = async (role, newStatus) => {
    if (!newStatus || newStatus === role.status) {
      return;
    }

    try {
      setChangingStatusId(role.id);

      setMessage("");
      setMessageType("");

      const response = await axiosWithAuth().patch(
        `/roles/${role.id}/status`,
        {
          status: newStatus,
        }
      );

      const updatedRole = response.data;

      setRoles((prevRoles) =>
        prevRoles.map((item) =>
          item.id === updatedRole.id
            ? updatedRole
            : item
        )
      );

      /* Keep edit form synchronized */
      if (
        editingRole &&
        editingRole.id === updatedRole.id
      ) {
        setEditingRole(updatedRole);

        setEditForm((prev) => ({
          ...prev,
          status: updatedRole.status,
        }));
      }

      setMessage(
        `Role "${role.name}" is now ${newStatus}.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Change role status error:",
        error?.response?.data || error
      );

      setMessage(
        error?.response?.data?.detail ||
          "Failed to change role status."
      );

      setMessageType("error");
    } finally {
      setChangingStatusId(null);
    }
  };

  /* =========================================================
     DELETE ROLE
  ========================================================= */

  const handleDelete = async (role) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the role "${role.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(role.id);

      setMessage("");
      setMessageType("");

      await axiosWithAuth().delete(
        `/roles/${role.id}`
      );

      /* Remove immediately from table */
      setRoles((prevRoles) =>
        prevRoles.filter(
          (item) => item.id !== role.id
        )
      );

      /* Close edit form if deleted role was being edited */
      if (
        editingRole &&
        editingRole.id === role.id
      ) {
        handleCancelEdit();
      }

      setMessage("Role deleted successfully.");
      setMessageType("success");
    } catch (error) {
      console.error(
        "Delete role error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "This role cannot be deleted."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to delete this role."
        );
      } else if (status === 404) {
        setMessage(
          detail || "Role not found."
        );
      } else {
        setMessage(
          detail || "Failed to delete role."
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
    <div className="list-role-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="list-role-header">
        <div>
          <h2>Roles</h2>

          <p>
            Manage roles and their access status.
          </p>
        </div>

        <div className="role-count">
          {roles.length}{" "}
          {roles.length === 1 ? "Role" : "Roles"}
        </div>
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

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

      {/* =====================================================
          SEARCH / FILTER
      ===================================================== */}

      <div className="role-filter-bar">

        <form
          className="role-search-form"
          onSubmit={handleSearch}
        >
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search role name or code..."
            className="role-search-input"
          />

          <button
            type="submit"
            className="role-search-button"
          >
            🔍 Search
          </button>
        </form>

        <div className="role-status-filter">

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="role-filter-select"
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
            className="role-filter-button"
            onClick={fetchRoles}
          >
            Filter
          </button>

          <button
            type="button"
            className="role-clear-button"
            onClick={handleClearFilters}
          >
            Clear
          </button>

        </div>
      </div>

      {/* =====================================================
          EDIT FORM
      ===================================================== */}

      {editingRole && (
        <div className="role-edit-panel">

          <div className="role-edit-header">

            <div>
              <h3>Edit Role</h3>

              <span>
                Editing: {editingRole.name}
              </span>
            </div>

            <button
              type="button"
              className="role-edit-close"
              onClick={handleCancelEdit}
              disabled={savingEdit}
              aria-label="Close edit"
            >
              ×
            </button>

          </div>

          <form
            className="role-edit-form"
            onSubmit={handleSaveEdit}
          >

            <div className="role-edit-group">

              <label>
                Role Name
                <span className="required">
                  *
                </span>
              </label>

              <input
                type="text"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                maxLength={100}
                disabled={savingEdit}
              />

            </div>

            <div className="role-edit-group">

              <label>
                Role Code
              </label>

              <input
                type="text"
                name="code"
                value={editForm.code}
                onChange={handleEditChange}
                maxLength={50}
                disabled={savingEdit}
              />

            </div>

            <div className="role-edit-group role-edit-description">

              <label>
                Description
              </label>

              <textarea
                name="description"
                value={editForm.description}
                onChange={handleEditChange}
                rows={2}
                maxLength={500}
                disabled={savingEdit}
              />

            </div>

            <div className="role-edit-group">

              <label>
                Status
              </label>

              <select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                disabled={savingEdit}
              >
                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

            </div>

            <div className="role-edit-actions">

              <button
                type="button"
                className="role-edit-cancel"
                onClick={handleCancelEdit}
                disabled={savingEdit}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="role-edit-save"
                disabled={savingEdit}
              >
                {savingEdit
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </form>
        </div>
      )}

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="roles-table-container">

        {loading ? (
          <div className="roles-loading">
            <span className="role-loading-spinner"></span>
            Loading roles...
          </div>

        ) : roles.length === 0 ? (

          <div className="roles-empty">

            <div className="roles-empty-icon">
              🏷️
            </div>

            <h3>
              No roles found
            </h3>

            <p>
              No roles match the current search
              or filter.
            </p>

          </div>

        ) : (

          <table className="roles-table">

            <thead>
              <tr>
                <th>S/N</th>
                <th>ID</th>
                <th>Role Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {roles.map((role, index) => (

                <tr key={role.id}>

                  <td>
                    {index + 1}
                  </td>

                  <td className="role-id-cell">
                    {role.id || "—"}
                  </td>

                  <td className="role-name-cell">
                    {role.name || "—"}
                  </td>

                  <td>
                    <span className="role-code">
                      {role.code || "—"}
                    </span>
                  </td>

                  <td className="role-description-cell">
                    {role.description || "—"}
                  </td>

                  <td>

                    <select
                      className={`role-status-select ${
                        role.status === "active"
                          ? "status-active"
                          : "status-inactive"
                      }`}
                      value={
                        role.status || "inactive"
                      }
                      onChange={(e) =>
                        handleStatusChange(
                          role,
                          e.target.value
                        )
                      }
                      disabled={
                        changingStatusId ===
                        role.id
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

                  <td>

                    <div className="role-actions">

                      <button
                        type="button"
                        className="role-action-edit"
                        onClick={() =>
                          handleEdit(role)
                        }
                        title="Edit role"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        className="role-action-delete"
                        onClick={() =>
                          handleDelete(role)
                        }
                        disabled={
                          deletingId === role.id
                        }
                        title="Delete role"
                      >
                        {deletingId === role.id
                          ? "Deleting..."
                          : "🗑️ Delete"}
                      </button>

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

      </div>

    </div>
  );
};

export default ListRole;
