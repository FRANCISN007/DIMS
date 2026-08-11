
import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListCategory.css";

const ListCategory = ({ onClose }) => {
  /* =========================================================
     STATE
  ========================================================= */

  const [categories, setCategories] = useState([]);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const [newCategory, setNewCategory] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
     FETCH CATEGORIES
     ========================================================= */

  useEffect(() => {
    fetchCategories();
  }, []);


  const fetchCategories = async () => {
    try {
      setLoading(true);

      const response = await axiosWithAuth().get(
        "/store/categories"
      );

      console.log(
        "CATEGORY LIST RESPONSE:",
        response.data
      );

      setCategories(
        Array.isArray(response.data)
          ? response.data
          : []
      );

    } catch (error) {
      console.error(
        "Failed to fetch categories:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to view categories."
        );
      } else if (status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
      } else {
        setMessage(
          detail ||
            "Failed to load categories."
        );
      }

      setMessageType("error");

    } finally {
      setLoading(false);
    }
  };


  /* =========================================================
     CREATE CATEGORY
     ========================================================= */

  const handleCreate = async (e) => {
    e.preventDefault();

    const categoryName = newCategory.trim();

    if (!categoryName) {
      setMessage("Category name is required.");
      setMessageType("error");
      return;
    }

    if (creating) {
      return;
    }

    try {
      setCreating(true);

      /*
       * Business ID is intentionally NOT sent.
       *
       * The backend resolves the business from
       * the logged-in user.
       */
      const payload = {
        name: categoryName,
      };

      console.log(
        "CREATE CATEGORY PAYLOAD:",
        payload
      );

      const response = await axiosWithAuth().post(
        "/store/categories",
        payload
      );

      console.log(
        "CREATE CATEGORY RESPONSE:",
        response.data
      );

      setMessage(
        "Category created successfully."
      );
      setMessageType("success");

      setNewCategory("");

      /*
       * Add the newly created category immediately.
       * This avoids another request.
       */
      if (response.data) {
        setCategories((prev) => {
          const exists = prev.some(
            (cat) => cat.id === response.data.id
          );

          if (exists) {
            return prev;
          }

          return [...prev, response.data].sort(
            (a, b) =>
              (a.name || "").localeCompare(
                b.name || ""
              )
          );
        });
      } else {
        fetchCategories();
      }

    } catch (error) {
      console.error(
        "Create category error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "Category already exists."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to create a category."
        );
      } else if (status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
      } else {
        setMessage(
          detail ||
            "Failed to create category."
        );
      }

      setMessageType("error");

    } finally {
      setCreating(false);
    }
  };


  /* =========================================================
     START UPDATE
     ========================================================= */

  const handleStartUpdate = (category) => {
    setEditId(category.id);
    setEditName(category.name || "");

    setMessage("");
    setMessageType("");
  };


  /* =========================================================
     CANCEL UPDATE
     ========================================================= */

  const handleCancelUpdate = () => {
    if (updating) {
      return;
    }

    setEditId(null);
    setEditName("");
  };


  /* =========================================================
     UPDATE CATEGORY
     ========================================================= */

  const handleUpdate = async (id) => {
    const categoryName = editName.trim();

    if (!categoryName) {
      setMessage("Category name is required.");
      setMessageType("error");
      return;
    }

    if (updating) {
      return;
    }

    try {
      setUpdating(true);

      /*
       * Business ID is intentionally NOT sent.
       *
       * Backend resolves and validates the business.
       */
      const payload = {
        name: categoryName,
      };

      console.log(
        "UPDATE CATEGORY PAYLOAD:",
        payload
      );

      const response = await axiosWithAuth().put(
        `/store/categories/${id}`,
        payload
      );

      console.log(
        "UPDATE CATEGORY RESPONSE:",
        response.data
      );

      setCategories((prev) =>
        prev
          .map((category) =>
            category.id === id
              ? response.data
              : category
          )
          .sort((a, b) =>
            (a.name || "").localeCompare(
              b.name || ""
            )
          )
      );

      setEditId(null);
      setEditName("");

      setMessage(
        "Category updated successfully."
      );
      setMessageType("success");

    } catch (error) {
      console.error(
        "Update category error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 400) {
        setMessage(
          detail ||
            "Category name already exists."
        );
      } else if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to update this category."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Category not found."
        );
      } else if (status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
      } else {
        setMessage(
          detail ||
            "Failed to update category."
        );
      }

      setMessageType("error");

    } finally {
      setUpdating(false);
    }
  };


  /* =========================================================
     DELETE CATEGORY
     ========================================================= */

  const handleDelete = async (id) => {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this category?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(id);

      console.log(
        "DELETE CATEGORY:",
        id
      );

      const response = await axiosWithAuth().delete(
        `/store/categories/${id}`
      );

      console.log(
        "DELETE CATEGORY RESPONSE:",
        response.data
      );

      setCategories((prev) =>
        prev.filter(
          (category) => category.id !== id
        )
      );

      setMessage(
        response?.data?.detail ||
          "Category deleted successfully."
      );
      setMessageType("success");

    } catch (error) {
      console.error(
        "Delete category error:",
        error?.response?.data || error
      );

      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 403) {
        setMessage(
          detail ||
            "You do not have permission to delete this category."
        );
      } else if (status === 404) {
        setMessage(
          detail ||
            "Category not found."
        );
      } else if (status === 400) {
        setMessage(
          detail ||
            "This category cannot be deleted."
        );
      } else if (status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
      } else {
        setMessage(
          detail ||
            "Failed to delete category."
        );
      }

      setMessageType("error");

    } finally {
      setDeletingId(null);
    }
  };


  /* =========================================================
     CLOSE
     ========================================================= */

  const handleClose = () => {
    if (creating || updating || deletingId !== null) {
      return;
    }

    if (typeof onClose === "function") {
      onClose();
    }
  };


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="category-list-container">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="form-header">

        <div>
          <h2>📃 List of Categories</h2>

          <p>
            Manage store item categories.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={handleClose}
            disabled={
              creating ||
              updating ||
              deletingId !== null
            }
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        )}

      </div>


      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message && (
        <div
          className={`category-message ${
            messageType === "success"
              ? "category-message-success"
              : "category-message-error"
          }`}
        >
          <span className="category-message-icon">
            {messageType === "success"
              ? "✓"
              : "⚠"}
          </span>

          <span>{message}</span>
        </div>
      )}


      {/* =====================================================
          CREATE CATEGORY
      ===================================================== */}

      <form
        className="create-category-form"
        onSubmit={handleCreate}
      >

        <div className="category-input-group">

          <label htmlFor="newCategory">
            New Category
            <span className="required">*</span>
          </label>

          <input
            id="newCategory"
            type="text"
            value={newCategory}
            onChange={(e) => {
              setNewCategory(e.target.value);

              if (message) {
                setMessage("");
                setMessageType("");
              }
            }}
            placeholder="e.g. Food Stuffs, Water"
            maxLength={100}
            disabled={creating}
            autoComplete="off"
          />

        </div>

        <button
          type="submit"
          className="create-btn"
          disabled={creating}
        >
          {creating ? (
            <>
              <span className="category-spinner"></span>
              Creating...
            </>
          ) : (
            "➕ Create Category"
          )}
        </button>

      </form>


      {/* =====================================================
          CATEGORY TABLE
      ===================================================== */}

      <div className="category-table-wrapper">

        <table className="category-table">

          <thead>
            <tr>
              <th>Id</th>
              <th>Category Name</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {loading ? (

              <tr>
                <td
                  colSpan="3"
                  className="category-loading"
                >
                  Loading categories...
                </td>
              </tr>

            ) : categories.length === 0 ? (

              <tr>
                <td
                  colSpan="3"
                  className="category-empty"
                >
                  No categories found.
                </td>
              </tr>

            ) : (

              categories.map((category, index) => (

                <tr
                  key={category.id}
                  className={
                    index % 2 === 0
                      ? "even-row"
                      : "odd-row"
                  }
                >

                  <td>
                    {category.id}
                  </td>


                  <td>

                    {editId === category.id ? (

                      <input
                        type="text"
                        className="edit-category-input"
                        value={editName}
                        onChange={(e) =>
                          setEditName(
                            e.target.value
                          )
                        }
                        maxLength={100}
                        disabled={updating}
                        autoFocus
                      />

                    ) : (

                      category.name

                    )}

                  </td>


                  <td>

                    {editId === category.id ? (

                      <>

                        <button
                          type="button"
                          className="action-btn save"
                          onClick={() =>
                            handleUpdate(
                              category.id
                            )
                          }
                          disabled={updating}
                        >
                          {updating ? (
                            <>
                              <span className="category-spinner small"></span>
                              Saving...
                            </>
                          ) : (
                            "💾 Save"
                          )}
                        </button>


                        <button
                          type="button"
                          className="action-btn cancel"
                          onClick={
                            handleCancelUpdate
                          }
                          disabled={updating}
                        >
                          ❌ Cancel
                        </button>

                      </>

                    ) : (

                      <>

                        <button
                          type="button"
                          className="action-btn update"
                          onClick={() =>
                            handleStartUpdate(
                              category
                            )
                          }
                          disabled={
                            deletingId !== null
                          }
                        >
                          ✏️ Update
                        </button>


                        <button
                          type="button"
                          className="action-btn delete"
                          onClick={() =>
                            handleDelete(
                              category.id
                            )
                          }
                          disabled={
                            deletingId !== null
                          }
                        >
                          {deletingId ===
                          category.id ? (
                            <>
                              <span className="category-spinner small"></span>
                              Deleting...
                            </>
                          ) : (
                            "🗑️ Delete"
                          )}
                        </button>

                      </>

                    )}

                  </td>

                </tr>

              ))

            )}

          </tbody>

        </table>

      </div>

    </div>
  );
};

export default ListCategory;

