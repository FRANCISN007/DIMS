
// src/components/catering/ListCateringAdjustment.jsx

import React, { useEffect, useMemo, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListCateringAdjustment.css";

const ListCateringAdjustment = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingAdjustment, setEditingAdjustment] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editItemSearch, setEditItemSearch] = useState("");
  const [showEditItemResults, setShowEditItemResults] = useState(false);

  const [editForm, setEditForm] = useState({
    location_id: "",
    item_id: "",
    quantity_adjusted: "",
    reason: "",
  });

  // ==========================================================
  // MESSAGE
  // ==========================================================

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000);
  };

  // ==========================================================
  // FETCH LOCATIONS
  // ==========================================================

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);

      const response = await axiosWithAuth().get(
        "/locations/simple"
      );

      setLocations(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Error loading locations:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to load locations.",
        "error"
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  // ==========================================================
  // FETCH ITEMS
  // ==========================================================

  const fetchItems = async () => {
    try {
      setLoadingItems(true);

      const response = await axiosWithAuth().get(
        "/store/items/simple-search"
      );

      setItems(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Error loading items:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to load items.",
        "error"
      );
    } finally {
      setLoadingItems(false);
    }
  };

  // ==========================================================
  // FETCH ADJUSTMENTS
  // ==========================================================

  const fetchAdjustments = async () => {
    try {
      setLoading(true);

      const params = {};

      if (locationFilter) {
        params.location_id =
          Number(locationFilter);
      }

      if (itemFilter) {
        params.item_id =
          Number(itemFilter);
      }

      /*
       * Backend accepts datetime.
       *
       * Start date:
       * 00:00:00
       *
       * End date:
       * 23:59:59
       */

      if (startDate) {
        params.start_date =
          `${startDate}T00:00:00`;
      }

      if (endDate) {
        params.end_date =
          `${endDate}T23:59:59`;
      }

      const response =
        await axiosWithAuth().get(
          "/catering/location/adjustments",
          { params }
        );

      setAdjustments(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Error loading adjustments:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to load adjustments.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    fetchLocations();
    fetchItems();
    fetchAdjustments();
  }, []);

  // ==========================================================
  // APPLY FILTERS
  // ==========================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdjustments();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    locationFilter,
    itemFilter,
    startDate,
    endDate,
  ]);

  // ==========================================================
  // SEARCH RESULTS
  // ==========================================================

  const filteredAdjustments = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    if (!searchValue) {
      return adjustments;
    }

    return adjustments.filter(
      (adjustment) => {
        const locationName =
          adjustment.location_name ||
          "";

        const itemName =
          adjustment.item_name ||
          "";

        const reason =
          adjustment.reason || "";

        const adjustedBy =
          adjustment.adjusted_by ||
          "";

        return (
          locationName
            .toLowerCase()
            .includes(searchValue) ||
          itemName
            .toLowerCase()
            .includes(searchValue) ||
          reason
            .toLowerCase()
            .includes(searchValue) ||
          adjustedBy
            .toLowerCase()
            .includes(searchValue)
        );
      }
    );
  }, [adjustments, search]);

  // ==========================================================
  // EDIT ITEM SEARCH
  // ==========================================================

  const editItemResults = useMemo(() => {
    const value =
      editItemSearch.trim().toLowerCase();

    if (!value) {
      return items.slice(0, 30);
    }

    return items
      .filter((item) =>
        String(item.name || "")
          .toLowerCase()
          .includes(value)
      )
      .slice(0, 30);
  }, [items, editItemSearch]);

  // ==========================================================
  // SELECT EDIT ITEM
  // ==========================================================

  const selectEditItem = (item) => {
    setEditForm((prev) => ({
      ...prev,
      item_id: item.id,
    }));

    setEditItemSearch(item.name || "");
    setShowEditItemResults(false);
  };

  // ==========================================================
  // CLEAR EDIT ITEM
  // ==========================================================

  const clearEditItem = () => {
    setEditForm((prev) => ({
      ...prev,
      item_id: "",
    }));

    setEditItemSearch("");
    setShowEditItemResults(true);
  };

  // ==========================================================
  // EDIT FORM CHANGE
  // ==========================================================

  const handleEditChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ==========================================================
  // OPEN EDIT
  // ==========================================================

  const openEditModal = (adjustment) => {
    setEditingAdjustment(adjustment);

    setEditForm({
      location_id:
        adjustment.location_id || "",
      item_id:
        adjustment.item_id || "",
      quantity_adjusted:
        adjustment.quantity_adjusted ?? "",
      reason:
        adjustment.reason || "",
    });

    setEditItemSearch(
      adjustment.item_name || ""
    );

    setShowEditItemResults(false);
  };

  // ==========================================================
  // CLOSE EDIT
  // ==========================================================

  const closeEditModal = () => {
    if (savingEdit) {
      return;
    }

    setEditingAdjustment(null);

    setEditForm({
      location_id: "",
      item_id: "",
      quantity_adjusted: "",
      reason: "",
    });

    setEditItemSearch("");
    setShowEditItemResults(false);
  };

  // ==========================================================
  // SUBMIT EDIT
  // ==========================================================

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (!editForm.location_id) {
      showMessage(
        "Please select a location.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // ITEM
    // --------------------------------------------------------

    if (!editForm.item_id) {
      showMessage(
        "Please select an item.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // QUANTITY
    // --------------------------------------------------------

    if (
      editForm.quantity_adjusted === "" ||
      editForm.quantity_adjusted === null
    ) {
      showMessage(
        "Please enter an adjustment quantity.",
        "error"
      );

      return;
    }

    const quantity = Number(
      editForm.quantity_adjusted
    );

    if (Number.isNaN(quantity)) {
      showMessage(
        "Please enter a valid adjustment quantity.",
        "error"
      );

      return;
    }

    if (quantity === 0) {
      showMessage(
        "Adjustment cannot be zero.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    try {
      setSavingEdit(true);

      const payload = {
        location_id:
          Number(editForm.location_id),

        item_id:
          Number(editForm.item_id),

        quantity_adjusted:
          quantity,

        reason:
          editForm.reason.trim() || null,
      };

      const response =
        await axiosWithAuth().put(
          `/catering/location/adjustments/${editingAdjustment.id}`,
          payload
        );

      console.log(
        "Adjustment updated:",
        response.data
      );

      showMessage(
        "Inventory adjustment updated successfully.",
        "success"
      );

      closeEditModal();

      await fetchAdjustments();
    } catch (error) {
      console.error(
        "Update adjustment error:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to update inventory adjustment.",
        "error"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = async (adjustment) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this adjustment?\n\n` +
        `Item: ${adjustment.item_name}\n` +
        `Location: ${adjustment.location_name}\n` +
        `Quantity: ${formatQuantity(
          adjustment.quantity_adjusted
        )}\n\n` +
        `This will reverse the inventory adjustment.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(adjustment.id);

      await axiosWithAuth().delete(
        `/catering/location/adjustments/${adjustment.id}`
      );

      showMessage(
        "Inventory adjustment deleted successfully.",
        "success"
      );

      await fetchAdjustments();
    } catch (error) {
      console.error(
        "Delete adjustment error:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to delete inventory adjustment.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setItemFilter("");
    setStartDate("");
    setEndDate("");
  };

  // ==========================================================
  // FORMAT QUANTITY
  // ==========================================================

  const formatQuantity = (value) => {
    const number = Number(value);

    if (Number.isNaN(number)) {
      return value ?? "-";
    }

    return Number.isInteger(number)
      ? number
      : number.toFixed(2);
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(
      "en-NG",
      {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // ==========================================================
  // GET SELECTED EDIT ITEM
  // ==========================================================

  const selectedEditItem = items.find(
    (item) =>
      Number(item.id) ===
      Number(editForm.item_id)
  );

  // ==========================================================
  // EDIT QUANTITY TYPE
  // ==========================================================

  const editQuantity =
    Number(editForm.quantity_adjusted);

  const editAdjustmentType =
    !editForm.quantity_adjusted ||
    Number.isNaN(editQuantity)
      ? ""
      : editQuantity > 0
      ? "addition"
      : "removal";

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="list-catering-adjustment-container">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="list-adjustment-header">

        <div>
          <h2>
            List Inventory Adjustments
          </h2>

          <p>
            View, edit and manage catering
            location inventory adjustments.
          </p>
        </div>

        <div className="adjustment-count">
          {filteredAdjustments.length}{" "}
          record
          {filteredAdjustments.length !== 1
            ? "s"
            : ""}
        </div>

      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <div
          className={`adjustment-list-message ${
            messageType === "error"
              ? "adjustment-list-error"
              : "adjustment-list-success"
          }`}
        >
          {message}
        </div>
      )}

      {/* ====================================================
          FILTER CARD
      ==================================================== */}

      <div className="adjustment-filter-card">

        <div className="adjustment-filter-row">

          {/* SEARCH */}

          <div className="adjustment-search-group">

            <label>
              Search
            </label>

            <div className="adjustment-search-wrapper">

              <span className="search-icon">
                🔍
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search item, location, reason..."
              />

              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() =>
                    setSearch("")
                  }
                >
                  ×
                </button>
              )}

            </div>

          </div>

          {/* LOCATION */}

          <div className="adjustment-filter-group">

            <label>
              Location
            </label>

            <select
              value={locationFilter}
              onChange={(e) =>
                setLocationFilter(
                  e.target.value
                )
              }
              disabled={loadingLocations}
            >
              <option value="">
                All Locations
              </option>

              {locations.map(
                (location) => (
                  <option
                    key={location.id}
                    value={location.id}
                  >
                    {location.name}
                  </option>
                )
              )}

            </select>

          </div>

          {/* ITEM */}

          <div className="adjustment-filter-group">

            <label>
              Item
            </label>

            <select
              value={itemFilter}
              onChange={(e) =>
                setItemFilter(
                  e.target.value
                )
              }
              disabled={loadingItems}
            >
              <option value="">
                All Items
              </option>

              {items.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

        <div className="adjustment-filter-row adjustment-date-row">

          {/* START DATE */}

          <div className="adjustment-filter-group">

            <label>
              From Date
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
            />

          </div>

          {/* END DATE */}

          <div className="adjustment-filter-group">

            <label>
              To Date
            </label>

            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setEndDate(
                  e.target.value
                )
              }
            />

          </div>

          <div className="filter-actions">

            <button
              type="button"
              className="clear-filters-btn"
              onClick={clearFilters}
              disabled={
                !search &&
                !locationFilter &&
                !itemFilter &&
                !startDate &&
                !endDate
              }
            >
              Clear Filters
            </button>

          </div>

        </div>

      </div>

      {/* ====================================================
          TABLE
      ==================================================== */}

      <div className="adjustment-table-card">

        <div className="adjustment-table-wrapper">

          {loading ? (
            <div className="adjustment-loading">
              <div className="adjustment-spinner"></div>
              <span>
                Loading adjustments...
              </span>
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="adjustment-empty">

              <div className="empty-icon">
                ADJ
              </div>

              <h3>
                No adjustments found
              </h3>

              <p>
                No inventory adjustments match
                your current filters.
              </p>

            </div>
          ) : (
            <table className="adjustment-table">

              <thead>
                <tr>

                  <th>
                    Date
                  </th>

                  <th>
                    Location
                  </th>

                  <th>
                    Item
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Quantity
                  </th>

                  <th>
                    Remaining
                  </th>

                  <th>
                    Reason
                  </th>

                  <th>
                    Adjusted By
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {filteredAdjustments.map(
                  (adjustment) => {

                    const quantity =
                      Number(
                        adjustment.quantity_adjusted
                      );

                    const isAddition =
                      quantity > 0;

                    const isDeleting =
                      deletingId ===
                      adjustment.id;

                    return (
                      <tr
                        key={
                          adjustment.id
                        }
                      >

                        <td>
                          <div className="date-cell">
                            {formatDate(
                              adjustment.adjusted_at
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="location-cell">
                            {
                              adjustment.location_name ||
                              "-"
                            }
                          </div>
                        </td>

                        <td>
                          <div className="item-cell">

                            <strong>
                              {
                                adjustment.item_name ||
                                "-"
                              }
                            </strong>

                            <span>
                              {adjustment.unit ||
                                ""}
                            </span>

                          </div>
                        </td>

                        <td>

                          {isAddition ? (
                            <span className="adjustment-badge adjustment-badge-addition">
                              + Addition
                            </span>
                          ) : (
                            <span className="adjustment-badge adjustment-badge-removal">
                              − Removal
                            </span>
                          )}

                        </td>

                        <td>

                          <strong
                            className={
                              isAddition
                                ? "quantity-addition"
                                : "quantity-removal"
                            }
                          >
                            {isAddition
                              ? "+"
                              : ""}
                            {formatQuantity(
                              adjustment.quantity_adjusted
                            )}
                          </strong>

                        </td>

                        <td>
                          <span className="remaining-quantity">
                            {formatQuantity(
                              adjustment.remaining_quantity
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="reason-cell">
                            {
                              adjustment.reason ||
                              "—"
                            }
                          </div>
                        </td>

                        <td>
                          <span className="adjusted-by">
                            {
                              adjustment.adjusted_by ||
                              "-"
                            }
                          </span>
                        </td>

                        <td>

                          <div className="action-buttons">

                            <button
                              type="button"
                              className="edit-adjustment-btn"
                              onClick={() =>
                                openEditModal(
                                  adjustment
                                )
                              }
                              disabled={
                                isDeleting
                              }
                              title="Edit adjustment"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="delete-adjustment-btn"
                              onClick={() =>
                                handleDelete(
                                  adjustment
                                )
                              }
                              disabled={
                                isDeleting
                              }
                              title="Delete adjustment"
                            >
                              {isDeleting
                                ? "..."
                                : "Delete"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>
          )}

        </div>

      </div>

      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {editingAdjustment && (
        <div
          className="adjustment-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >

          <div className="adjustment-edit-modal">

            {/* MODAL HEADER */}

            <div className="adjustment-modal-header">

              <div>
                <h3>
                  Edit Inventory Adjustment
                </h3>

                <p>
                  Update the adjustment details.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={
                  closeEditModal
                }
                disabled={
                  savingEdit
                }
              >
                ×
              </button>

            </div>

            {/* MODAL BODY */}

            <form
              onSubmit={
                handleEditSubmit
              }
            >

              <div className="adjustment-modal-body">

                {/* LOCATION */}

                <div className="modal-form-group">

                  <label>
                    Location
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    name="location_id"
                    value={
                      editForm.location_id
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      savingEdit ||
                      loadingLocations
                    }
                  >

                    <option value="">
                      Select Location
                    </option>

                    {locations.map(
                      (location) => (
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

                </div>

                {/* ITEM SEARCH */}

                <div className="modal-form-group edit-item-search-group">

                  <label>
                    Item
                    <span className="required">
                      *
                    </span>
                  </label>

                  <div className="edit-item-search-wrapper">

                    <div className="edit-item-input-wrapper">

                      <input
                        type="text"
                        value={
                          editItemSearch
                        }
                        onChange={(e) => {
                          setEditItemSearch(
                            e.target.value
                          );

                          setEditForm(
                            (prev) => ({
                              ...prev,
                              item_id: "",
                            })
                          );

                          setShowEditItemResults(
                            true
                          );
                        }}
                        onFocus={() =>
                          setShowEditItemResults(
                            true
                          )
                        }
                        disabled={
                          savingEdit ||
                          loadingItems
                        }
                        placeholder={
                          loadingItems
                            ? "Loading items..."
                            : "Search item..."
                        }
                        autoComplete="off"
                      />

                      {editItemSearch && (
                        <button
                          type="button"
                          className="edit-item-clear-btn"
                          onClick={
                            clearEditItem
                          }
                          disabled={
                            savingEdit
                          }
                        >
                          ×
                        </button>
                      )}

                    </div>

                    {showEditItemResults &&
                      editItemSearch.trim() &&
                      editItemResults.length >
                        0 && (
                        <div className="edit-item-results">

                          {editItemResults.map(
                            (item) => (
                              <button
                                type="button"
                                key={
                                  item.id
                                }
                                className="edit-item-result"
                                onClick={() =>
                                  selectEditItem(
                                    item
                                  )
                                }
                              >

                                <span className="edit-item-result-name">
                                  {
                                    item.name
                                  }
                                </span>

                                <span className="edit-item-result-id">
                                  ID:{" "}
                                  {
                                    item.id
                                  }
                                </span>

                              </button>
                            )
                          )}

                        </div>
                      )}

                    {showEditItemResults &&
                      editItemSearch.trim() &&
                      editItemResults.length ===
                        0 && (
                        <div className="edit-item-no-results">
                          No items found.
                        </div>
                      )}

                  </div>

                  {editForm.item_id &&
                    selectedEditItem && (
                      <div className="edit-selected-item">

                        <div className="selected-item-check">
                          ✓
                        </div>

                        <div>
                          <strong>
                            {
                              selectedEditItem.name
                            }
                          </strong>

                          <span>
                            Selected item
                          </span>
                        </div>

                      </div>
                    )}

                </div>

                {/* QUANTITY */}

                <div className="modal-form-group">

                  <label>
                    Adjustment Quantity
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    type="number"
                    name="quantity_adjusted"
                    value={
                      editForm.quantity_adjusted
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      savingEdit
                    }
                    step="0.01"
                    placeholder="e.g. 10 or -10"
                  />

                  {editAdjustmentType && (
                    <div
                      className={
                        editAdjustmentType ===
                        "addition"
                          ? "edit-type-addition"
                          : "edit-type-removal"
                      }
                    >
                      {editAdjustmentType ===
                      "addition"
                        ? "＋ Stock will be added"
                        : "− Stock will be removed"}
                    </div>
                  )}

                </div>

                {/* REASON */}

                <div className="modal-form-group">

                  <label>
                    Reason
                  </label>

                  <textarea
                    name="reason"
                    value={
                      editForm.reason
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      savingEdit
                    }
                    rows="3"
                    placeholder="Enter the reason..."
                  />

                </div>

              </div>

              {/* MODAL FOOTER */}

              <div className="adjustment-modal-footer">

                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    savingEdit
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-save-btn"
                  disabled={
                    savingEdit
                  }
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default ListCateringAdjustment;

