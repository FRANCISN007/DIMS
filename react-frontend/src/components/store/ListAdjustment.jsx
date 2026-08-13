// src/pages/store/StockAdjustment/ListAdjustment.jsx

import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListAdjustment.css";

const ListAdjustment = () => {
  // ==========================================================
  // STATE
  // ==========================================================

  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editingAdjustment, setEditingAdjustment] = useState(null);

  const [items, setItems] = useState([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ==========================================================
  // MESSAGE HELPER
  // ==========================================================

  const showMessage = (msg) => {
    setMessage(msg);

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  // ==========================================================
  // GET CURRENT MONTH
  // ==========================================================

  const getCurrentMonthDates = () => {
    const now = new Date();

    const firstDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];

    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    )
      .toISOString()
      .split("T")[0];

    return {
      firstDay,
      lastDay,
    };
  };

  // ==========================================================
  // FETCH ADJUSTMENTS
  // ==========================================================

  const fetchAdjustments = async (
    start = startDate,
    end = endDate
  ) => {
    try {
      setLoading(true);

      const axios = axiosWithAuth();

      const params = {};

      if (start) {
        params.start_date = `${start}T00:00:00`;
      }

      if (end) {
        params.end_date = `${end}T23:59:59`;
      }

      const res = await axios.get(
        "/store/adjustments",
        {
          params,
        }
      );

      setAdjustments(
        Array.isArray(res.data)
          ? res.data
          : []
      );

    } catch (error) {
      console.error(
        "Error fetching adjustments:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "❌ Failed to load adjustments"
      );

    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    const {
      firstDay,
      lastDay,
    } = getCurrentMonthDates();

    setStartDate(firstDay);
    setEndDate(lastDay);

    fetchAdjustments(
      firstDay,
      lastDay
    );
  }, []);

  // ==========================================================
  // FETCH STORE ITEMS
  // ==========================================================

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();

      const res = await axios.get(
        "/store/items/simple"
      );

      setItems(
        Array.isArray(res.data)
          ? res.data
          : []
      );

    } catch (error) {
      console.error(
        "Error fetching items:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "❌ Failed to load items"
      );
    }
  };

  // ==========================================================
  // DELETE ADJUSTMENT
  // ==========================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this adjustment?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const axios = axiosWithAuth();

      await axios.delete(
        `/store/adjustments/${id}`
      );

      showMessage(
        "✅ Adjustment deleted successfully"
      );

      fetchAdjustments();

    } catch (error) {
      console.error(
        "Delete adjustment failed:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "❌ Failed to delete adjustment"
      );
    }
  };

  // ==========================================================
  // EDIT ADJUSTMENT
  // ==========================================================

  const handleEditClick = async (adjustment) => {
    await fetchItems();

    setEditingAdjustment({
      id: adjustment.id,

      item_id: adjustment.item?.id
        ? String(adjustment.item.id)
        : "",

      quantity_adjusted:
        adjustment.quantity_adjusted ?? "",

      reason:
        adjustment.reason || "",
    });
  };

  // ==========================================================
  // SAVE EDIT
  // ==========================================================

  const handleEditSave = async () => {
    if (!editingAdjustment) {
      return;
    }

    if (!editingAdjustment.item_id) {
      showMessage(
        "❌ Please select an item"
      );
      return;
    }

    if (
      editingAdjustment.quantity_adjusted ===
        "" ||
      editingAdjustment.quantity_adjusted ===
        null
    ) {
      showMessage(
        "❌ Please enter the adjustment quantity"
      );
      return;
    }

    if (
      Number(
        editingAdjustment.quantity_adjusted
      ) === 0
    ) {
      showMessage(
        "❌ Adjustment quantity cannot be zero"
      );
      return;
    }

    try {
      const axios = axiosWithAuth();

      const payload = {
        item_id: parseInt(
          editingAdjustment.item_id,
          10
        ),

        quantity_adjusted: Number(
          editingAdjustment.quantity_adjusted
        ),

        reason:
          editingAdjustment.reason || "",
      };

      await axios.put(
        `/store/adjustments/${editingAdjustment.id}`,
        payload
      );

      showMessage(
        "✅ Adjustment updated successfully!"
      );

      setEditingAdjustment(null);

      fetchAdjustments();

    } catch (error) {
      console.error(
        "Update adjustment failed:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "❌ Failed to update adjustment"
      );
    }
  };

  // ==========================================================
  // RESET TO CURRENT MONTH
  // ==========================================================

  const handleReset = () => {
    const {
      firstDay,
      lastDay,
    } = getCurrentMonthDates();

    setStartDate(firstDay);
    setEndDate(lastDay);

    fetchAdjustments(
      firstDay,
      lastDay
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="list-adjustment-container">
        <p>Loading adjustments...</p>
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="list-adjustment-container">

      <h2>
        📦 List Store Adjustments
      </h2>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {/* ======================================================
          DATE FILTER
      ====================================================== */}

      <div className="filter-section">

        <label>
          Start Date:
        </label>

        <input
          type="date"
          value={startDate}
          onChange={(e) =>
            setStartDate(e.target.value)
          }
        />

        <label>
          End Date:
        </label>

        <input
          type="date"
          value={endDate}
          onChange={(e) =>
            setEndDate(e.target.value)
          }
        />

        <button
          type="button"
          onClick={() =>
            fetchAdjustments(
              startDate,
              endDate
            )
          }
        >
          🔍 Search
        </button>

        <button
          type="button"
          onClick={handleReset}
        >
          📅 This Month
        </button>

      </div>

      {/* ======================================================
          ADJUSTMENT TABLE
      ====================================================== */}

      <div className="adjustment-table-wrapper">

        <table className="adjustment-table">

          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th>Item Type</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Adjusted By</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {adjustments.length === 0 ? (

              <tr>
                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No adjustments found.
                </td>
              </tr>

            ) : (

              adjustments.map(
                (adjustment, index) => (

                  <tr
                    key={adjustment.id}
                    className={
                      index % 2 === 0
                        ? "even-row"
                        : "odd-row"
                    }
                  >

                    {/* DATE */}

                    <td>
                      {adjustment.adjusted_at
                        ? new Date(
                            adjustment.adjusted_at
                          ).toLocaleString()
                        : "-"}
                    </td>

                    {/* ITEM */}

                    <td>
                      {adjustment.item?.name ||
                        "Unknown Item"}
                    </td>

                    {/* ITEM TYPE */}

                    <td>
                      {adjustment.item?.item_type ||
                        "-"}
                    </td>

                    {/* QUANTITY */}

                    <td>
                      {adjustment.quantity_adjusted}
                    </td>

                    {/* REASON */}

                    <td>
                      {adjustment.reason ||
                        "-"}
                    </td>

                    {/* ADJUSTED BY */}

                    <td>
                      {adjustment.adjusted_by?.username ||
                        adjustment.adjusted_by?.full_name ||
                        adjustment.adjusted_by ||
                        "-"}
                    </td>

                    {/* ACTIONS */}

                    <td>

                      <button
                        type="button"
                        onClick={() =>
                          handleEditClick(
                            adjustment
                          )
                        }
                      >
                        ✏ Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            adjustment.id
                          )
                        }
                      >
                        🗑 Delete
                      </button>

                    </td>

                  </tr>

                )
              )

            )}

          </tbody>

        </table>

      </div>

      {/* ======================================================
          EDIT MODAL
      ====================================================== */}

      {editingAdjustment && (

        <div className="edit-modal">

          <div className="edit-modal-content">

            <h3>
              Edit Adjustment
            </h3>

            {/* ITEM */}

            <label>
              Item
            </label>

            <select
              value={
                editingAdjustment.item_id
              }
              onChange={(e) =>
                setEditingAdjustment({
                  ...editingAdjustment,
                  item_id:
                    e.target.value,
                })
              }
            >

              <option value="">
                -- Select Item --
              </option>

              {items.map((item) => (

                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>

              ))}

            </select>

            {/* QUANTITY */}

            <label>
              Quantity Adjusted
            </label>

            <input
              type="number"
              step="1"
              value={
                editingAdjustment.quantity_adjusted
              }
              onChange={(e) =>
                setEditingAdjustment({
                  ...editingAdjustment,
                  quantity_adjusted:
                    e.target.value,
                })
              }
            />

            {/* REASON */}

            <label>
              Reason
            </label>

            <textarea
              value={
                editingAdjustment.reason
              }
              onChange={(e) =>
                setEditingAdjustment({
                  ...editingAdjustment,
                  reason:
                    e.target.value,
                })
              }
            />

            {/* BUTTONS */}

            <div className="edit-buttons">

              <button
                type="button"
                onClick={
                  handleEditSave
                }
              >
                💾 Save
              </button>

              <button
                type="button"
                onClick={() =>
                  setEditingAdjustment(
                    null
                  )
                }
              >
                ❌ Cancel
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};

export default ListAdjustment;