// src/components/store/ListIssuesToLocation.jsx

import React, {
  useState,
  useEffect,
  useRef,
} from "react";

import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListIssuesToLocation.css";

const ListIssuesToLocation = () => {
  // ==========================================================
  // AXIOS
  // ==========================================================

  const axios = axiosWithAuth();

  // ==========================================================
  // DATA
  // ==========================================================

  const [issues, setIssues] = useState([]);
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);

  // ==========================================================
  // ITEM SUMMARY FROM BACKEND
  // ==========================================================

  const [totalItemQuantity, setTotalItemQuantity] =
    useState(0);

  const [selectedItemId, setSelectedItemId] =
    useState(null);

  const [selectedItemName, setSelectedItemName] =
    useState("");

  const [selectedItemUnit, setSelectedItemUnit] =
    useState("");

  // ==========================================================
  // MESSAGE
  // ==========================================================

  const [message, setMessage] = useState("");

  const messageTimeout = useRef(null);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [selectedLocationId, setSelectedLocationId] =
    useState("");

  const [selectedItemFilter, setSelectedItemFilter] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  // ==========================================================
  // EDIT
  // ==========================================================

  const [editingIssue, setEditingIssue] =
    useState(null);

  const [savingEdit, setSavingEdit] =
    useState(false);

  const [formData, setFormData] = useState({
    ref: "",
    issue_to: "location",
    issued_to_id: "",
    issue_date: "",
    issue_items: [],
  });

  /*
   * Keep the original quantities only as information about
   * what the issue contained before editing.
   *
   * IMPORTANT:
   * We DO NOT use this to calculate stock.
   *
   * The backend is responsible for:
   *
   *     actual stock + old issue quantity
   *
   * and then rebuilding the inventory.
   */
  const [originalIssueCounts, setOriginalIssueCounts] =
    useState({});

  // ==========================================================
  // SEARCH
  // ==========================================================

  const fetchTimeout = useRef(null);

  // ==========================================================
  // FORMAT LOCAL DATE
  // ==========================================================

  const formatDate = (date) => {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // ==========================================================
  // TODAY
  // ==========================================================

  const getToday = () => {
    return formatDate(new Date());
  };

  // ==========================================================
  // LAST 7 DAYS
  // ==========================================================

  const getLast7Days = () => {
    const today = new Date();

    const start = new Date(today);

    start.setDate(
      today.getDate() - 6
    );

    return {
      startDate: formatDate(start),
      endDate: formatDate(today),
    };
  };

  // ==========================================================
  // SHOW MESSAGE
  // ==========================================================

  const showMessage = (msg) => {
    if (messageTimeout.current) {
      clearTimeout(
        messageTimeout.current
      );
    }

    setMessage(msg);

    messageTimeout.current =
      setTimeout(() => {
        setMessage("");
      }, 3500);
  };

  // ==========================================================
  // CLEANUP
  // ==========================================================

  useEffect(() => {
    return () => {
      if (fetchTimeout.current) {
        clearTimeout(
          fetchTimeout.current
        );
      }

      if (messageTimeout.current) {
        clearTimeout(
          messageTimeout.current
        );
      }
    };
  }, []);

  // ==========================================================
  // DEFAULT DATE RANGE
  // ==========================================================

  useEffect(() => {
    const {
      startDate,
      endDate,
    } = getLast7Days();

    setStartDate(startDate);
    setEndDate(endDate);
  }, []);

  // ==========================================================
  // FETCH LOCATIONS AND ITEMS
  // ==========================================================

  useEffect(() => {
    const fetchLocationsAndItems =
      async () => {
        try {
          const [
            locationsRes,
            itemsRes,
          ] = await Promise.all([
            axios.get(
              "/locations/simple"
            ),

            axios.get(
              "/store/items/simple"
            ),
          ]);

          setLocations(
            Array.isArray(
              locationsRes.data
            )
              ? locationsRes.data
              : []
          );

          setItems(
            Array.isArray(
              itemsRes.data
            )
              ? itemsRes.data
              : []
          );
        } catch (err) {
          console.error(
            "Error fetching locations/items:",
            err
          );

          showMessage(
            "❌ Failed to load locations/items."
          );
        }
      };

    fetchLocationsAndItems();
  }, []);

  // ==========================================================
  // SEARCH STORE ITEMS
  // ==========================================================

  const fetchItems = async (
    searchText
  ) => {
    if (
      !searchText ||
      !searchText.trim()
    ) {
      return [];
    }

    try {
      const res = await axios.get(
        "/store/items/simple-search",
        {
          params: {
            search:
              searchText.trim(),

            limit: 20,
          },
        }
      );

      return Array.isArray(
        res.data
      )
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
    itemId = selectedItemFilter,
    sDate = startDate,
    eDate = endDate
  ) => {
    try {
      const params = {};

      // ------------------------------------------------------
      // LOCATION
      // ------------------------------------------------------

      if (locationId) {
        params.location_id =
          Number(locationId);
      }

      // ------------------------------------------------------
      // ITEM
      // ------------------------------------------------------

      if (itemId) {
        params.item_id =
          Number(itemId);
      }

      // ------------------------------------------------------
      // DATE
      // ------------------------------------------------------

      if (sDate) {
        params.start_date = sDate;
      }

      if (eDate) {
        params.end_date = eDate;
      }

      // ------------------------------------------------------
      // REQUEST
      // ------------------------------------------------------

      const res = await axios.get(
        "/store/location",
        {
          params,
        }
      );

      const data =
        res.data || {};

      // ------------------------------------------------------
      // ISSUES
      // ------------------------------------------------------

      setIssues(
        Array.isArray(
          data.issues
        )
          ? data.issues
          : []
      );

      // ------------------------------------------------------
      // TOTAL ITEM QUANTITY
      // ------------------------------------------------------

      setTotalItemQuantity(
        Number(
          data.total_item_quantity ||
            0
        )
      );

      // ------------------------------------------------------
      // SELECTED ITEM
      // ------------------------------------------------------

      setSelectedItemId(
        data.selected_item_id ??
          null
      );

      setSelectedItemName(
        data.selected_item_name ||
          ""
      );

      setSelectedItemUnit(
        data.selected_item_unit ||
          ""
      );
    } catch (err) {
      console.error(
        "Error fetching location issues:",
        err
      );

      setIssues([]);

      setTotalItemQuantity(0);

      setSelectedItemId(null);

      setSelectedItemName("");

      setSelectedItemUnit("");

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to load location issues."
      );
    }
  };

  // ==========================================================
  // REFRESH WHEN FILTERS CHANGE
  // ==========================================================

  useEffect(() => {
    if (
      !startDate ||
      !endDate
    ) {
      return;
    }

    fetchIssues();
  }, [
    selectedLocationId,
    selectedItemFilter,
    startDate,
    endDate,
  ]);

  // ==========================================================
  // EDIT ISSUE
  // ==========================================================

  const handleEditClick = (
    issue
  ) => {
    // --------------------------------------------------------
    // BUILD ISSUE ITEMS
    // --------------------------------------------------------

    const issueItems =
      (
        issue.issue_items ||
        []
      ).map((it) => ({
        itemId:
          it.item?.id ||
          "",

        itemName:
          it.item?.name ||
          "",

        search:
          it.item?.name ||
          "",

        suggestions: [],

        quantity:
          Number(
            it.quantity || 0
          ),
      }));

    // --------------------------------------------------------
    // SAVE ORIGINAL QUANTITIES
    //
    // This is NOT used for frontend stock calculation.
    // It is simply retained while editing.
    // --------------------------------------------------------

    const originalCounts = {};

    issueItems.forEach(
      (item) => {
        const itemId =
          Number(
            item.itemId
          );

        if (!itemId) {
          return;
        }

        originalCounts[
          itemId
        ] =
          (
            originalCounts[
              itemId
            ] || 0
          ) +
          Number(
            item.quantity || 0
          );
      }
    );

    setOriginalIssueCounts(
      originalCounts
    );

    // --------------------------------------------------------
    // FORM
    // --------------------------------------------------------

    setFormData({
      ref:
        issue.ref || "",

      issue_to:
        "location",

      issued_to_id:
        issue.issued_to_id ||
        issue.location_id ||
        "",

      issue_date:
        issue.issue_date
          ? issue.issue_date.split(
              "T"
            )[0]
          : getToday(),

      issue_items:
        issueItems,
    });

    setEditingIssue(
      issue.id
    );
  };

  // ==========================================================
  // FORM ITEM CHANGE
  // ==========================================================

  const handleFormChange = (
    index,
    field,
    value
  ) => {
    // --------------------------------------------------------
    // UPDATE FORM
    // --------------------------------------------------------

    setFormData((prev) => {
      const updated = [
        ...prev.issue_items,
      ];

      if (!updated[index]) {
        return prev;
      }

      // ------------------------------------------------------
      // SEARCH
      // ------------------------------------------------------

      if (
        field === "search"
      ) {
        updated[index] = {
          ...updated[index],

          search:
            value,

          /*
           * When user starts typing a new item,
           * the previous selected item is cleared.
           */
          itemId:
            "",

          itemName:
            "",

          suggestions:
            [],
        };
      }

      // ------------------------------------------------------
      // QUANTITY
      // ------------------------------------------------------

      if (
        field === "quantity"
      ) {
        updated[index] = {
          ...updated[index],

          quantity:
            value,
        };
      }

      // ------------------------------------------------------
      // SELECT ITEM
      // ------------------------------------------------------

      if (
        field === "select_item"
      ) {
        updated[index] = {
          ...updated[index],

          itemId:
            value.id,

          itemName:
            value.name,

          search:
            value.name,

          suggestions:
            [],
        };
      }

      return {
        ...prev,

        issue_items:
          updated,
      };
    });

    // --------------------------------------------------------
    // SEARCH ITEMS
    // --------------------------------------------------------

    if (
      field !== "search"
    ) {
      return;
    }

    if (
      fetchTimeout.current
    ) {
      clearTimeout(
        fetchTimeout.current
      );
    }

    /*
     * Do not search for every keystroke immediately.
     */
    fetchTimeout.current =
      setTimeout(
        async () => {
          const results =
            await fetchItems(
              value
            );

          setFormData(
            (prev) => {
              const rows = [
                ...prev.issue_items,
              ];

              if (
                !rows[index]
              ) {
                return prev;
              }

              rows[index] = {
                ...rows[index],

                suggestions:
                  results,
              };

              return {
                ...prev,

                issue_items:
                  rows,
              };
            }
          );
        },
        300
      );
  };

  // ==========================================================
  // ADD ISSUE LINE
  // ==========================================================

  const addIssueLine = () => {
    setFormData(
      (prev) => ({
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
      })
    );
  };

  // ==========================================================
  // REMOVE ISSUE LINE
  // ==========================================================

  const removeIssueLine = (
    index
  ) => {
    setFormData(
      (prev) => {
        const newItems = [
          ...prev.issue_items,
        ];

        newItems.splice(
          index,
          1
        );

        return {
          ...prev,

          issue_items:
            newItems,
        };
      }
    );
  };

  // ==========================================================
  // CLOSE EDIT
  // ==========================================================

  const closeEdit = () => {
    if (savingEdit) {
      return;
    }

    setEditingIssue(
      null
    );

    setOriginalIssueCounts(
      {}
    );

    setFormData({
      ref: "",
      issue_to: "location",
      issued_to_id: "",
      issue_date: "",
      issue_items: [],
    });
  };

  // ==========================================================
  // UPDATE ISSUE
  // ==========================================================
  //
  // IMPORTANT:
  //
  // There is NO frontend stock calculation here.
  //
  // The backend endpoint is responsible for checking:
  //
  //     actual available stock
  //     +
  //     old issue quantity
  //
  // and rebuilding FIFO inventory.
  //
  // ==========================================================

  const handleSubmitEdit =
    async (id) => {
      // ------------------------------------------------------
      // PREVENT DOUBLE SUBMIT
      // ------------------------------------------------------

      if (savingEdit) {
        return;
      }

      try {
        // ----------------------------------------------------
        // LOCATION
        // ----------------------------------------------------

        if (
          !formData.issued_to_id
        ) {
          showMessage(
            "❌ Please select a location."
          );

          return;
        }

        // ----------------------------------------------------
        // ITEMS
        // ----------------------------------------------------

        if (
          !formData.issue_items ||
          !formData.issue_items.length
        ) {
          showMessage(
            "❌ Add at least one item."
          );

          return;
        }

        // ----------------------------------------------------
        // VALIDATE AND BUILD PAYLOAD
        // ----------------------------------------------------

        const issueItems = [];

        for (
          const row of
          formData.issue_items
        ) {
          const itemId =
            Number(
              row.itemId || 0
            );

          const quantity =
            Number(
              row.quantity || 0
            );

          // --------------------------------------------------
          // ITEM REQUIRED
          // --------------------------------------------------

          if (!itemId) {
            showMessage(
              "❌ Select an item for every row."
            );

            return;
          }

          // --------------------------------------------------
          // QUANTITY REQUIRED
          // --------------------------------------------------

          if (
            !Number.isFinite(
              quantity
            ) ||
            quantity <= 0
          ) {
            showMessage(
              "❌ Quantity must be greater than zero."
            );

            return;
          }

          issueItems.push({
            item_id:
              itemId,

            quantity:
              quantity,
          });
        }

        // ----------------------------------------------------
        // PAYLOAD
        // ----------------------------------------------------
        //
        // Keep this exactly aligned with:
        //
        //     store_schemas.IssueCreate
        //
        // ----------------------------------------------------

        const payload = {
          ref:
            formData.ref?.trim() ||
            null,

          issue_to:
            "location",

          issued_to_id:
            Number(
              formData.issued_to_id
            ),

          issue_date:
            formData.issue_date ||
            getToday(),

          issue_items:
            issueItems,
        };

        // ----------------------------------------------------
        // START SAVING
        // ----------------------------------------------------

        setSavingEdit(
          true
        );

        // ----------------------------------------------------
        // SEND UPDATE
        // ----------------------------------------------------

        await axios.put(
          `/store/location-issues/${id}`,
          payload
        );

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        showMessage(
          "✅ Location issue updated successfully."
        );

        closeEdit();

        // ----------------------------------------------------
        // REFRESH LIST
        // ----------------------------------------------------

        await fetchIssues();
      } catch (err) {
        console.error(
          "Update location issue failed:",
          err
        );

        // ----------------------------------------------------
        // BACKEND ERROR
        //
        // For example:
        //
        // "Not enough inventory for item Rice.
        //  Available: 50"
        //
        // We display the backend message directly.
        // ----------------------------------------------------

        const backendMessage =
          err.response?.data
            ?.detail;

        showMessage(
          backendMessage ||
            "❌ Failed to update location issue."
        );
      } finally {
        setSavingEdit(
          false
        );
      }
    };

  // ==========================================================
  // DELETE ISSUE
  // ==========================================================

  const handleDelete =
    async (id) => {
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

        await fetchIssues();
      } catch (err) {
        console.error(
          "Delete location issue failed:",
          err
        );

        showMessage(
          err.response?.data
            ?.detail ||
            "❌ Failed to delete location issue."
        );
      }
    };

  // ==========================================================
  // RESET FILTER
  // ==========================================================

  const handleReset = () => {
    const {
      startDate,
      endDate,
    } = getLast7Days();

    setSelectedLocationId("");

    setSelectedItemFilter("");

    setStartDate(
      startDate
    );

    setEndDate(
      endDate
    );

    setTotalItemQuantity(0);

    setSelectedItemId(
      null
    );

    setSelectedItemName("");

    setSelectedItemUnit("");
  };

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalIssued =
    issues.length;

  const displayedTotalQuantity =
    selectedItemFilter
      ? totalItemQuantity
      : issues.reduce(
          (
            acc,
            issue
          ) =>
            acc +
            (
              issue.issue_items?.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.quantity ||
                      0
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

      {/* ======================================================
          TITLE
      ====================================================== */}

      <h2>
        📦 List of Issued Items to Location
      </h2>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="filters">

        {/* LOCATION */}

        <select
          value={
            selectedLocationId
          }
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

        {/* ITEM */}

        <select
          value={
            selectedItemFilter
          }
          onChange={(e) =>
            setSelectedItemFilter(
              e.target.value
            )
          }
        >
          <option value="">
            -- All Items --
          </option>

          {items.map(
            (item) => (
              <option
                key={
                  item.id
                }
                value={
                  item.id
                }
              >
                {item.name}

                {item.unit
                  ? ` (${item.unit})`
                  : ""}
              </option>
            )
          )}
        </select>

        {/* START DATE */}

        <input
          type="date"
          value={
            startDate
          }
          onChange={(e) =>
            setStartDate(
              e.target.value
            )
          }
        />

        {/* END DATE */}

        <input
          type="date"
          value={
            endDate
          }
          onChange={(e) =>
            setEndDate(
              e.target.value
            )
          }
        />

        {/* RESET */}

        <button
          onClick={
            handleReset
          }
        >
          ♻️ Reset
        </button>

      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <p className="issue-message">
          {message}
        </p>
      )}

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="summary">

        <p>
          Total Entries:{" "}
          <strong>
            {totalIssued}
          </strong>
        </p>

        {selectedItemFilter ? (
          <p>
            Total{" "}
            <strong>
              {selectedItemName ||
                "Item"}
            </strong>{" "}
            Issued:{" "}
            <strong>
              {
                displayedTotalQuantity
              }
            </strong>{" "}
            {selectedItemUnit}
          </p>
        ) : (
          <p>
            Total Quantity Issued:{" "}
            <strong>
              {
                displayedTotalQuantity
              }
            </strong>
          </p>
        )}

      </div>

      {/* ======================================================
          SELECTED ITEM SUMMARY
      ====================================================== */}

      {selectedItemFilter && (
        <div className="item-summary">

          <strong>
            Selected Item:
          </strong>{" "}

          {selectedItemName ||
            "Item"}

          {selectedItemUnit
            ? ` (${selectedItemUnit})`
            : ""}

          {" — Total Issued: "}

          <strong>
            {
              totalItemQuantity
            }
          </strong>

        </div>
      )}

      {/* ======================================================
          TABLE
      ====================================================== */}

      <div className="table-scroll-container">

        <table className="list-issues-table">

          <thead>

            <tr>

              <th>
                ID
              </th>

              <th>
                Reference
              </th>

              <th>
                Issue To
              </th>

              <th>
                Issue Date
              </th>

              <th>
                Items Issued
              </th>

              <th>
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {issues.length ===
            0 ? (

              <tr>

                <td colSpan="6">
                  No issues found.
                </td>

              </tr>

            ) : (

              issues.map(
                (issue) => (

                  <tr
                    key={
                      issue.id
                    }
                  >

                    <td>
                      {
                        issue.id
                      }
                    </td>

                    <td>
                      {
                        issue.ref ||
                        "-"
                      }
                    </td>

                    <td>
                      {
                        issue
                          .issued_to
                          ?.name ||
                        "Unnamed Location"
                      }
                    </td>

                    <td>
                      {issue.issue_date
                        ? new Date(
                            issue.issue_date
                          ).toLocaleDateString()
                        : "-"}
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
                          (
                            it
                          ) => (

                            <li
                              key={
                                it.id
                              }
                            >

                              {
                                it.item
                                  ?.name ||
                                "Item"
                              }

                              {" — Qty: "}

                              {
                                it.quantity
                              }

                              {it.item
                                ?.unit
                                ? ` ${it.item.unit}`
                                : ""}

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
                        disabled={
                          savingEdit
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

      {/* ======================================================
          EDIT MODAL
      ====================================================== */}

      {editingIssue && (

        <div className="bar-edit-modal-overlay">

          <div className="bar-edit-form">

            <h3>
              Edit Location Issue
            </h3>

            {/* ==================================================
                REFERENCE
            ================================================== */}

            <label>
              Reference:
            </label>

            <input
              type="text"
              value={
                formData.ref
              }
              onChange={(e) =>
                setFormData(
                  (prev) => ({
                    ...prev,

                    ref:
                      e.target.value,
                  })
                )
              }
              placeholder="Enter reference"
              disabled={
                savingEdit
              }
            />

            {/* ==================================================
                LOCATION
            ================================================== */}

            <label>
              Location:
            </label>

            <select
              value={
                formData.issued_to_id
              }
              onChange={(e) =>
                setFormData(
                  (prev) => ({
                    ...prev,

                    issued_to_id:
                      e.target.value,
                  })
                )
              }
              disabled={
                savingEdit
              }
            >

              <option value="">
                -- Select a location --
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

            {/* ==================================================
                DATE
            ================================================== */}

            <label>
              Issue Date:
            </label>

            <input
              type="date"
              value={
                formData.issue_date
              }
              onChange={(e) =>
                setFormData(
                  (prev) => ({
                    ...prev,

                    issue_date:
                      e.target.value,
                  })
                )
              }
              disabled={
                savingEdit
              }
            />

            {/* ==================================================
                ITEMS
            ================================================== */}

            <h4>
              Items
            </h4>

            <div className="bar-items-scroll">

              {(
                formData.issue_items ||
                []
              ).map(
                (
                  row,
                  index
                ) => (

                  <div
                    className="bar-item-row"
                    key={
                      index
                    }
                  >

                    {/* ========================================
                        ITEM SEARCH
                    ======================================== */}

                    <div className="bar-autocomplete">

                      <input
                        type="text"
                        placeholder="Search item..."
                        value={
                          row.search ||
                          ""
                        }
                        onChange={(e) =>
                          handleFormChange(
                            index,
                            "search",
                            e.target.value
                          )
                        }
                        disabled={
                          savingEdit
                        }
                      />

                      {row.suggestions
                        ?.length >
                        0 && (

                        <ul className="bar-suggestions-list">

                          {row.suggestions.map(
                            (
                              item
                            ) => (

                              <li
                                key={
                                  item.id
                                }
                                onClick={() =>
                                  !savingEdit &&
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

                                {item.unit
                                  ? ` (${item.unit})`
                                  : ""}

                              </li>

                            )
                          )}

                        </ul>

                      )}

                    </div>

                    {/* ========================================
                        QUANTITY
                    ======================================== */}

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
                      disabled={
                        savingEdit
                      }
                    />

                    {/* ========================================
                        REMOVE
                    ======================================== */}

                    <button
                      type="button"
                      className="bar-remove-line"
                      onClick={() =>
                        removeIssueLine(
                          index
                        )
                      }
                      disabled={
                        savingEdit
                      }
                    >
                      ❌
                    </button>

                  </div>

                )
              )}

            </div>

            {/* ==================================================
                ADD ITEM
            ================================================== */}

            <button
              type="button"
              className="bar-add-btn"
              onClick={
                addIssueLine
              }
              disabled={
                savingEdit
              }
            >
              ➕ Add Item
            </button>

            {/* ==================================================
                ACTIONS
            ================================================== */}

            <div className="bar-modal-actions">

              <button
                className="bar-save-btn"
                onClick={() =>
                  handleSubmitEdit(
                    editingIssue
                  )
                }
                disabled={
                  savingEdit
                }
              >
                {savingEdit
                  ? "⏳ Saving..."
                  : "✅ Save"}
              </button>

              <button
                className="bar-cancel-btn"
                onClick={
                  closeEdit
                }
                disabled={
                  savingEdit
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