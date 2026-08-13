// src/components/store/IssueToLocation.jsx

import React, { useEffect, useRef, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./IssueToLocation.css";

const IssueToLocation = () => {
  const [locations, setLocations] = useState([]);
  const [issuedTo, setIssuedTo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rows, setRows] = useState([
    {
      itemId: "",
      itemName: "",
      search: "",
      suggestions: [],
      quantity: "",
    },
  ]);

  const fetchTimeout = useRef(null);
  const axios = axiosWithAuth();

  // ==========================================================
  // TODAY
  // ==========================================================

  const getToday = () => {
    return new Date().toISOString().split("T")[0];
  };

  // ==========================================================
  // LOAD INITIAL DATA
  // ==========================================================

  useEffect(() => {
    setIssueDate(getToday());
    fetchLocations();

    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, []);

  // ==========================================================
  // CLEAR MESSAGE AFTER 3 SECONDS
  // ==========================================================

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  // ==========================================================
  // FETCH LOCATIONS
  // ==========================================================

  const fetchLocations = async () => {
    try {
      const res = await axios.get("/locations/simple");

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.locations || [];

      setLocations(data);
    } catch (error) {
      console.error("Error fetching locations:", error);

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to load locations."
      );

      setLocations([]);
    }
  };

  // ==========================================================
  // SEARCH STORE ITEMS
  // ==========================================================

  const fetchItems = async (searchText) => {
    if (!searchText.trim()) {
      return [];
    }

    try {
      const res = await axios.get("/store/items/simple-search", {
        params: {
          search: searchText,
          limit: 50,
        },
      });

      return (res.data || []).map((item) => ({
        id: item.item_id ?? item.id,
        name: item.item_name ?? item.name,
        price: item.unit_price ?? item.selling_price ?? 0,
        unit: item.unit,
      }));
    } catch (error) {
      console.error("Error searching store items:", error);
      return [];
    }
  };

  // ==========================================================
  // HANDLE ROW CHANGE
  // ==========================================================

  const handleRowChange = (index, field, value) => {
    setRows((prevRows) => {
      const updatedRows = [...prevRows];

      if (field === "search") {
        updatedRows[index] = {
          ...updatedRows[index],
          search: value,
          itemId: "",
          itemName: "",
          suggestions: [],
        };
      }

      if (field === "select_item") {
        updatedRows[index] = {
          ...updatedRows[index],
          itemId: value.id,
          itemName: value.name,
          search: value.name,
          suggestions: [],
        };
      }

      if (field === "quantity") {
        updatedRows[index] = {
          ...updatedRows[index],
          quantity: value,
        };
      }

      return updatedRows;
    });

    // ========================================================
    // SEARCH ITEM
    // ========================================================

    if (field === "search") {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }

      if (!value.trim()) {
        return;
      }

      fetchTimeout.current = setTimeout(async () => {
        const results = await fetchItems(value);

        setRows((prevRows) => {
          const updatedRows = [...prevRows];

          if (!updatedRows[index]) {
            return prevRows;
          }

          updatedRows[index] = {
            ...updatedRows[index],
            suggestions: results,
          };

          return updatedRows;
        });
      }, 300);
    }
  };

  // ==========================================================
  // ADD ROW
  // ==========================================================

  const addRow = () => {
    setRows((prevRows) => [
      ...prevRows,
      {
        itemId: "",
        itemName: "",
        search: "",
        suggestions: [],
        quantity: "",
      },
    ]);
  };

  // ==========================================================
  // REMOVE ROW
  // ==========================================================

  const removeRow = (index) => {
    setRows((prevRows) =>
      prevRows.filter((_, i) => i !== index)
    );
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setMessage("");

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (!issuedTo) {
      setMessage("⚠ Please select a location.");
      return;
    }

    // --------------------------------------------------------
    // ITEMS
    // --------------------------------------------------------

    const validRows = rows.filter(
      (row) =>
        row.itemId &&
        row.quantity &&
        parseFloat(row.quantity) > 0
    );

    if (validRows.length === 0) {
      setMessage("⚠ Please add at least one valid item.");
      return;
    }

    // --------------------------------------------------------
    // PAYLOAD
    // --------------------------------------------------------

    const payload = {
      issue_to: "location",

      issued_to_id: parseInt(issuedTo, 10),

      issue_items: validRows.map((row) => ({
        item_id: parseInt(row.itemId, 10),
        quantity: parseFloat(row.quantity),
      })),

      issue_date: issueDate
        ? `${issueDate}T00:00:00`
        : null,
    };

    setIsSubmitting(true);

    try {
      await axios.post("/store/location", payload);

      setMessage(
        "✅ Items successfully issued to location."
      );

      // Reset form
      setRows([
        {
          itemId: "",
          itemName: "",
          search: "",
          suggestions: [],
          quantity: "",
        },
      ]);

      setIssuedTo("");
      setIssueDate(getToday());

    } catch (error) {
      console.error(
        "Error issuing items to location:",
        error
      );

      setMessage(
        error.response?.data?.detail ||
          "❌ Error issuing items to location."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="issue-items-container">

      <h2>📤 Issue Items to Location</h2>

      {message && (
        <p className="issue-message">
          {message}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="issue-form"
      >

        {/* ====================================================
            LOCATION
        ==================================================== */}

        <label>Select Location</label>

        <select
          value={issuedTo}
          onChange={(e) => setIssuedTo(e.target.value)}
          required
        >
          <option value="">
            -- Choose Location --
          </option>

          {locations.map((location) => (
            <option
              key={location.id}
              value={location.id}
            >
              {location.name}
            </option>
          ))}
        </select>

        {/* ====================================================
            ISSUE DATE
        ==================================================== */}

        <label>Issue Date</label>

        <input
          type="date"
          value={issueDate}
          onChange={(e) =>
            setIssueDate(e.target.value)
          }
        />

        {/* ====================================================
            ITEMS
        ==================================================== */}

        <table className="issue-table">

          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th></th>
            </tr>
          </thead>

          <tbody>

            {rows.map((row, index) => (
              <tr key={index}>

                {/* ITEM SEARCH */}

                <td>
                  <div className="autocomplete">

                    <input
                      type="text"
                      placeholder="Search item..."
                      value={row.search}
                      onChange={(e) =>
                        handleRowChange(
                          index,
                          "search",
                          e.target.value
                        )
                      }
                    />

                    {row.suggestions.length > 0 && (
                      <ul className="suggestions-list">

                        {row.suggestions.map((item) => (
                          <li
                            key={item.id}
                            onClick={() =>
                              handleRowChange(
                                index,
                                "select_item",
                                item
                              )
                            }
                          >
                            {item.name}

                            {item.unit
                              ? ` (${item.unit})`
                              : ""}

                            {item.price
                              ? ` - ₦${Number(
                                  item.price
                                ).toLocaleString(
                                  "en-NG"
                                )}`
                              : ""}
                          </li>
                        ))}

                      </ul>
                    )}

                  </div>
                </td>

                {/* QUANTITY */}

                <td>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.quantity}
                    onChange={(e) =>
                      handleRowChange(
                        index,
                        "quantity",
                        e.target.value
                      )
                    }
                    required
                  />
                </td>

                {/* REMOVE */}

                <td>

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        removeRow(index)
                      }
                    >
                      ❌
                    </button>
                  )}

                </td>

              </tr>
            ))}

          </tbody>

        </table>

        {/* ====================================================
            ADD ITEM
        ==================================================== */}

        <button
          type="button"
          onClick={addRow}
          className="add-row-btn"
        >
          ➕ Add Item
        </button>

        {/* ====================================================
            SUBMIT
        ==================================================== */}

        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Issuing Items..."
            : "📤 Issue Items"}
        </button>

      </form>

    </div>
  );
};

export default IssueToLocation;