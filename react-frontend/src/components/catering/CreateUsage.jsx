import React, { useEffect, useRef, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateUsage.css";

const CreateUsage = () => {
  const axios = axiosWithAuth();

  // ==========================================================
  // STATE
  // ==========================================================

  const [locations, setLocations] = useState([]);

  const [locationId, setLocationId] = useState("");
  const [usageDate, setUsageDate] = useState("");
  const [note, setNote] = useState("");

  const [usageItems, setUsageItems] = useState([
    {
      item_id: "",
      item_name: "",
      unit: "",
      quantity_used: "",
      search: "",
      suggestions: [],
    },
  ]);

  const [searchLoading, setSearchLoading] = useState({});

  const [openSearchRow, setOpenSearchRow] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const searchTimers = useRef({});
  const searchCache = useRef({});

  // ==========================================================
  // MESSAGE
  // ==========================================================

  const showMessage = (msg, type = "error") => {
    setMessage(msg);
    setMessageType(type);

    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000);
  };

  // ==========================================================
  // DEFAULT DATE
  // ==========================================================

  useEffect(() => {
    const today = new Date();

    const formattedDate =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    setUsageDate(formattedDate);
  }, []);

  // ==========================================================
  // CLOSE SEARCH WHEN CLICKING OUTSIDE
  // ==========================================================

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        !event.target.closest(".usage-autocomplete")
      ) {
        setOpenSearchRow(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // ==========================================================
  // CLEANUP SEARCH TIMERS
  // ==========================================================

  useEffect(() => {
    return () => {
      Object.values(searchTimers.current).forEach(
        (timer) => {
          clearTimeout(timer);
        }
      );
    };
  }, []);

  // ==========================================================
  // LOAD LOCATIONS
  // ==========================================================

  useEffect(() => {
    const loadLocations = async () => {
      setLoadingData(true);

      try {
        const response = await axios.get(
          "/locations/simple"
        );

        console.log(
          "Locations:",
          response.data
        );

        setLocations(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch (err) {
        console.error(
          "Failed to load locations:",
          err
        );

        console.error(
          "Response:",
          err.response?.data
        );

        showMessage(
          err.response?.data?.detail ||
            "Failed to load locations."
        );
      } finally {
        setLoadingData(false);
      }
    };

    loadLocations();
  }, []);

  // ==========================================================
  // FETCH ITEMS
  // ==========================================================

  const fetchItems = async (searchText) => {
    const search = searchText.trim();

    if (!search) {
      return [];
    }

    if (searchCache.current[search]) {
      return searchCache.current[search];
    }

    try {
      const response = await axios.get(
        "/store/items/simple-search",
        {
          params: {
            search,
            limit: 20,
          },
        }
      );

      const data = Array.isArray(response.data)
        ? response.data
        : [];

      searchCache.current[search] = data;

      return data;
    } catch (err) {
      console.error(
        "Failed to search items:",
        err
      );

      console.error(
        "Server response:",
        err.response?.data
      );

      return [];
    }
  };

  // ==========================================================
  // ADD ITEM ROW
  // ==========================================================

  const addItemRow = () => {
    setUsageItems((prev) => [
      ...prev,
      {
        item_id: "",
        item_name: "",
        unit: "",
        quantity_used: "",
        search: "",
        suggestions: [],
      },
    ]);
  };

  // ==========================================================
  // REMOVE ITEM ROW
  // ==========================================================

  const removeItemRow = (index) => {
    if (usageItems.length === 1) {
      showMessage(
        "At least one item is required."
      );
      return;
    }

    setUsageItems((prev) =>
      prev.filter((_, i) => i !== index)
    );

    setOpenSearchRow(null);
  };

  // ==========================================================
  // SEARCH ITEM
  // ==========================================================

  const searchItems = (index, value) => {
    setOpenSearchRow(index);

    // --------------------------------------------------------
    // Update current row
    // --------------------------------------------------------

    setUsageItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              search: value,
              item_id: "",
              item_name: "",
              unit: "",
              suggestions: [],
            }
          : item
      )
    );

    // --------------------------------------------------------
    // Clear existing timer
    // --------------------------------------------------------

    if (searchTimers.current[index]) {
      clearTimeout(
        searchTimers.current[index]
      );
    }

    const searchValue = value.trim();

    // --------------------------------------------------------
    // Empty search
    // --------------------------------------------------------

    if (!searchValue) {
      setSearchLoading((prev) => ({
        ...prev,
        [index]: false,
      }));

      return;
    }

    // --------------------------------------------------------
    // Require at least 2 characters
    // --------------------------------------------------------

    if (searchValue.length < 2) {
      setSearchLoading((prev) => ({
        ...prev,
        [index]: false,
      }));

      return;
    }

    // --------------------------------------------------------
    // Start loading
    // --------------------------------------------------------

    setSearchLoading((prev) => ({
      ...prev,
      [index]: true,
    }));

    // --------------------------------------------------------
    // Delay search
    // --------------------------------------------------------

    searchTimers.current[index] = setTimeout(
      async () => {
        try {
          const results = await fetchItems(
            searchValue
          );

          setUsageItems((prev) =>
            prev.map((item, i) =>
              i === index
                ? {
                    ...item,
                    suggestions: results,
                  }
                : item
            )
          );
        } catch (err) {
          console.error(
            "Item search failed:",
            err
          );

          setUsageItems((prev) =>
            prev.map((item, i) =>
              i === index
                ? {
                    ...item,
                    suggestions: [],
                  }
                : item
            )
          );
        } finally {
          setSearchLoading((prev) => ({
            ...prev,
            [index]: false,
          }));
        }
      },
      300
    );
  };

  // ==========================================================
  // SELECT ITEM
  // ==========================================================

  const selectItem = (index, item) => {
    setUsageItems((prev) =>
      prev.map((usageItem, i) =>
        i === index
          ? {
              ...usageItem,
              item_id: item.id,
              item_name: item.name,
              unit: item.unit || "",
              search: item.name,
              suggestions: [],
            }
          : usageItem
      )
    );

    setOpenSearchRow(null);
  };

  // ==========================================================
  // UPDATE QUANTITY
  // ==========================================================

  const updateQuantity = (
    index,
    value
  ) => {
    setUsageItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              quantity_used: value,
            }
          : item
      )
    );
  };

  // ==========================================================
  // RESET FORM
  // ==========================================================

  const resetForm = () => {
    const today = new Date();

    const formattedDate =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    setLocationId("");
    setUsageDate(formattedDate);
    setNote("");

    setUsageItems([
      {
        item_id: "",
        item_name: "",
        unit: "",
        quantity_used: "",
        search: "",
        suggestions: [],
      },
    ]);

    setOpenSearchRow(null);
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (!locationId) {
      showMessage(
        "Please select a location."
      );
      return;
    }

    // --------------------------------------------------------
    // DATE
    // --------------------------------------------------------

    if (!usageDate) {
      showMessage(
        "Please select the usage date."
      );
      return;
    }

    // --------------------------------------------------------
    // ITEMS
    // --------------------------------------------------------

    if (!usageItems.length) {
      showMessage(
        "At least one item is required."
      );
      return;
    }

    // --------------------------------------------------------
    // VALIDATE ITEMS
    // --------------------------------------------------------

    const cleanedItems = [];

    for (
      let i = 0;
      i < usageItems.length;
      i++
    ) {
      const item = usageItems[i];

      if (!item.item_id) {
        showMessage(
          `Please select an item on row ${
            i + 1
          }.`
        );
        return;
      }

      const quantity = Number(
        item.quantity_used
      );

      if (
        !item.quantity_used ||
        quantity <= 0
      ) {
        showMessage(
          `Quantity must be greater than zero on row ${
            i + 1
          }.`
        );
        return;
      }

      cleanedItems.push({
        item_id: Number(item.item_id),
        quantity_used: quantity,
      });
    }

    // --------------------------------------------------------
    // DUPLICATE ITEMS
    // --------------------------------------------------------

    const itemIds = cleanedItems.map(
      (item) => item.item_id
    );

    if (
      new Set(itemIds).size !==
      itemIds.length
    ) {
      showMessage(
        "The same item cannot be added more than once."
      );
      return;
    }

    // --------------------------------------------------------
    // PAYLOAD
    // --------------------------------------------------------

    const payload = {
      location_id: Number(locationId),
      usage_date: usageDate,
      note: note.trim() || null,
      items: cleanedItems,
    };

    console.log(
      "Creating catering usage:",
      payload
    );

    // --------------------------------------------------------
    // SEND
    // --------------------------------------------------------

    try {
      setLoading(true);

      const response = await axios.post(
        "/catering/usage",
        payload
      );

      console.log(
        "Usage created:",
        response.data
      );

      showMessage(
        "Catering usage recorded successfully.",
        "success"
      );

      resetForm();
    } catch (err) {
      console.error(
        "Failed to create catering usage:",
        err
      );

      console.error(
        "Server response:",
        err.response?.data
      );

      showMessage(
        err.response?.data?.detail ||
          "Failed to record catering usage."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loadingData) {
    return (
      <div className="create-usage-container">
        <div className="usage-loading">
          Loading usage form...
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="create-usage-container">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="create-usage-header">
        <div>
          <h2>
            📊 Record Catering Usage
          </h2>

          <p>
            Record items consumed at a
            catering location.
          </p>
        </div>
      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div
          className={`usage-message ${
            messageType === "success"
              ? "success-message"
              : "error-message"
          }`}
        >
          {message}
        </div>
      )}

      {/* ======================================================
          FORM
      ====================================================== */}

      <form
        className="create-usage-form"
        onSubmit={handleSubmit}
      >

        {/* ====================================================
            USAGE INFORMATION
        ==================================================== */}

        <div className="usage-form-section">

          <div className="section-title">
            Usage Information
          </div>

          <div className="usage-form-grid">

            {/* LOCATION */}

            <div className="usage-form-group">

              <label>
                Location <span>*</span>
              </label>

              <select
                value={locationId}
                onChange={(e) =>
                  setLocationId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select Location
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

            {/* DATE */}

            <div className="usage-form-group">

              <label>
                Usage Date <span>*</span>
              </label>

              <input
                type="date"
                value={usageDate}
                onChange={(e) =>
                  setUsageDate(
                    e.target.value
                  )
                }
              />

            </div>

            {/* NOTE */}

            <div className="usage-form-group usage-note-group">

              <label>
                Note
              </label>

              <input
                type="text"
                value={note}
                onChange={(e) =>
                  setNote(e.target.value)
                }
                placeholder="Optional note..."
              />

            </div>

          </div>

        </div>

        {/* ====================================================
            ITEMS
        ==================================================== */}

        <div className="usage-form-section usage-items-section">

          <div className="items-header">

            <div className="section-title">
              Items Used
            </div>

            <button
              type="button"
              className="add-item-btn"
              onClick={addItemRow}
              disabled={loading}
            >
              + Add Item
            </button>

          </div>

          {/* ==================================================
              ITEMS TABLE
          ================================================== */}

          <div className="usage-items-table-wrapper">

            <table className="usage-items-table">

              <thead>
                <tr>
                  <th className="number-column">
                    #
                  </th>

                  <th className="item-column">
                    Item
                  </th>

                  <th className="quantity-column">
                    Quantity Used
                  </th>

                  <th className="unit-column">
                    Unit
                  </th>

                  <th className="action-column">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>

                {usageItems.map(
                  (usageItem, index) => (

                    <tr
                      key={index}
                      className={
                        openSearchRow === index
                          ? "search-row-active"
                          : ""
                      }
                    >

                      {/* NUMBER */}

                      <td className="row-number">
                        {index + 1}
                      </td>

                      {/* ITEM SEARCH */}

                      <td className="item-cell">

                        <div className="usage-autocomplete">

                          <input
                            type="text"
                            className="item-search-input"
                            value={
                              usageItem.search
                            }
                            placeholder="Type item name..."
                            autoComplete="off"

                            onFocus={() => {
                              setOpenSearchRow(
                                index
                              );

                              if (
                                usageItem.search?.trim()
                              ) {
                                searchItems(
                                  index,
                                  usageItem.search
                                );
                              }
                            }}

                            onChange={(e) =>
                              searchItems(
                                index,
                                e.target.value
                              )
                            }
                          />

                          {/* =================================================
                              SEARCH DROPDOWN
                          ================================================= */}

                          {openSearchRow ===
                            index && (

                            <div className="usage-search-dropdown">

                              {/* SEARCHING */}

                              {searchLoading[
                                index
                              ] ? (

                                <div className="usage-search-status">
                                  Searching...
                                </div>

                              ) : usageItem
                                  .suggestions
                                  ?.length > 0 ? (

                                <div className="usage-search-results">

                                  {usageItem.suggestions.map(
                                    (item) => (

                                      <button
                                        type="button"
                                        key={
                                          item.id
                                        }
                                        className="usage-search-option"
                                        onMouseDown={(
                                          e
                                        ) => {
                                          e.preventDefault();

                                          selectItem(
                                            index,
                                            item
                                          );
                                        }}
                                      >

                                        <span className="usage-search-item-name">
                                          {item.name}
                                        </span>

                                        <span className="usage-search-item-unit">
                                          {item.unit ||
                                            "-"}
                                        </span>

                                      </button>

                                    )
                                  )}

                                </div>

                              ) : usageItem
                                  .search
                                  ?.trim()
                                  .length >=
                                2 ? (

                                <div className="usage-search-status">
                                  No items found.
                                </div>

                              ) : (

                                <div className="usage-search-status">
                                  Type at least 2 characters.
                                </div>

                              )}

                            </div>

                          )}

                        </div>

                      </td>

                      {/* QUANTITY */}

                      <td>

                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          value={
                            usageItem.quantity_used
                          }
                          onChange={(e) =>
                            updateQuantity(
                              index,
                              e.target.value
                            )
                          }
                          placeholder="0"
                        />

                      </td>

                      {/* UNIT */}

                      <td className="unit-display">
                        {usageItem.unit || "-"}
                      </td>

                      {/* REMOVE */}

                      <td>

                        <button
                          type="button"
                          className="remove-item-btn"
                          onClick={() =>
                            removeItemRow(
                              index
                            )
                          }
                          disabled={loading}
                          title="Remove item"
                        >
                          ✕
                        </button>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* ====================================================
            ACTIONS
        ==================================================== */}

        <div className="usage-form-actions">

          <button
            type="button"
            className="reset-usage-btn"
            onClick={resetForm}
            disabled={loading}
          >
            Clear
          </button>

          <button
            type="submit"
            className="save-usage-btn"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save Usage"}
          </button>

        </div>

      </form>

    </div>
  );
};

export default CreateUsage;