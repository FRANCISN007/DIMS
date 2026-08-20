// src/components/catering/ListUsage.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListUsage.css";

const ListUsage = () => {
  const axios = axiosWithAuth();

  // ==========================================================
  // TODAY DATE
  // ==========================================================

  const getTodayDate = () => {
    const today = new Date();

    const year = today.getFullYear();

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = getTodayDate();

  // ==========================================================
  // STATE
  // ==========================================================

  const [usages, setUsages] = useState([]);

  const [locations, setLocations] = useState([]);

  const [items, setItems] = useState([]);

  const [total, setTotal] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingLocations, setLoadingLocations] =
    useState(false);

  const [loadingItems, setLoadingItems] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [locationFilter, setLocationFilter] =
    useState("");

  const [itemFilter, setItemFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  // ==========================================================
  // DEFAULT DATE = TODAY
  // ==========================================================

  const [dateFrom, setDateFrom] =
    useState(today);

  const [dateTo, setDateTo] =
    useState(today);

  // ==========================================================
  // MODALS
  // ==========================================================

  const [selectedUsage, setSelectedUsage] =
    useState(null);

  const [showViewModal, setShowViewModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showVoidModal, setShowVoidModal] =
    useState(false);

  // ==========================================================
  // EDIT FORM
  // ==========================================================

  const [editForm, setEditForm] =
    useState({
      location_id: "",
      usage_date: "",
      note: "",
      items: [],
    });

  // ==========================================================
  // VOID
  // ==========================================================

  const [voidReason, setVoidReason] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  // ==========================================================
  // MESSAGE
  // ==========================================================

  const showMessage = (
    text,
    type = "success"
  ) => {
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

      const response =
        await axios.get(
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
  //
  // This supplies the Item filter dropdown.
  //
  // IMPORTANT:
  // If your actual simple item endpoint is different,
  // change only the URL below.
  // ==========================================================

  const fetchItems = async () => {
    try {
      setLoadingItems(true);

      const response =
        await axios.get(
          "/store/items/simple-search",
        );

      const data =
        Array.isArray(response.data)
          ? response.data
          : [];

      setItems(data);
    } catch (error) {
      console.error(
        "Error loading items:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to load catering items.",
        "error"
      );
    } finally {
      setLoadingItems(false);
    }
  };

  // ==========================================================
  // FETCH USAGES
  // ==========================================================

  const fetchUsages = async () => {
    try {
      setLoading(true);

      const params =
        new URLSearchParams();

      // ------------------------------------------------------
      // LOCATION
      // ------------------------------------------------------

      if (locationFilter) {
        params.append(
          "location_id",
          locationFilter
        );
      }

      // ------------------------------------------------------
      // ITEM
      // ------------------------------------------------------

      if (itemFilter) {
        params.append(
          "item_id",
          itemFilter
        );
      }

      // ------------------------------------------------------
      // START DATE
      // ------------------------------------------------------

      if (dateFrom) {
        params.append(
          "start_date",
          dateFrom
        );
      }

      // ------------------------------------------------------
      // END DATE
      // ------------------------------------------------------

      if (dateTo) {
        params.append(
          "end_date",
          dateTo
        );
      }

      const queryString =
        params.toString();

      const url = queryString
        ? `/catering/usage?${queryString}`
        : "/catering/usage";

      const response =
        await axios.get(url);

      // ======================================================
      // NEW BACKEND RESPONSE
      //
      // {
      //   "usages": [...],
      //   "total": {...}
      // }
      // ======================================================

      const responseData =
        response.data || {};

      setUsages(
        Array.isArray(
          responseData.usages
        )
          ? responseData.usages
          : []
      );

      setTotal(
        responseData.total || null
      );
    } catch (error) {
      console.error(
        "Error loading catering usages:",
        error
      );

      setUsages([]);
      setTotal(null);

      showMessage(
        error.response?.data?.detail ||
          "Failed to load catering usage.",
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
  }, []);

  // ==========================================================
  // FETCH WHEN SERVER FILTER CHANGES
  // ==========================================================

  useEffect(() => {
    fetchUsages();
  }, [
    locationFilter,
    itemFilter,
    dateFrom,
    dateTo,
  ]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const getLocationName = (
    usage
  ) => {
    if (usage?.location?.name) {
      return usage.location.name;
    }

    if (usage?.location_name) {
      return usage.location_name;
    }

    const location =
      locations.find(
        (item) =>
          Number(item.id) ===
          Number(
            usage?.location_id
          )
      );

    return location?.name || "-";
  };

  // ==========================================================
  // ITEM NAME
  // ==========================================================

  const getItemName = (
    item
  ) => {
    return (
      item?.item?.name ||
      item?.item_name ||
      item?.name ||
      `Item #${
        item?.item_id ?? "-"
      }`
    );
  };

  // ==========================================================
  // ITEMS
  // ==========================================================

  const getItems = (
    usage
  ) => {
    return Array.isArray(
      usage?.items
    )
      ? usage.items
      : [];
  };

  // ==========================================================
  // TOTAL QUANTITY
  //
  // When item filter is active, the backend already returns
  // only the selected item inside usage.items.
  // ==========================================================

  const getTotalQuantity = (
    usage
  ) => {
    return getItems(usage).reduce(
      (
        totalValue,
        item
      ) =>
        totalValue +
        Number(
          item?.quantity_used || 0
        ),
      0
    );
  };

  // ==========================================================
  // TOTAL AMOUNT
  // ==========================================================

  const getTotalAmount = (
    usage
  ) => {
    return getItems(usage).reduce(
      (
        totalValue,
        item
      ) =>
        totalValue +
        Number(
          item?.total_amount || 0
        ),
      0
    );
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (
    date
  ) => {
    if (!date) return "-";

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ==========================================================
  // FORMAT DATE TIME
  // ==========================================================

  const formatDateTime = (
    date
  ) => {
    if (!date) return "-";

    const parsed =
      new Date(date);

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return date;
    }

    return parsed.toLocaleString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // ==========================================================
  // FORMAT NUMBER
  // ==========================================================

  const formatNumber = (
    value
  ) => {
    return Number(
      value || 0
    ).toLocaleString(
      "en-NG",
      {
        maximumFractionDigits: 2,
      }
    );
  };

  // ==========================================================
  // GET SELECTED ITEM NAME
  // ==========================================================

  const selectedItemName =
    useMemo(() => {
      if (!itemFilter) {
        return null;
      }

      if (
        total?.item_name
      ) {
        return total.item_name;
      }

      const selected =
        items.find(
          (item) =>
            Number(item.id) ===
            Number(itemFilter)
        );

      return (
        selected?.name ||
        `Item #${itemFilter}`
      );
    }, [
      itemFilter,
      total,
      items,
    ]);

  // ==========================================================
  // SEARCH + STATUS FILTER
  //
  // Search is still performed locally.
  //
  // Location and item filtering are performed by the backend.
  // ==========================================================

  const filteredUsages =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return usages.filter(
        (usage) => {
          const usageItems =
            getItems(usage);

          const itemText =
            usageItems
              .map(
                (item) =>
                  getItemName(
                    item
                  )
              )
              .join(" ");

          const locationName =
            getLocationName(
              usage
            );

          const searchText = [
            usage?.id,
            usage?.usage_date,
            locationName,
            itemText,
            usage?.note,
            usage?.status,
          ]
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !value ||
            searchText.includes(
              value
            );

          const matchesStatus =
            !statusFilter ||
            usage?.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      usages,
      search,
      statusFilter,
      locations,
    ]);

  // ==========================================================
  // VIEW
  // ==========================================================

  const handleView = async (
    usage
  ) => {
    try {
      const response =
        await axios.get(
          `/catering/usage/${usage.id}`
        );

      setSelectedUsage(
        response.data
      );

      setShowViewModal(
        true
      );
    } catch (error) {
      console.error(error);

      showMessage(
        error.response?.data?.detail ||
          "Failed to load usage details.",
        "error"
      );
    }
  };

  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit = async (
    usage
  ) => {
    if (
      usage.status ===
      "voided"
    ) {
      showMessage(
        "A voided catering usage cannot be edited.",
        "error"
      );

      return;
    }

    try {
      const response =
        await axios.get(
          `/catering/usage/${usage.id}`
        );

      const data =
        response.data;

      setSelectedUsage(data);

      setEditForm({
        location_id:
          data.location_id ||
          "",

        usage_date:
          data.usage_date
            ? String(
                data.usage_date
              ).slice(0, 10)
            : "",

        note:
          data.note || "",

        items:
          (
            data.items || []
          ).map(
            (item) => ({
              item_id:
                item.item_id,

              item_name:
                item?.item?.name ||
                item?.item_name ||
                item?.name ||
                `Item #${item.item_id}`,

              quantity_used:
                item.quantity_used,

              unit_price:
                item.unit_price,

              total_amount:
                item.total_amount,
            })
          ),
      });

      setShowEditModal(
        true
      );
    } catch (error) {
      console.error(error);

      showMessage(
        error.response?.data?.detail ||
          "Failed to load usage for editing.",
        "error"
      );
    }
  };

  // ==========================================================
  // EDIT QUANTITY
  // ==========================================================

  const handleEditQuantity = (
    index,
    value
  ) => {
    setEditForm((prev) => {
      const newItems = [
        ...prev.items,
      ];

      newItems[index] = {
        ...newItems[index],

        quantity_used:
          value === ""
            ? ""
            : Number(value),
      };

      return {
        ...prev,
        items: newItems,
      };
    });
  };

    // ==========================================================
    // REMOVE ITEM
    // ==========================================================

    const handleRemoveEditItem = (
      index
    ) => {
      setEditForm((prev) => {
        const newItems = [
          ...prev.items,
        ];

        newItems.splice(index, 1);

        return {
          ...prev,
          items: newItems,
        };
      });
    };


    // ==========================================================
    // ADD ITEM TO EDIT USAGE
    // ==========================================================

    const handleAddEditItem = () => {
      setEditForm((prev) => ({
        ...prev,

        items: [
          ...prev.items,

          {
            item_id: "",
            item_name: "",
            quantity_used: "",
            unit_price: 0,
            total_amount: 0,
            isNew: true,
          },
        ],
      }));
    };

    // ==========================================================
    // CHANGE EDIT ITEM
    // ==========================================================

    const handleEditItemChange = (
      index,
      itemId
    ) => {
      const selectedItem =
        items.find(
          (item) =>
            Number(item.id) ===
            Number(itemId)
        );

      setEditForm((prev) => {
        const newItems = [
          ...prev.items,
        ];

        newItems[index] = {
          ...newItems[index],

          item_id:
            itemId
              ? Number(itemId)
              : "",

          item_name:
            selectedItem?.name ||
            "",

          unit_price:
            Number(
              selectedItem?.unit_price ||
              selectedItem?.cost_price ||
              0
            ),

          total_amount: 0,
        };

        return {
          ...prev,
          items: newItems,
        };
      });
    };

  // ==========================================================
  // SAVE EDIT
  // ==========================================================

  const handleSaveEdit = async (
    e
  ) => {
    e.preventDefault();

    if (!selectedUsage) {
      return;
    }

    if (!editForm.location_id) {
      showMessage(
        "Please select a location.",
        "error"
      );

      return;
    }

    if (!editForm.usage_date) {
      showMessage(
        "Please select the usage date.",
        "error"
      );

      return;
    }

    if (!editForm.items.length) {
      showMessage(
        "At least one item is required.",
        "error"
      );

      return;
    }

        // ======================================================
        // VALIDATE ITEMS
        // ======================================================

        const invalidItem =
          editForm.items.find(
            (item) =>
              !item.item_id ||
              !item.quantity_used ||
              Number(
                item.quantity_used
              ) <= 0
          );

        if (invalidItem) {
          showMessage(
            "Every item must be selected and have a quantity greater than zero.",
            "error"
          );

          return;
        }

        // ======================================================
        // PREVENT DUPLICATE ITEMS
        // ======================================================

        const itemIds =
          editForm.items.map(
            (item) =>
              Number(item.item_id)
          );

        const hasDuplicateItems =
          new Set(itemIds).size !==
          itemIds.length;

        if (hasDuplicateItems) {
          showMessage(
            "The same item cannot be added more than once.",
            "error"
          );

          return;
        }

    try {
      setSaving(true);

      const payload = {
        location_id:
          Number(
            editForm.location_id
          ),

        usage_date:
          editForm.usage_date,

        note:
          editForm.note ||
          null,

        items:
          editForm.items.map(
            (item) => ({
              item_id:
                Number(
                  item.item_id
                ),

              quantity_used:
                Number(
                  item.quantity_used
                ),
            })
          ),
      };

      await axios.put(
        `/catering/usage/${selectedUsage.id}`,
        payload
      );

      setShowEditModal(
        false
      );

      setSelectedUsage(
        null
      );

      showMessage(
        "Catering usage updated successfully.",
        "success"
      );

      await fetchUsages();
    } catch (error) {
      console.error(
        "Update usage error:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to update catering usage.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // OPEN VOID MODAL
  // ==========================================================

  const openVoidModal = (
    usage
  ) => {
    if (
      usage.status ===
      "voided"
    ) {
      showMessage(
        "This catering usage has already been voided.",
        "error"
      );

      return;
    }

    setSelectedUsage(
      usage
    );

    setVoidReason("");

    setShowVoidModal(
      true
    );
  };

  // ==========================================================
  // CONFIRM VOID
  // ==========================================================

  const handleVoid = async () => {
    if (!selectedUsage) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        reason:
          voidReason.trim() ||
          null,
      };

      await axios.post(
        `/catering/usage/${selectedUsage.id}/void`,
        payload
      );

      setShowVoidModal(
        false
      );

      setSelectedUsage(
        null
      );

      setVoidReason("");

      showMessage(
        "Catering usage voided successfully. Stock has been restored.",
        "success"
      );

      await fetchUsages();
    } catch (error) {
      console.error(
        "Void usage error:",
        error
      );

      showMessage(
        error.response?.data?.detail ||
          "Failed to void catering usage.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // CLOSE VIEW MODAL
  // ==========================================================

  const closeViewModal = () => {
    setShowViewModal(
      false
    );

    setSelectedUsage(
      null
    );
  };

  // ==========================================================
  // CLOSE EDIT MODAL
  // ==========================================================

  const closeEditModal = () => {
    if (saving) {
      return;
    }

    setShowEditModal(
      false
    );

    setSelectedUsage(
      null
    );
  };

  // ==========================================================
  // CLOSE VOID MODAL
  // ==========================================================

  const closeVoidModal = () => {
    if (saving) {
      return;
    }

    setShowVoidModal(
      false
    );

    setSelectedUsage(
      null
    );

    setVoidReason("");
  };

  // ==========================================================
  // CLEAR FILTERS
  //
  // Reset dates to TODAY.
  // ==========================================================

  const clearFilters = () => {
    setSearch("");

    setLocationFilter("");

    setItemFilter("");

    setDateFrom(today);

    setDateTo(today);

    setStatusFilter("");
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="list-usage-container">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="list-usage-header">

        <div className="usage-title-section">

          <div className="usage-title-icon">
            CU
          </div>

          <div>
            <h2>
              Catering Usage
            </h2>

            <p>
              Monitor and manage catering
              inventory consumption.
            </p>
          </div>

        </div>

        <div className="usage-summary">

          <span>
            Records
          </span>

          <strong>
            {
              filteredUsages.length
            }
          </strong>

        </div>

      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <div
          className={`usage-list-message ${
            messageType ===
            "error"
              ? "error-message"
              : "success-message"
          }`}
        >
          {message}
        </div>
      )}

      {/* ====================================================
          FILTER PANEL
      ==================================================== */}

      <div className="usage-filter-panel">

        {/* SEARCH */}

        <div className="usage-filter-group search-group">

          <label>
            Search
          </label>

          <input
            type="text"
            placeholder="Search usage, location or item..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        {/* LOCATION */}

        <div className="usage-filter-group">

          <label>
            Location
          </label>

          <select
            value={
              locationFilter
            }
            onChange={(e) =>
              setLocationFilter(
                e.target.value
              )
            }
            disabled={
              loadingLocations
            }
          >

            <option value="">
              All Locations
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

        {/* ITEM */}

        <div className="usage-filter-group">

          <label>
            Item
          </label>

          <select
            value={
              itemFilter
            }
            onChange={(e) =>
              setItemFilter(
                e.target.value
              )
            }
            disabled={
              loadingItems
            }
          >

            <option value="">
              All Items
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
                  {
                    item.name
                  }
                </option>
              )
            )}

          </select>

        </div>

        {/* FROM DATE */}

        <div className="usage-filter-group">

          <label>
            From Date
          </label>

          <input
            type="date"
            value={
              dateFrom
            }
            onChange={(e) =>
              setDateFrom(
                e.target.value
              )
            }
          />

        </div>

        {/* TO DATE */}

        <div className="usage-filter-group">

          <label>
            To Date
          </label>

          <input
            type="date"
            value={
              dateTo
            }
            min={
              dateFrom ||
              undefined
            }
            onChange={(e) =>
              setDateTo(
                e.target.value
              )
            }
          />

        </div>

        {/* STATUS */}

        <div className="usage-filter-group">

          <label>
            Status
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
          >

            <option value="">
              All Status
            </option>

            <option value="active">
              Active
            </option>

            <option value="voided">
              Voided
            </option>

          </select>

        </div>

        {/* CLEAR */}

        <button
          type="button"
          className="clear-usage-filter"
          onClick={
            clearFilters
          }
        >
          Clear
        </button>

      </div>

      {/* ====================================================
          SELECTED ITEM TOTAL
          ==================================================== */}

      {itemFilter &&
        total && (
          <div className="usage-selected-item-total">

            <div>
              <span>
                Selected Item
              </span>

              <strong>
                {
                  selectedItemName ||
                  "-"
                }
              </strong>
            </div>

            <div>
              <span>
                Unit
              </span>

              <strong>
                {
                  total.unit ||
                  "-"
                }
              </strong>
            </div>

            <div>
              <span>
                Total Quantity Used
              </span>

              <strong>
                {formatNumber(
                  total.total_quantity
                )}
              </strong>
            </div>

          </div>
        )}

      {/* ====================================================
          TABLE
      ==================================================== */}

      <div className="usage-list-card">

        <div className="usage-table-scroll-container">

          <table className="usage-list-table">

            <thead>

              <tr>
                

                <th>
                  ID
                </th>

                <th>
                  Usage Date
                </th>

                <th>
                  Location
                </th>

                <th>
                  Items Used
                </th>

                <th>
                  Total Qty
                </th>

                <th>
                  Total Amount
                </th>

                <th>
                  Status
                </th>

                <th>
                  Note
                </th>

                <th>
                  Actions
                </th>
              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>

                  <td
                    colSpan="9"
                    className="usage-table-loading"
                  >
                    Loading catering
                    usage...
                  </td>

                </tr>
              ) : filteredUsages.length ===
                0 ? (

                <tr>

                  <td
                    colSpan="9"
                    className="usage-table-empty"
                  >
                    No catering usage
                    found for the
                    selected filters.
                  </td>

                </tr>

              ) : (

                filteredUsages.map(
                  (
                    usage,
                    index
                  ) => {

                    const usageItems =
                      getItems(
                        usage
                      );

                    return (
                      <tr
                        key={
                          usage.id
                        }
                        className={
                          usage.status ===
                          "voided"
                            ? "usage-voided-row"
                            : ""
                        }
                      >

                        

                        <td className="usage-id-cell">
                          {usage.id}
                        </td>

                        <td className="usage-date-cell">
                          {formatDate(
                            usage.usage_date
                          )}
                        </td>


                        

                        <td>

                          <strong>
                            {getLocationName(
                              usage
                            )}
                          </strong>

                        </td>

                        <td className="usage-items-cell">

                          {usageItems.length ===
                          0 ? (
                            "-"
                          ) : (

                            <div className="usage-item-preview">

                              {usageItems
                                .slice(
                                  0,
                                  2
                                )
                                .map(
                                  (
                                    item,
                                    itemIndex
                                  ) => (

                                    <span
                                      key={
                                        itemIndex
                                      }
                                    >
                                      {
                                        getItemName(
                                          item
                                        )
                                      }

                                      {" × "}

                                      {
                                        item.quantity_used
                                      }

                                    </span>

                                  )
                                )}

                              {usageItems.length >
                                2 && (

                                <small>
                                  +
                                  {
                                    usageItems.length -
                                      2
                                  }{" "}
                                  more
                                </small>

                              )}

                            </div>

                          )}

                        </td>

                        <td>

                          {formatNumber(
                            getTotalQuantity(
                              usage
                            )
                          )}

                        </td>

                        <td>

                          ₦
                          {formatNumber(
                            getTotalAmount(
                              usage
                            )
                          )}

                        </td>

                        <td>

                          <span
                            className={`usage-status ${
                              usage.status ===
                              "voided"
                                ? "status-voided"
                                : "status-active"
                            }`}
                          >
                            {
                              usage.status ||
                              "active"
                            }
                          </span>

                        </td>

                        <td className="usage-note-cell">

                          {
                            usage.note ||
                            "-"
                          }

                        </td>

                        <td>

                          <div className="usage-action-buttons">

                            <button
                              type="button"
                              className="usage-action view-action"
                              onClick={() =>
                                handleView(
                                  usage
                                )
                              }
                            >
                              View
                            </button>

                            <button
                              type="button"
                              className="usage-action edit-action"
                              disabled={
                                usage.status ===
                                "voided"
                              }
                              onClick={() =>
                                handleEdit(
                                  usage
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="usage-action void-action"
                              disabled={
                                usage.status ===
                                "voided"
                              }
                              onClick={() =>
                                openVoidModal(
                                  usage
                                )
                              }
                            >
                              Void
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ====================================================
          VIEW MODAL
      ==================================================== */}

      {showViewModal &&
        selectedUsage && (

          <div className="usage-modal-overlay">

            <div className="usage-modal usage-view-modal">

              <div className="usage-modal-header">

                <div>

                  <h3>
                    Catering Usage #
                    {
                      selectedUsage.id
                    }
                  </h3>

                  <span>
                    Usage details
                  </span>

                </div>

                <button
                  type="button"
                  className="usage-modal-close"
                  onClick={
                    closeViewModal
                  }
                >
                  ×
                </button>

              </div>

              <div className="usage-view-info">

                <div>

                  <label>
                    Usage Date
                  </label>

                  <strong>
                    {formatDate(
                      selectedUsage.usage_date
                    )}
                  </strong>

                </div>

                <div>

                  <label>
                    Location
                  </label>

                  <strong>
                    {getLocationName(
                      selectedUsage
                    )}
                  </strong>

                </div>

                <div>

                  <label>
                    Status
                  </label>

                  <span
                    className={`usage-status ${
                      selectedUsage.status ===
                      "voided"
                        ? "status-voided"
                        : "status-active"
                    }`}
                  >
                    {
                      selectedUsage.status
                    }
                  </span>

                </div>

                <div>

                  <label>
                    Note
                  </label>

                  <strong>
                    {
                      selectedUsage.note ||
                      "-"
                    }
                  </strong>

                </div>

              </div>

              <div className="usage-detail-items">

                <h4>
                  Items Used
                </h4>

                <div className="usage-detail-table-wrapper">

                  <table>

                    <thead>

                      <tr>
                        <th>#</th>
                        <th>Item</th>
                        <th>Qty Used</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>

                    </thead>

                    <tbody>

                      {getItems(
                        selectedUsage
                      ).map(
                        (
                          item,
                          index
                        ) => (

                          <tr
                            key={
                              item.id ||
                              index
                            }
                          >

                            <td>
                              {
                                index +
                                1
                              }
                            </td>

                            <td>
                              {getItemName(
                                item
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                item.quantity_used
                              )}
                            </td>

                            <td>
                              ₦
                              {formatNumber(
                                item.unit_price
                              )}
                            </td>

                            <td>
                              ₦
                              {formatNumber(
                                item.total_amount
                              )}
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>

              {selectedUsage.status ===
                "voided" && (

                <div className="void-details">

                  <strong>
                    Voided Information
                  </strong>

                  <p>
                    <b>
                      Voided By:
                    </b>{" "}
                    {
                      selectedUsage.voided_by ||
                      "-"
                    }
                  </p>

                  <p>
                    <b>
                      Voided At:
                    </b>{" "}
                    {formatDateTime(
                      selectedUsage.voided_at
                    )}
                  </p>

                  <p>
                    <b>
                      Reason:
                    </b>{" "}
                    {
                      selectedUsage.void_reason ||
                      "-"
                    }
                  </p>

                </div>

              )}

              <div className="usage-modal-footer">

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={
                    closeViewModal
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        )}

      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {showEditModal &&
        selectedUsage && (

          <div className="usage-modal-overlay">

            <div className="usage-modal usage-edit-modal">

              <div className="usage-modal-header">

                <div>

                  <h3>
                    Edit Catering
                    Usage #
                    {
                      selectedUsage.id
                    }
                  </h3>

                  <span>
                    Modify usage details
                  </span>

                </div>

                <button
                  type="button"
                  className="usage-modal-close"
                  onClick={
                    closeEditModal
                  }
                >
                  ×
                </button>

              </div>

              <form
                onSubmit={
                  handleSaveEdit
                }
              >

                <div className="usage-edit-grid">

                  <div className="usage-edit-group">

                    <label>
                      Location
                    </label>

                    <select
                      value={
                        editForm.location_id
                      }
                      onChange={(e) =>
                        setEditForm(
                          (prev) => ({
                            ...prev,
                            location_id:
                              e.target
                                .value,
                          })
                        )
                      }
                    >

                      <option value="">
                        Select Location
                      </option>

                      {locations.map(
                        (
                          location
                        ) => (

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

                  <div className="usage-edit-group">

                    <label>
                      Usage Date
                    </label>

                    <input
                      type="date"
                      value={
                        editForm.usage_date
                      }
                      onChange={(e) =>
                        setEditForm(
                          (prev) => ({
                            ...prev,
                            usage_date:
                              e.target
                                .value,
                          })
                        )
                      }
                    />

                  </div>

                  <div className="usage-edit-group">

                    <label>
                      Note
                    </label>

                    <input
                      type="text"
                      value={
                        editForm.note
                      }
                      onChange={(e) =>
                        setEditForm(
                          (prev) => ({
                            ...prev,
                            note:
                              e.target
                                .value,
                          })
                        )
                      }
                      placeholder="Optional note"
                    />

                  </div>

                </div>

                <div className="edit-items-section">

                  <div className="edit-items-title">

                    <div>

                      <h4>
                        Items Used
                      </h4>

                      <span>
                        Review, adjust quantities,
                        remove or add items
                      </span>

                    </div>

                    <div className="edit-items-title-actions">

                      <strong>
                        {
                          editForm.items.length
                        }{" "}
                        item
                        {
                          editForm.items.length !== 1
                            ? "s"
                            : ""
                        }
                      </strong>

                      <button
                        type="button"
                        className="edit-add-item-btn"
                        onClick={
                          handleAddEditItem
                        }
                        disabled={saving}
                      >
                        + Add Item
                      </button>

                    </div>

                  </div>
                  <div className="edit-items-table-wrapper">

                    <table>

                      <thead>

                        <tr>
                          <th>
                            #
                          </th>

                          <th>
                            Item
                          </th>

                          <th>
                            Quantity Used
                          </th>

                          <th>
                            Action
                          </th>
                        </tr>

                      </thead>

                      <tbody>

                        {editForm.items.map(
                          (
                            item,
                            index
                          ) => (

                            <tr
                              key={
                                item.item_id
                                  ? `item-${item.item_id}`
                                  : `new-item-${index}`
                              }
                            >

                              {/* NUMBER */}

                              <td>
                                {
                                  index + 1
                                }
                              </td>

                              {/* ITEM */}

                              <td>

                                {item.isNew ? (

                                  <select
                                    value={
                                      item.item_id || ""
                                    }
                                    onChange={(e) =>
                                      handleEditItemChange(
                                        index,
                                        e.target.value
                                      )
                                    }
                                    disabled={
                                      saving
                                    }
                                  >

                                    <option value="">
                                      Select Item
                                    </option>

                                    {items
                                      .filter(
                                        (availableItem) => {

                                          const alreadyUsed =
                                            editForm.items.some(
                                              (
                                                existingItem,
                                                existingIndex
                                              ) =>
                                                existingIndex !==
                                                  index &&
                                                Number(
                                                  existingItem.item_id
                                                ) ===
                                                  Number(
                                                    availableItem.id
                                                  )
                                            );

                                          return !alreadyUsed;
                                        }
                                      )
                                      .map(
                                        (
                                          availableItem
                                        ) => (

                                          <option
                                            key={
                                              availableItem.id
                                            }
                                            value={
                                              availableItem.id
                                            }
                                          >
                                            {
                                              availableItem.name
                                            }
                                          </option>

                                        )
                                      )}

                                  </select>

                                ) : (

                                  <strong>
                                    {
                                      item.item_name
                                    }
                                  </strong>

                                )}

                              </td>

                              {/* QUANTITY */}

                              <td>

                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    item.quantity_used
                                  }
                                  onChange={(e) =>
                                    handleEditQuantity(
                                      index,
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                />

                              </td>

                              {/* ACTION */}

                              <td>

                                <button
                                  type="button"
                                  className="edit-remove-item-btn"
                                  onClick={() =>
                                    handleRemoveEditItem(
                                      index
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                >
                                  Remove
                                </button>

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>

                <div className="usage-modal-footer">

                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={
                      closeEditModal
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="modal-save-btn"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

      {/* ====================================================
          VOID MODAL
      ==================================================== */}

      {showVoidModal &&
        selectedUsage && (

          <div className="usage-modal-overlay">

            <div className="usage-modal usage-void-modal">

              <div className="usage-modal-header">

                <div>

                  <h3>
                    Void Catering
                    Usage
                  </h3>

                  <span>
                    Usage #
                    {
                      selectedUsage.id
                    }
                  </span>

                </div>

                <button
                  type="button"
                  className="usage-modal-close"
                  onClick={
                    closeVoidModal
                  }
                >
                  ×
                </button>

              </div>

              <div className="void-warning">

                <strong>
                  Warning
                </strong>

                <p>
                  Voiding this
                  usage will
                  restore all
                  used quantities
                  back to the
                  selected
                  location's
                  inventory.
                </p>

                <p>
                  The usage record
                  will not be
                  deleted. It will
                  be marked as{" "}
                  <b>
                    voided
                  </b>{" "}
                  for audit
                  purposes.
                </p>

              </div>

              <div className="void-usage-summary">

                <div>

                  <span>
                    Location
                  </span>

                  <strong>
                    {getLocationName(
                      selectedUsage
                    )}
                  </strong>

                </div>

                <div>

                  <span>
                    Total Items
                  </span>

                  <strong>
                    {
                      getItems(
                        selectedUsage
                      ).length
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    Total Quantity
                  </span>

                  <strong>
                    {formatNumber(
                      getTotalQuantity(
                        selectedUsage
                      )
                    )}
                  </strong>

                </div>

              </div>

              <div className="void-reason-group">

                <label>
                  Void Reason
                </label>

                <textarea
                  value={
                    voidReason
                  }
                  onChange={(e) =>
                    setVoidReason(
                      e.target.value
                    )
                  }
                  placeholder="Enter reason for voiding this usage..."
                  rows="4"
                />

              </div>

              <div className="usage-modal-footer">

                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={
                    closeVoidModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-void-btn"
                  onClick={
                    handleVoid
                  }
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Voiding..."
                    : "Confirm Void"}
                </button>

              </div>

            </div>

          </div>

        )}

    </div>
  );
};

export default ListUsage;