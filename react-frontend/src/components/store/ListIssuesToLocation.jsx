// src/components/store/ListIssuesToLocation.jsx

import React, { useState, useEffect, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListIssuesToLocation.css";

const ListIssuesToLocation = () => {
  const [issues, setIssues] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);

  const [message, setMessage] = useState("");

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingIssue, setEditingIssue] = useState(null);

  const [formData, setFormData] = useState({
    issue_to: "location",
    issued_to_id: "",
    issue_date: "",
    issue_items: [],
  });

  const [originalIssueCounts, setOriginalIssueCounts] = useState({});

  const fetchTimeout = useRef(null);

  const axios = axiosWithAuth();

  // ==========================================================
  // TODAY
  // ==========================================================

  const getToday = () => {
    return new Date().toISOString().split("T")[0];
  };

  // ==========================================================
  // USER / ROLES
  // ==========================================================

  const storedUser =
    JSON.parse(localStorage.getItem("user")) || {};

  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());

  // ==========================================================
  // SET DEFAULT DATE RANGE
  // ==========================================================

  useEffect(() => {
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

    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  // ==========================================================
  // FETCH LOCATIONS AND ITEMS
  // ==========================================================

  useEffect(() => {
    const fetchLocationsAndItems = async () => {
      try {
        const [locationsRes, itemsRes] =
          await Promise.all([
            axios.get("/locations/simple"),
            axios.get("/store/items/simple"),
          ]);

        setLocations(
          Array.isArray(locationsRes.data)
            ? locationsRes.data
            : []
        );

        setItems(
          Array.isArray(itemsRes.data)
            ? itemsRes.data
            : []
        );
      } catch (err) {
        console.error(
          "Error fetching locations/items:",
          err
        );
      }
    };

    fetchLocationsAndItems();
  }, []);

  // ==========================================================
  // SHOW MESSAGE
  // ==========================================================

  const showMessage = (msg) => {
    setMessage(msg);

    setTimeout(() => {
      setMessage("");
    }, 3500);
  };

  // ==========================================================
  // SEARCH STORE ITEMS
  // ==========================================================

  const fetchItems = async (searchText) => {
    if (!searchText.trim()) {
      return [];
    }

    try {
      const res = await axios.get(
        "/store/items/simple-search",
        {
          params: {
            search: searchText,
            limit: 20,
          },
        }
      );

      return Array.isArray(res.data)
        ? res.data
        : [];
    } catch (err) {
      console.error(
        "Item search failed:",
        err
      );

      return [];
    }
  };

  // ==========================================================
  // FETCH LOCATION ISSUES
  // ==========================================================

  const fetchIssues = async (
    locationId = selectedLocationId,
    sDate = startDate,
    eDate = endDate
  ) => {
    try {
      const params = {};

      if (locationId) {
        params.location_id = locationId;
      }

      if (sDate) {
        params.start_date = sDate;
      }

      if (eDate) {
        params.end_date = eDate;
      }

      const res = await axios.get(
        "/store/location",
        { params }
      );

      setIssues(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Error fetching location issues:",
        err
      );

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to load location issues."
      );
    }
  };

  // ==========================================================
  // REFRESH ISSUES WHEN FILTER CHANGES
  // ==========================================================

  useEffect(() => {
    if (!startDate || !endDate) {
      return;
    }

    fetchIssues();
  }, [
    selectedLocationId,
    startDate,
    endDate,
  ]);

  // ==========================================================
  // EDIT ISSUE
  // ==========================================================

  const handleEditClick = (issue) => {
    const issue_items =
      (issue.issue_items || []).map((it) => ({
        itemId: it.item?.id || "",
        itemName: it.item?.name || "",
        search: it.item?.name || "",
        suggestions: [],
        quantity: it.quantity || "",
      }));

    // --------------------------------------------------------
    // ORIGINAL QUANTITIES
    // --------------------------------------------------------

    const orig = {};

    issue_items.forEach((item) => {
      const id = Number(item.itemId);

      if (!id) {
        return;
      }

      orig[id] =
        (orig[id] || 0) +
        Number(item.quantity || 0);
    });

    setOriginalIssueCounts(orig);

    // --------------------------------------------------------
    // FORM DATA
    // --------------------------------------------------------

    setFormData({
      issue_to: "location",

      issued_to_id:
        issue.issued_to_id || "",

      issue_date: issue.issue_date
        ? issue.issue_date.split("T")[0]
        : getToday(),

      issue_items,
    });

    setEditingIssue(issue.id);
  };

  // ==========================================================
  // FORM ITEM CHANGE
  // ==========================================================

  const handleFormChange = (
    index,
    field,
    value
  ) => {
    setFormData((prev) => {
      const updated = [
        ...prev.issue_items,
      ];

      // ------------------------------------------------------
      // SEARCH
      // ------------------------------------------------------

      if (field === "search") {
        updated[index].search = value;
        updated[index].itemId = "";
        updated[index].itemName = "";
      }

      // ------------------------------------------------------
      // QUANTITY
      // ------------------------------------------------------

      if (field === "quantity") {
        updated[index].quantity = value;
      }

      // ------------------------------------------------------
      // SELECT ITEM
      // ------------------------------------------------------

      if (field === "select_item") {
        updated[index].itemId = value.id;
        updated[index].itemName = value.name;
        updated[index].search = value.name;
        updated[index].suggestions = [];
      }

      return {
        ...prev,
        issue_items: updated,
      };
    });

    // --------------------------------------------------------
    // ITEM SEARCH
    // --------------------------------------------------------

    if (field === "search") {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }

      fetchTimeout.current =
        setTimeout(async () => {
          const results =
            await fetchItems(value);

          setFormData((prev) => {
            const rows = [
              ...prev.issue_items,
            ];

            if (!rows[index]) {
              return prev;
            }

            rows[index].suggestions =
              results;

            return {
              ...prev,
              issue_items: rows,
            };
          });
        }, 300);
    }
  };

  // ==========================================================
  // ADD ISSUE LINE
  // ==========================================================

  const addIssueLine = () => {
    setFormData((prev) => ({
      ...prev,

      issue_items: [
        ...prev.issue_items,

        {
          itemId: "",
          itemName: "",
          search: "",
          suggestions: [],
          quantity: "",
        },
      ],
    }));
  };

  // ==========================================================
  // REMOVE ISSUE LINE
  // ==========================================================

  const removeIssueLine = (index) => {
    setFormData((prev) => {
      const newItems = [
        ...prev.issue_items,
      ];

      newItems.splice(index, 1);

      return {
        ...prev,
        issue_items: newItems,
      };
    });
  };

  // ==========================================================
  // UPDATE ISSUE
  // ==========================================================

  const handleSubmitEdit = async (id) => {
    try {
      // ------------------------------------------------------
      // LOCATION VALIDATION
      // ------------------------------------------------------

      if (!formData.issued_to_id) {
        showMessage(
          "❌ Please select a location."
        );

        return;
      }

      // ------------------------------------------------------
      // ITEM VALIDATION
      // ------------------------------------------------------

      if (
        !formData.issue_items.length
      ) {
        showMessage(
          "❌ Add at least one item."
        );

        return;
      }

      const requested = {};

      for (const row of formData.issue_items) {
        const itemId = Number(
          row.itemId || 0
        );

        const qty = Number(
          row.quantity || 0
        );

        if (!itemId) {
          showMessage(
            "❌ Select an item for every row."
          );

          return;
        }

        if (qty <= 0) {
          showMessage(
            "❌ Quantity must be greater than zero."
          );

          return;
        }

        requested[itemId] =
          (requested[itemId] || 0) +
          qty;
      }

      // ------------------------------------------------------
      // CHECK STOCK
      // ------------------------------------------------------

      for (const itemId of Object.keys(
        requested
      )) {
        const reqQty =
          requested[itemId];

        const stockRes =
          await axios.get(
            `/store/stock/${itemId}`
          );

        const available = Number(
          stockRes.data?.available || 0
        );

        const oldQty = Number(
          originalIssueCounts[itemId] ||
            0
        );

        const allowed =
          available + oldQty;

        if (reqQty > allowed) {
          const item =
            items.find(
              (i) =>
                i.id ===
                Number(itemId)
            ) || {};

          showMessage(
            `❌ ${
              item.name || "Item"
            } only has ${allowed} available.`
          );

          return;
        }
      }

      // ------------------------------------------------------
      // PAYLOAD
      // ------------------------------------------------------

      const payload = {
        issue_to: "location",

        issued_to_id: Number(
          formData.issued_to_id
        ),

        issue_date:
          formData.issue_date,

        issue_items:
          formData.issue_items.map(
            (row) => ({
              item_id: Number(
                row.itemId
              ),

              quantity: Number(
                row.quantity
              ),
            })
          ),
      };

      // ------------------------------------------------------
      // UPDATE
      // ------------------------------------------------------

      await axios.put(
        `/store/location-issues/${id}`,
        payload
      );

      showMessage(
        "✅ Location issue updated successfully."
      );

      setEditingIssue(null);
      setOriginalIssueCounts({});

      fetchIssues();
    } catch (err) {
      console.error(
        "Update location issue failed:",
        err
      );

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to update location issue."
      );
    }
  };

  // ==========================================================
  // DELETE ISSUE
  // ==========================================================

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this issue?"
      )
    ) {
      return;
    }

    try {
      await axios.delete(
        `/store/location-issues/${id}`
      );

      showMessage(
        "✅ Location issue deleted successfully."
      );

      fetchIssues();
    } catch (err) {
      console.error(
        "Delete location issue failed:",
        err
      );

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to delete location issue."
      );
    }
  };

  // ==========================================================
  // RESET FILTER
  // ==========================================================

  const handleReset = () => {
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

    setSelectedLocationId("");
    setStartDate(firstDay);
    setEndDate(lastDay);
  };

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalIssued =
    issues.length;

  const totalQuantity =
    issues.reduce(
      (acc, issue) =>
        acc +
        (
          issue.issue_items?.reduce(
            (sum, item) =>
              sum +
              Number(
                item.quantity || 0
              ),
            0
          ) || 0
        ),
      0
    );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="list-issues-container">

      <h2>
        📦 List of Issued Items to Location
      </h2>

      {/* ====================================================
          FILTERS
      ==================================================== */}

      <div className="filters">

        <select
          value={selectedLocationId}
          onChange={(e) =>
            setSelectedLocationId(
              e.target.value
            )
          }
        >
          <option value="">
            -- All Locations --
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

        <input
          type="date"
          value={startDate}
          onChange={(e) =>
            setStartDate(
              e.target.value
            )
          }
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) =>
            setEndDate(
              e.target.value
            )
          }
        />

        <button
          onClick={handleReset}
        >
          ♻️ Reset
        </button>
      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <p className="issue-message">
          {message}
        </p>
      )}

      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <div className="summary">

        <p>
          Total Entries:{" "}
          {totalIssued}
        </p>

        <p>
          Total Quantity Issued:{" "}
          {totalQuantity}
        </p>

      </div>

      {/* ====================================================
          TABLE
      ==================================================== */}

      <div className="table-scroll-container">

        <table className="list-issues-table">

          <thead>
            <tr>
              <th>ID</th>
              <th>Issue To</th>
              <th>Issue Date</th>
              <th>Items Issued</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {issues.length === 0 ? (

              <tr>
                <td colSpan="5">
                  No issues found.
                </td>
              </tr>

            ) : (

              issues.map(
                (issue) => (
                  <tr key={issue.id}>

                    <td>
                      {issue.id}
                    </td>

                    <td>
                      {
                        issue.issued_to
                          ?.name ||
                        "Unnamed Location"
                      }
                    </td>

                    <td>
                      {new Date(
                        issue.issue_date
                      ).toLocaleDateString()}
                    </td>

                    <td>

                      <ul
                        style={{
                          paddingLeft:
                            "1rem",
                          margin: 0,
                        }}
                      >

                        {(
                          issue.issue_items ||
                          []
                        ).map(
                          (it) => (
                            <li key={it.id}>

                              {it.item
                                ?.name ||
                                "Item"}

                              {" — Qty: "}

                              {
                                it.quantity
                              }

                              {it.item
                                ?.item_type
                                ? ` — ${it.item.item_type}`
                                : ""}
                            </li>
                          )
                        )}

                      </ul>

                    </td>

                    <td>

                      <button
                        className="edit-btn"
                        onClick={() =>
                          handleEditClick(
                            issue
                          )
                        }
                      >
                        ✏️ Edit
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() =>
                          handleDelete(
                            issue.id
                          )
                        }
                      >
                        🗑️ Delete
                      </button>

                    </td>

                  </tr>
                )
              )

            )}

          </tbody>

        </table>

      </div>

      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {editingIssue && (

        <div className="bar-edit-modal-overlay">

          <div className="bar-edit-form">

            <h3>
              Edit Location Issue
            </h3>

            {/* LOCATION */}

            <label>
              Location:
            </label>

            <select
              value={
                formData.issued_to_id
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  issued_to_id:
                    e.target.value,
                })
              }
            >

              <option value="">
                -- Select a location --
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

            {/* DATE */}

            <label>
              Issue Date:
            </label>

            <input
              type="date"
              value={
                formData.issue_date
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  issue_date:
                    e.target.value,
                })
              }
            />

            <h4>
              Items
            </h4>

            {/* ITEM SCROLL */}

            <div className="bar-items-scroll">

              {(
                formData.issue_items ||
                []
              ).map(
                (row, index) => (

                  <div
                    className="bar-item-row"
                    key={index}
                  >

                    <div className="bar-autocomplete">

                      <input
                        type="text"
                        placeholder="Search item..."
                        value={
                          row.search
                        }
                        onChange={(e) =>
                          handleFormChange(
                            index,
                            "search",
                            e.target.value
                          )
                        }
                      />

                      {row.suggestions
                        ?.length > 0 && (

                        <ul className="bar-suggestions-list">

                          {row.suggestions.map(
                            (item) => (

                              <li
                                key={
                                  item.id
                                }
                                onClick={() =>
                                  handleFormChange(
                                    index,
                                    "select_item",
                                    item
                                  )
                                }
                              >
                                {
                                  item.name
                                }
                              </li>

                            )
                          )}

                        </ul>

                      )}

                    </div>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        row.quantity
                      }
                      onChange={(e) =>
                        handleFormChange(
                          index,
                          "quantity",
                          e.target.value
                        )
                      }
                    />

                    <button
                      type="button"
                      className="bar-remove-line"
                      onClick={() =>
                        removeIssueLine(
                          index
                        )
                      }
                    >
                      ❌
                    </button>

                  </div>

                )
              )}

            </div>

            {/* ADD ITEM */}

            <button
              type="button"
              className="bar-add-btn"
              onClick={
                addIssueLine
              }
            >
              ➕ Add Item
            </button>

            {/* ACTIONS */}

            <div className="bar-modal-actions">

              <button
                className="bar-save-btn"
                onClick={() =>
                  handleSubmitEdit(
                    editingIssue
                  )
                }
              >
                ✅ Save
              </button>

              <button
                className="bar-cancel-btn"
                onClick={() =>
                  setEditingIssue(null)
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

export default ListIssuesToLocation;