
// src/components/locations/StoreIssueRecord.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StoreIssueRecord.css";

const StoreIssueRecord = () => {
  const [records, setRecords] = useState([]);
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

  // ==========================================================
  // DEFAULT DATE = TODAY
  // ==========================================================

  const getToday = () => {
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

  const [dateFrom, setDateFrom] =
    useState(getToday());

  const [dateTo, setDateTo] =
    useState(getToday());

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
        error.response?.data?.detail ||
          "Failed to load locations.",
        "error"
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  // ==========================================================
  // FETCH STORE ISSUE RECORDS
  // ==========================================================

  const fetchRecords = async () => {
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
        ? `/locations/location-issue-control?${queryString}`
        : "/locations/location-issue-control";

      const response =
        await axiosWithAuth().get(url);

      setRecords(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error) {
      console.error(
        "Error loading store issue records:",
        error
      );

      setRecords([]);

      showMessage(
        error.response?.data?.detail ||
          "Failed to load store issue records.",
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
  // LOAD RECORDS WHEN FILTER CHANGES
  // ==========================================================

  useEffect(() => {
    fetchRecords();
  }, [
    locationFilter,
    dateFrom,
    dateTo,
  ]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const getLocationName = (record) => {
    if (record?.location_name) {
      return record.location_name;
    }

    const location = locations.find(
      (item) =>
        Number(item.id) ===
        Number(record?.location_id)
    );

    return location?.name || "-";
  };

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

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
    if (!date) {
      return "-";
    }

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
  // FILTER RECORDS
  // ==========================================================

  const filteredRecords = useMemo(() => {
    const value =
      search
        .trim()
        .toLowerCase();

    return records.filter(
      (record) => {
        const locationName =
          getLocationName(record);

        const searchText = [
          record?.item_id,
          record?.item_name,
          record?.unit,
          record?.location_id,
          locationName,
          record?.issue_date,
          record?.quantity,
          record?.unit_price,
          record?.total_amount,
        ]
          .join(" ")
          .toLowerCase();

        return (
          !value ||
          searchText.includes(value)
        );
      }
    );
  }, [
    records,
    search,
    locations,
  ]);

  // ==========================================================
  // SUMMARY
  // ==========================================================

  const totalQuantity = useMemo(() => {
    return filteredRecords.reduce(
      (total, record) =>
        total +
        Number(
          record?.quantity || 0
        ),
      0
    );
  }, [filteredRecords]);

  const totalAmount = useMemo(() => {
    return filteredRecords.reduce(
      (total, record) =>
        total +
        Number(
          record?.total_amount || 0
        ),
      0
    );
  }, [filteredRecords]);

  const uniqueItems = useMemo(() => {
    return new Set(
      filteredRecords.map(
        (record) =>
          record?.item_id
      )
    ).size;
  }, [filteredRecords]);

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");

    const today = getToday();

    setDateFrom(today);
    setDateTo(today);
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="store-issue-record-container">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="store-issue-record-header">

        <div className="store-issue-title-section">

          <div className="store-issue-title-icon">
            SR
          </div>

          <div>
            <h2>
              Store Issue Record
            </h2>

            <p>
              Record of items received
              from the central store.
            </p>
          </div>

        </div>

        <div className="store-issue-summary-container">

          <div className="store-issue-summary">

            <span>
              Records
            </span>

            <strong>
              {filteredRecords.length}
            </strong>

          </div>

          <div className="store-issue-summary">

            <span>
              Items
            </span>

            <strong>
              {uniqueItems}
            </strong>

          </div>

          <div className="store-issue-summary">

            <span>
              Quantity
            </span>

            <strong>
              {formatNumber(
                totalQuantity
              )}
            </strong>

          </div>

          <div className="store-issue-summary amount-summary">

            <span>
              Amount
            </span>

            <strong>
              ₦
              {formatNumber(
                totalAmount
              )}
            </strong>

          </div>

        </div>

      </div>

      {/* ====================================================
          MESSAGE
      ==================================================== */}

      {message && (
        <div
          className={`store-issue-message ${
            messageType === "error"
              ? "store-issue-error"
              : "store-issue-success"
          }`}
        >
          {message}
        </div>
      )}

      {/* ====================================================
          FILTER PANEL
      ==================================================== */}

      <div className="store-issue-filter-panel">

        {/* SEARCH */}

        <div className="store-issue-filter-group search-group">

          <label>
            Search
          </label>

          <input
            type="text"
            placeholder="Search item or location..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        {/* LOCATION */}

        <div className="store-issue-filter-group">

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

        <div className="store-issue-filter-group">

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

        <div className="store-issue-filter-group">

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

        {/* CLEAR */}

        <button
          type="button"
          className="store-issue-clear-btn"
          onClick={
            clearFilters
          }
        >
          Clear
        </button>

      </div>

      {/* ====================================================
          CURRENT DATE DISPLAY
      ==================================================== */}

      <div className="store-issue-date-display">

        <span>
          Showing records for
        </span>

        <strong>
          {dateFrom === dateTo
            ? formatDate(dateFrom)
            : `${formatDate(
                dateFrom
              )} — ${formatDate(
                dateTo
              )}`}
        </strong>

      </div>

      {/* ====================================================
          TABLE CARD
      ==================================================== */}

      <div className="store-issue-record-card">

        <div className="store-issue-table-wrapper">

          <table className="store-issue-record-table">

            <thead>

              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Location</th>
                <th>Item</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Amount</th>
              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="store-issue-table-loading"
                  >
                    Loading store issue
                    records...
                  </td>
                </tr>
              ) : filteredRecords.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="store-issue-table-empty"
                  >
                    No store issue
                    records found for
                    the selected date.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(
                  (
                    record,
                    index
                  ) => (
                    <tr
                      key={`${record.item_id}-${record.issue_date}-${index}`}
                    >

                      <td className="store-issue-number">
                        {index + 1}
                      </td>

                      <td className="store-issue-date-cell">
                        {formatDate(
                          record.issue_date
                        )}
                      </td>

                      <td className="store-issue-location-cell">

                        <strong>
                          {getLocationName(
                            record
                          )}
                        </strong>

                      </td>

                      <td className="store-issue-item-cell">

                        <strong>
                          {
                            record.item_name ||
                            `Item #${record.item_id}`
                          }
                        </strong>

                        <small>
                          ID:{" "}
                          {
                            record.item_id
                          }
                        </small>

                      </td>

                      <td>
                        {record.unit ||
                          "-"}
                      </td>

                      <td className="store-issue-quantity-cell">

                        {formatNumber(
                          record.quantity
                        )}

                      </td>

                      <td>

                        {record.unit_price !==
                        null &&
                        record.unit_price !==
                        undefined
                          ? `₦${formatNumber(
                              record.unit_price
                            )}`
                          : "-"}

                      </td>

                      <td className="store-issue-total-cell">

                        {record.total_amount !==
                        null &&
                        record.total_amount !==
                        undefined
                          ? `₦${formatNumber(
                              record.total_amount
                            )}`
                          : "-"}

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
};

export default StoreIssueRecord;
