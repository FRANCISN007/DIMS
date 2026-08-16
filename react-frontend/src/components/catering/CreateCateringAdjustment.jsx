
// src/components/catering/CreateCateringAdjustment.jsx

import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateCateringAdjustment.css";

const CreateCateringAdjustment = () => {
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [itemSearch, setItemSearch] = useState("");
  const [showItemResults, setShowItemResults] = useState(false);

  const [form, setForm] = useState({
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
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    fetchLocations();
    fetchItems();
  }, []);

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ==========================================================
  // ITEM SEARCH CHANGE
  // ==========================================================

  const handleItemSearchChange = (e) => {
    const value = e.target.value;

    setItemSearch(value);

    // If user starts typing again,
    // remove the previous selection.
    setForm((prev) => ({
      ...prev,
      item_id: "",
    }));

    setShowItemResults(true);
  };

  // ==========================================================
  // SELECT ITEM
  // ==========================================================

  const handleSelectItem = (item) => {
    setForm((prev) => ({
      ...prev,
      item_id: item.id,
    }));

    setItemSearch(item.name);

    setShowItemResults(false);
  };

  // ==========================================================
  // CLEAR ITEM
  // ==========================================================

  const clearSelectedItem = () => {
    setForm((prev) => ({
      ...prev,
      item_id: "",
    }));

    setItemSearch("");
    setShowItemResults(true);
  };

  // ==========================================================
  // RESET FORM
  // ==========================================================

  const resetForm = () => {
    setForm({
      location_id: "",
      item_id: "",
      quantity_adjusted: "",
      reason: "",
    });

    setItemSearch("");
    setShowItemResults(false);
  };

  // ==========================================================
  // FILTER ITEMS
  // ==========================================================

  const filteredItems = items.filter((item) => {
    const search = itemSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return true;
    }

    return (
      String(item.name || "")
        .toLowerCase()
        .includes(search) ||
      String(item.id || "")
        .toLowerCase()
        .includes(search)
    );
  });

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --------------------------------------------------------
    // LOCATION VALIDATION
    // --------------------------------------------------------

    if (!form.location_id) {
      showMessage(
        "Please select a location.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // ITEM VALIDATION
    // --------------------------------------------------------

    if (!form.item_id) {
      showMessage(
        "Please select an item from the search results.",
        "error"
      );

      return;
    }

    // --------------------------------------------------------
    // QUANTITY VALIDATION
    // --------------------------------------------------------

    if (
      form.quantity_adjusted === "" ||
      form.quantity_adjusted === null
    ) {
      showMessage(
        "Please enter an adjustment quantity.",
        "error"
      );

      return;
    }

    const quantity = Number(
      form.quantity_adjusted
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
    // SUBMIT
    // --------------------------------------------------------

    try {
      setSaving(true);

      const payload = {
        location_id: Number(
          form.location_id
        ),

        item_id: Number(
          form.item_id
        ),

        quantity_adjusted: quantity,

        reason:
          form.reason.trim() || null,
      };

      const response =
        await axiosWithAuth().post(
          "/catering/location/adjust",
          payload
        );

      console.log(
        "Adjustment created:",
        response.data
      );

      showMessage(
        "Location inventory adjustment created successfully.",
        "success"
      );

      resetForm();

    } catch (error) {
      console.error(
        "Create adjustment error:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to create inventory adjustment.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // SELECTED DATA
  // ==========================================================

  const selectedLocation = locations.find(
    (location) =>
      Number(location.id) ===
      Number(form.location_id)
  );

  const selectedItem = items.find(
    (item) =>
      Number(item.id) ===
      Number(form.item_id)
  );

  // ==========================================================
  // QUANTITY TYPE
  // ==========================================================

  const adjustmentQuantity =
    Number(form.quantity_adjusted);

  const adjustmentType =
    !form.quantity_adjusted ||
    Number.isNaN(adjustmentQuantity)
      ? ""
      : adjustmentQuantity > 0
      ? "addition"
      : "removal";

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="create-catering-adjustment-container">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="create-adjustment-header">

        <div className="adjustment-title-section">

          <div className="adjustment-title-icon">
            ADJ
          </div>

          <div>
            <h2>
              Create Inventory Adjustment
            </h2>

            <p>
              Add or remove inventory from
              a catering location.
            </p>
          </div>

        </div>

      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <div
          className={`adjustment-message ${
            messageType === "error"
              ? "adjustment-error-message"
              : "adjustment-success-message"
          }`}
        >
          {message}
        </div>
      )}

      {/* ====================================================
          FORM CARD
      ==================================================== */}

      <div className="create-adjustment-card">

        <form onSubmit={handleSubmit}>

          {/* ==================================================
              BASIC INFORMATION
          ================================================== */}

          <div className="adjustment-section">

            <div className="adjustment-section-title">

              <div>
                <h3>
                  Adjustment Details
                </h3>

                <span>
                  Select the location and
                  inventory item to adjust.
                </span>
              </div>

            </div>

            <div className="adjustment-form-grid">

              {/* LOCATION */}

              <div className="adjustment-form-group">

                <label>
                  Location
                  <span className="required">
                    *
                  </span>
                </label>

                <select
                  name="location_id"
                  value={
                    form.location_id
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    loadingLocations
                  }
                >

                  <option value="">
                    {loadingLocations
                      ? "Loading locations..."
                      : "Select Location"}
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

              <div className="adjustment-form-group item-search-group">

                <label>
                  Item
                  <span className="required">
                    *
                  </span>
                </label>

                <div className="item-search-wrapper">

                  <div className="item-search-input-wrapper">

                    <input
                      type="text"
                      value={itemSearch}
                      onChange={
                        handleItemSearchChange
                      }
                      onFocus={() => {
                        if (!form.item_id) {
                          setShowItemResults(true);
                        }
                      }}
                      disabled={
                        saving ||
                        loadingItems
                      }
                      placeholder={
                        loadingItems
                          ? "Loading items..."
                          : "Search item by name or ID..."
                      }
                      autoComplete="off"
                    />

                    {itemSearch && (
                      <button
                        type="button"
                        className="item-search-clear"
                        onClick={
                          clearSelectedItem
                        }
                        disabled={
                          saving
                        }
                        title="Clear item"
                      >
                        ×
                      </button>
                    )}

                  </div>

                  {/* SEARCH RESULTS */}

                  {showItemResults &&
                    !form.item_id && (
                      <div className="item-search-results">

                        {loadingItems ? (
                          <div className="item-search-status">
                            Loading items...
                          </div>
                        ) : filteredItems.length === 0 ? (
                          <div className="item-search-status">
                            No items found.
                          </div>
                        ) : (
                          filteredItems
                            .slice(0, 50)
                            .map((item) => (
                              <button
                                type="button"
                                key={
                                  item.id
                                }
                                className="item-search-result"
                                onClick={() =>
                                  handleSelectItem(
                                    item
                                  )
                                }
                              >
                                <span className="item-result-name">
                                  {
                                    item.name
                                  }
                                </span>

                                <span className="item-result-id">
                                  ID: {item.id}
                                </span>
                              </button>
                            ))
                        )}

                      </div>
                    )}

                </div>

                {/* SELECTED ITEM */}

                {selectedItem && (
                  <div className="selected-item-display">

                    <span className="selected-item-check">
                      ✓
                    </span>

                    <div className="selected-item-info">
                      <strong>
                        {selectedItem.name}
                      </strong>

                      <span>
                        Item ID: {selectedItem.id}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="change-item-btn"
                      onClick={
                        clearSelectedItem
                      }
                      disabled={
                        saving
                      }
                    >
                      Change
                    </button>

                  </div>
                )}

              </div>

            </div>

          </div>

          {/* ==================================================
              ADJUSTMENT
          ================================================== */}

          <div className="adjustment-section">

            <div className="adjustment-section-title">

              <div>
                <h3>
                  Quantity Adjustment
                </h3>

                <span>
                  Use a positive value to add
                  stock or a negative value to
                  remove stock.
                </span>
              </div>

            </div>

            <div className="quantity-adjustment-layout">

              <div className="adjustment-form-group quantity-group">

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
                    form.quantity_adjusted
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving
                  }
                  step="0.01"
                  placeholder="e.g. 10 or -10"
                />

              </div>

              <div className="adjustment-direction">

                <span className="direction-label">
                  Adjustment Type
                </span>

                {!adjustmentType ? (
                  <div className="direction-neutral">
                    Enter a quantity
                  </div>
                ) : adjustmentType ===
                  "addition" ? (
                  <div className="direction-addition">

                    <strong>
                      + Addition
                    </strong>

                    <span>
                      Stock will be added
                    </span>

                  </div>
                ) : (
                  <div className="direction-removal">

                    <strong>
                      − Removal
                    </strong>

                    <span>
                      Stock will be removed
                    </span>

                  </div>
                )}

              </div>

            </div>

          </div>

          {/* ==================================================
              REASON
          ================================================== */}

          <div className="adjustment-section">

            <div className="adjustment-form-group">

              <label>
                Reason
              </label>

              <textarea
                name="reason"
                value={
                  form.reason
                }
                onChange={
                  handleChange
                }
                disabled={
                  saving
                }
                rows="4"
                placeholder="Enter the reason for this inventory adjustment..."
              />

            </div>

          </div>

          {/* ==================================================
              SUMMARY
          ================================================== */}

          {(selectedLocation ||
            selectedItem ||
            form.quantity_adjusted) && (

            <div className="adjustment-summary">

              <div className="summary-title">
                Adjustment Summary
              </div>

              <div className="summary-grid">

                <div className="summary-item">

                  <span>
                    Location
                  </span>

                  <strong>
                    {
                      selectedLocation?.name ||
                      "-"
                    }
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Item
                  </span>

                  <strong>
                    {
                      selectedItem?.name ||
                      "-"
                    }
                  </strong>

                </div>

                <div className="summary-item">

                  <span>
                    Quantity
                  </span>

                  <strong
                    className={
                      adjustmentType ===
                      "addition"
                        ? "summary-addition"
                        : adjustmentType ===
                          "removal"
                        ? "summary-removal"
                        : ""
                    }
                  >
                    {form.quantity_adjusted ||
                      "-"}
                  </strong>

                </div>

              </div>

            </div>

          )}

          {/* ==================================================
              FOOTER
          ================================================== */}

          <div className="adjustment-form-footer">

            <button
              type="button"
              className="adjustment-cancel-btn"
              onClick={
                resetForm
              }
              disabled={
                saving
              }
            >
              Clear
            </button>

            <button
              type="submit"
              className="adjustment-save-btn"
              disabled={
                saving ||
                loadingLocations ||
                loadingItems
              }
            >
              {saving
                ? "Saving..."
                : "Create Adjustment"}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
};

export default CreateCateringAdjustment;

