import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockAdjustment.css";

const StockAdjustment = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantityAdjusted, setQuantityAdjusted] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ==========================================================
  // FETCH ITEMS
  // ==========================================================

  useEffect(() => {
    fetchItems();
  }, []);

  // ==========================================================
  // AUTO-HIDE MESSAGE
  // ==========================================================

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  // ==========================================================
  // GET STORE ITEMS
  // ==========================================================

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();

      const res = await axios.get("/store/items/simple");

      const sortedItems = [...(res.data || [])].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setItems(sortedItems);
    } catch (error) {
      console.error("Error fetching items:", error);

      setItems([]);

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to load store items."
      );
    }
  };

  // ==========================================================
  // FILTER ITEMS
  // ==========================================================

  const filteredItems = items.filter((item) =>
    (item.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // ==========================================================
  // SUBMIT ADJUSTMENT
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!itemId) {
      setMessage("⚠ Please select an item.");
      return;
    }

    if (
      quantityAdjusted === "" ||
      quantityAdjusted === null
    ) {
      setMessage("⚠ Please enter the adjustment quantity.");
      return;
    }

    if (!reason.trim()) {
      setMessage("⚠ Please enter a reason.");
      return;
    }

    const quantity = Number(quantityAdjusted);

    if (Number.isNaN(quantity)) {
      setMessage("⚠ Please enter a valid quantity.");
      return;
    }

    if (quantity === 0) {
      setMessage("⚠ Adjustment cannot be zero.");
      return;
    }

    try {
      setLoading(true);

      const axios = axiosWithAuth();

      await axios.post("/store/adjust", {
        item_id: parseInt(itemId, 10),
        quantity_adjusted: quantity,
        reason: reason.trim(),
      });

      setMessage("✅ Stock adjustment successful.");

      // Clear form
      setItemId("");
      setSearch("");
      setQuantityAdjusted("");
      setReason("");
    } catch (error) {
      console.error("Stock adjustment error:", error);

      setMessage(
        error.response?.data?.detail ||
          "❌ Adjustment failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="stock-adjustment-container">

      <h2>Stock Adjustment</h2>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="adjustment-form"
      >

        {/* =========================
            SEARCH ITEM
        ========================= */}

        <label>
          Search Item
        </label>

        <input
          type="text"
          value={search}
          placeholder="Search by item name..."
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        {/* =========================
            ITEM
        ========================= */}

        <label>
          Item
        </label>

        <select
          value={itemId}
          onChange={(e) =>
            setItemId(e.target.value)
          }
        >
          <option value="">
            -- Select Item --
          </option>

          {filteredItems.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.name}
              {item.unit
                ? ` (${item.unit})`
                : ""}
              {item.unit_price != null
                ? ` - ₦${Number(
                    item.unit_price
                  ).toLocaleString("en-NG")}`
                : ""}
            </option>
          ))}
        </select>

        {/* =========================
            QUANTITY ADJUSTMENT
        ========================= */}

        <label>
          Quantity Adjustment
        </label>

        <input
          type="number"
          step="1"
          value={quantityAdjusted}
          onChange={(e) =>
            setQuantityAdjusted(e.target.value)
          }
          placeholder="Positive = add, Negative = remove"
        />

        <div className="adjustment-help">
          Positive quantity adds stock.
          Negative quantity removes stock.
        </div>

        {/* =========================
            REASON
        ========================= */}

        <label>
          Reason
        </label>

        <textarea
          rows="3"
          value={reason}
          onChange={(e) =>
            setReason(e.target.value)
          }
          placeholder="Enter reason for this adjustment..."
        />

        {/* =========================
            SUBMIT
        ========================= */}

        <button
          type="submit"
          className="adjust-btn"
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : "Adjust Stock"}
        </button>

      </form>
    </div>
  );
};

export default StockAdjustment;