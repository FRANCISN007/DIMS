// src/components/catering/ListUsage.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListUsage.css";

const ListUsage = () => {
  const [usages, setUsages] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingLocations, setLoadingLocations] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedUsage, setSelectedUsage] =
    useState(null);

  const [showViewModal, setShowViewModal] =
    useState(false);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [showVoidModal, setShowVoidModal] =
    useState(false);

  const [editForm, setEditForm] = useState({
    location_id: "",
    usage_date: "",
    note: "",
    items: [],
  });

  const [voidReason, setVoidReason] =
    useState("");

  const [saving, setSaving] = useState(false);

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
        await axiosWithAuth().get(
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
        "Failed to load locations.",
        "error"
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  // ==========================================================
  // FETCH USAGES
  // ==========================================================

  const fetchUsages = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

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
        await axiosWithAuth().get(url);

      setUsages(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Error loading catering usages:",
        error
      );

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
  }, []);

  // ==========================================================
  // LOAD USAGE WHEN SERVER FILTER CHANGES
  // ==========================================================

  useEffect(() => {
    fetchUsages();
  }, [
    locationFilter,
    dateFrom,
    dateTo,
  ]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const getLocationName = (usage) => {
    if (usage?.location?.name) {
      return usage.location.name;
    }

    if (usage?.location_name) {
      return usage.location_name;
    }

    const location = locations.find(
      (item) =>
        Number(item.id) ===
        Number(usage?.location_id)
    );

    return location?.name || "-";
  };

  const getItemName = (item) => {
    return (
      item?.item?.name ||
      item?.item_name ||
      item?.name ||
      `Item #${item?.item_id ?? "-"}`
    );
  };

  const getItems = (usage) => {
    return Array.isArray(usage?.items)
      ? usage.items
      : [];
  };

  const getTotalQuantity = (usage) => {
    return getItems(usage).reduce(
      (total, item) =>
        total +
        Number(
          item?.quantity_used || 0
        ),
      0
    );
  };

  const getTotalAmount = (usage) => {
    return getItems(usage).reduce(
      (total, item) =>
        total +
        Number(
          item?.total_amount || 0
        ),
      0
    );
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const parsed = new Date(date);

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

  const formatDateTime = (date) => {
    if (!date) return "-";

    const parsed = new Date(date);

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

  const formatNumber = (value) => {
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
  // FRONTEND SEARCH / STATUS FILTER
  // ==========================================================

  const filteredUsages = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    return usages.filter((usage) => {
      const items = getItems(usage);

      const itemText = items
        .map((item) =>
          getItemName(item)
        )
        .join(" ");

      const locationName =
        getLocationName(usage);

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
        searchText.includes(value);

      const matchesStatus =
        !statusFilter ||
        usage?.status ===
          statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    usages,
    search,
    statusFilter,
    locations,
  ]);

  // ==========================================================
  // VIEW
  // ==========================================================

  const handleView = async (usage) => {
    try {
      const response =
        await axiosWithAuth().get(
          `/catering/usage/${usage.id}`
        );

      setSelectedUsage(
        response.data
      );

      setShowViewModal(true);
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

  const handleEdit = async (usage) => {
    if (
      usage.status === "voided"
    ) {
      showMessage(
        "A voided catering usage cannot be edited.",
        "error"
      );

      return;
    }

    try {
      const response =
        await axiosWithAuth().get(
          `/catering/usage/${usage.id}`
        );

      const data =
        response.data;

      setSelectedUsage(data);

      setEditForm({
        location_id:
          data.location_id || "",

        usage_date:
          data.usage_date
            ? String(
                data.usage_date
              ).slice(0, 10)
            : "",

        note:
          data.note || "",

        items:
          (data.items || []).map(
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

      setShowEditModal(true);
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
  // EDIT ITEM QUANTITY
  // ==========================================================

  const handleEditQuantity = (
    index,
    value
  ) => {
    setEditForm((prev) => {
      const items = [
        ...prev.items,
      ];

      items[index] = {
        ...items[index],

        quantity_used:
          value === ""
            ? ""
            : Number(value),
      };

      return {
        ...prev,
        items,
      };
    });
  };

    // ==========================================================
    // REMOVE EDIT ITEM
    // ==========================================================

    const handleRemoveEditItem = (index) => {
    setEditForm((prev) => {
        const items = [...prev.items];

        items.splice(index, 1);

        return {
        ...prev,
        items,
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

    const invalidItem =
      editForm.items.find(
        (item) =>
          !item.quantity_used ||
          Number(
            item.quantity_used
          ) <= 0
      );

    if (invalidItem) {
      showMessage(
        "All item quantities must be greater than zero.",
        "error"
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        location_id: Number(
          editForm.location_id
        ),

        usage_date:
          editForm.usage_date,

        note:
          editForm.note || null,

        items:
          editForm.items.map(
            (item) => ({
              item_id: Number(
                item.item_id
              ),

              quantity_used:
                Number(
                  item.quantity_used
                ),
            })
          ),
      };

      await axiosWithAuth().put(
        `/catering/usage/${selectedUsage.id}`,
        payload
      );

      setShowEditModal(false);
      setSelectedUsage(null);

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
  // VOID
  // ==========================================================

  const openVoidModal = (
    usage
  ) => {
    if (
      usage.status === "voided"
    ) {
      showMessage(
        "This catering usage has already been voided.",
        "error"
      );

      return;
    }

    setSelectedUsage(usage);
    setVoidReason("");
    setShowVoidModal(true);
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

      await axiosWithAuth().post(
        `/catering/usage/${selectedUsage.id}/void`,
        payload
      );

      setShowVoidModal(false);
      setSelectedUsage(null);
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
  // CLOSE MODALS
  // ==========================================================

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedUsage(null);
  };

  const closeEditModal = () => {
    if (saving) return;

    setShowEditModal(false);
    setSelectedUsage(null);
  };

  const closeVoidModal = () => {
    if (saving) return;

    setShowVoidModal(false);
    setSelectedUsage(null);
    setVoidReason("");
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setDateFrom("");
    setDateTo("");
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
            Total Records
          </span>

          <strong>
            {filteredUsages.length}
          </strong>

        </div>

      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <div
          className={`usage-list-message ${
            messageType === "error"
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
            value={locationFilter}
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
                  {location.name}
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
            value={dateFrom}
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
            value={dateTo}
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
            value={statusFilter}
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
          TABLE
      ==================================================== */}

      <div className="usage-list-card">

        <div className="usage-list-table-wrapper">

          <table className="usage-list-table">

            <thead>

              <tr>
                <th>#</th>
                <th>Usage Date</th>
                <th>Location</th>
                <th>Items Used</th>
                <th>Total Qty</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="usage-table-loading"
                  >
                    Loading catering usage...
                  </td>
                </tr>
              ) : filteredUsages.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="usage-table-empty"
                  >
                    No catering usage found.
                  </td>
                </tr>
              ) : (
                filteredUsages.map(
                  (
                    usage,
                    index
                  ) => {

                    const items =
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

                        <td className="usage-number">
                          {index + 1}
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

                          {items.length ===
                          0 ? (
                            "-"
                          ) : (
                            <div className="usage-item-preview">

                              {items
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
                                      {getItemName(
                                        item
                                      )}
                                      {" × "}
                                      {
                                        item.quantity_used
                                      }
                                    </span>
                                  )
                                )}

                              {items.length >
                                2 && (
                                <small>
                                  +
                                  {items.length -
                                    2}{" "}
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
                            {usage.status ||
                              "active"}
                          </span>

                        </td>

                        <td className="usage-note-cell">
                          {usage.note ||
                            "-"}
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
                              index
                            }
                          >
                            <td>
                              {index + 1}
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
                    Edit Catering Usage #
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

                  <div className="usage-edit-group edit-note-group">

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
                        Review and adjust
                        quantities
                      </span>
                    </div>

                    <strong>
                      {
                        editForm.items
                          .length
                      }{" "}
                      item
                      {editForm.items
                        .length !== 1
                        ? "s"
                        : ""}
                    </strong>

                  </div>

                  <div className="edit-items-table-wrapper">

                    <table>

                      <thead>
                        <tr>
                            <th>#</th>
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
                              }
                            >

                              <td>
                                {
                                  index +
                                  1
                                }
                              </td>

                              <td>
                                <strong>
                                  {
                                    item.item_name
                                  }
                                </strong>
                              </td>

                              <td>

                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantity_used}
                                onChange={(e) =>
                                handleEditQuantity(
                                    index,
                                    e.target.value
                                )
                                }
                            />

                            </td>

                            <td>
                            <button
                                type="button"
                                className="edit-remove-item-btn"
                                onClick={() =>
                                handleRemoveEditItem(index)
                                }
                                disabled={saving}
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
                    Void Catering Usage
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
                  Voiding this usage
                  will restore all
                  used quantities
                  back to the selected
                  location's inventory.
                </p>

                <p>
                  The usage record will
                  not be deleted. It will
                  be marked as{" "}
                  <b>
                    voided
                  </b>{" "}
                  for audit purposes.
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