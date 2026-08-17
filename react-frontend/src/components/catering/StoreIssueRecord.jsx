import React, { useEffect, useMemo, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StoreIssueRecord.css";

const StoreIssueRecord = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [records, setRecords] = useState([]);

  const [locations, setLocations] = useState([]);

  const [selectedLocation, setSelectedLocation] = useState("");

  /*
   * IMPORTANT:
   * Do not default these to today's date.
   *
   * The previous frontend was sending:
   *
   * start_date=2026-08-17
   * end_date=2026-08-17
   *
   * while the existing records were dated 2026-08-16.
   *
   * Empty dates allow the backend to return all available
   * records initially.
   */
  /* ==========================================================
   TODAY'S DATE
   Use local browser date so Nigeria/Lagos users get
   the correct current date.
========================================================== */

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

  const todayDate = getTodayDate();

  const [startDate, setStartDate] =
    useState(todayDate);

  const [endDate, setEndDate] =
    useState(todayDate);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  /* ==========================================================
     ERROR MESSAGE HELPER
  ========================================================== */

  const getApiErrorMessage = (err) => {
    const data = err?.response?.data;

    const detail = data?.detail;

    /* ----------------------------------------------------------
       FastAPI validation array
    ---------------------------------------------------------- */

    if (Array.isArray(detail)) {
      return detail
        .map((error) => {
          if (typeof error === "string") {
            return error;
          }

          if (
            error &&
            typeof error === "object"
          ) {
            const msg =
              error.msg ||
              error.message ||
              "Invalid request.";

            const location =
              Array.isArray(error.loc)
                ? error.loc.join(" → ")
                : "";

            return location
              ? `${location}: ${msg}`
              : String(msg);
          }

          return "Invalid request.";
        })
        .join(", ");
    }

    /* ----------------------------------------------------------
       Object detail
    ---------------------------------------------------------- */

    if (
      detail &&
      typeof detail === "object"
    ) {
      if (detail.msg) {
        return String(detail.msg);
      }

      if (detail.message) {
        return String(detail.message);
      }

      return "Invalid request.";
    }

    /* ----------------------------------------------------------
       String detail
    ---------------------------------------------------------- */

    if (typeof detail === "string") {
      return detail;
    }

    /* ----------------------------------------------------------
       API message
    ---------------------------------------------------------- */

    if (
      typeof data?.message === "string"
    ) {
      return data.message;
    }

    /* ----------------------------------------------------------
       Axios message
    ---------------------------------------------------------- */

    if (
      typeof err?.message === "string"
    ) {
      return err.message;
    }

    return "An unexpected error occurred.";
  };

  /* ==========================================================
     MESSAGE
  ========================================================== */

  const showMessage = (msg, type = "error") => {
    setMessage({
      text:
        typeof msg === "string"
          ? msg
          : getApiErrorMessage({
              response: {
                data: {
                  detail: msg,
                },
              },
            }),
      type,
    });

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  /* ==========================================================
     FETCH LOCATIONS
  ========================================================== */

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await axios.get(
          "/locations/simple"
        );

        console.log(
          "LOCATIONS RESPONSE:",
          response.data
        );

        setLocations(
          Array.isArray(response.data)
            ? response.data
            : []
        );

      } catch (err) {
        console.error(
          "FAILED TO FETCH LOCATIONS:",
          err
        );

        showMessage(
          getApiErrorMessage(err)
        );
      }
    };

    fetchLocations();
  }, []);

  /* ==========================================================
     FETCH STORE ISSUE RECORDS
  ========================================================== */

  useEffect(() => {
    fetchIssueRecords();
  }, [
    selectedLocation,
    startDate,
    endDate,
  ]);

  /* ==========================================================
     FETCH FUNCTION
  ========================================================== */

  const fetchIssueRecords = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      /* ------------------------------------------------------
         LOCATION
      ------------------------------------------------------ */

      if (selectedLocation) {
        params.append(
          "location_id",
          String(selectedLocation)
        );
      }

      /* ------------------------------------------------------
         START DATE
         Only send when selected.
      ------------------------------------------------------ */

      if (startDate) {
        params.append(
          "start_date",
          startDate
        );
      }

      /* ------------------------------------------------------
         END DATE
         Only send when selected.
      ------------------------------------------------------ */

      if (endDate) {
        params.append(
          "end_date",
          endDate
        );
      }

      const queryString =
        params.toString();

      const url = queryString
        ? `/locations/location-issue-control?${queryString}`
        : "/locations/location-issue-control";

      console.log(
        "\n=========================================="
      );

      console.log(
        "STORE ISSUE CONTROL"
      );

      console.log(
        "LOCATION FILTER:",
        selectedLocation || "ALL"
      );

      console.log(
        "START DATE:",
        startDate || "ALL"
      );

      console.log(
        "END DATE:",
        endDate || "ALL"
      );

      console.log(
        "REQUEST:",
        url
      );

      console.log(
        "=========================================="
      );

      const response = await axios.get(
        url
      );

      console.log(
        "STORE ISSUE RESPONSE:",
        response.data
      );

      setRecords(
        Array.isArray(response.data)
          ? response.data
          : []
      );

    } catch (err) {
      console.error(
        "FAILED TO FETCH STORE ISSUE RECORDS:",
        err
      );

      console.error(
        "API RESPONSE:",
        err?.response?.data
      );

      setRecords([]);

      showMessage(
        getApiErrorMessage(err)
      );

    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     FORMAT DATE
     
     Backend example:
     
     2026-08-16T01:00:00+01:00
  ========================================================== */

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );
  };

  /* ==========================================================
     FORMAT TIME
  ========================================================== */

  const formatTime = (value) => {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString(
      undefined,
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  /* ==========================================================
     FORMAT DATE + TIME
  ========================================================== */

  const formatDateTime = (value) => {
    const date = formatDate(value);
    const time = formatTime(value);

    if (!time) {
      return date;
    }

    return `${date} ${time}`;
  };

  /* ==========================================================
     FORMAT NUMBER
  ========================================================== */

  const formatNumber = (value) => {
    const number = Number(
      value || 0
    );

    if (Number.isNaN(number)) {
      return "0";
    }

    return number.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      }
    );
  };

  /* ==========================================================
     FORMAT MONEY
  ========================================================== */

  const formatMoney = (value) => {
    const number = Number(
      value || 0
    );

    if (Number.isNaN(number)) {
      return "0.00";
    }

    return number.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  /* ==========================================================
     SEARCH
     
     Search is intentionally done on the records already
     returned by the backend.
     
     This means Camp Boss cannot use search to obtain another
     location because the backend has already restricted the
     dataset.
  ========================================================== */

  const filteredRecords = useMemo(() => {
    const value =
      search.trim().toLowerCase();

    if (!value) {
      return records;
    }

    return records.filter(
      (record) => {
        const itemName =
          String(
            record?.item_name || ""
          ).toLowerCase();

        const locationName =
          String(
            record?.location_name || ""
          ).toLowerCase();

        const itemId =
          String(
            record?.item_id || ""
          ).toLowerCase();

        const unit =
          String(
            record?.unit || ""
          ).toLowerCase();

        return (
          itemName.includes(value) ||
          locationName.includes(value) ||
          itemId.includes(value) ||
          unit.includes(value)
        );
      }
    );
  }, [
    records,
    search,
  ]);

  /* ==========================================================
     TOTAL QUANTITY
  ========================================================== */

  const totalQuantity =
    filteredRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record?.quantity || 0
        ),
      0
    );

  /* ==========================================================
     TOTAL AMOUNT
  ========================================================== */

  const totalAmount =
    filteredRecords.reduce(
      (sum, record) =>
        sum +
        Number(
          record?.total_amount || 0
        ),
      0
    );

  /* ==========================================================
     CLEAR FILTERS
  ========================================================== */

  const clearFilters = () => {
    setSelectedLocation("");
    setStartDate(todayDate);
    setEndDate(todayDate);
    setSearch("");
  };

  /* ==========================================================
     DATE DISPLAY
  ========================================================== */

  const dateDisplay = useMemo(() => {
    if (
      !startDate &&
      !endDate
    ) {
      return "All dates";
    }

    if (
      startDate &&
      endDate
    ) {
      return `${startDate} to ${endDate}`;
    }

    if (startDate) {
      return `From ${startDate}`;
    }

    if (endDate) {
      return `Up to ${endDate}`;
    }

    return "All dates";
  }, [
    startDate,
    endDate,
  ]);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="store-issue-record-container">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="store-issue-record-header">

        {/* ====================================================
            TITLE
        ==================================================== */}

        <div className="store-issue-title-section">

          <div className="store-issue-title-icon">
            📦
          </div>

          <div>

            <h2>
              Store Issue Record
            </h2>

            <p>
              Store stock issued to locations
            </p>

          </div>

        </div>

        {/* ====================================================
            SUMMARY
        ==================================================== */}

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
              Total Amount
            </span>

            <strong>
              ₦
              {formatMoney(
                totalAmount
              )}
            </strong>

          </div>

        </div>

      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div
          className={`store-issue-message ${
            message.type === "success"
              ? "store-issue-success"
              : "store-issue-error"
          }`}
        >
          {String(
            message.text
          )}
        </div>
      )}

      {/* ======================================================
          FILTER PANEL
      ====================================================== */}

      <div className="store-issue-filter-panel">

        {/* ====================================================
            LOCATION
        ==================================================== */}

        <div className="store-issue-filter-group">

          <label>
            Location
          </label>

          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(
                e.target.value
              );
            }}
          >

            <option value="">
              All Locations
            </option>

            {locations.map(
              (location) => (
                <option
                  key={String(
                    location.id
                  )}
                  value={String(
                    location.id
                  )}
                >
                  {String(
                    location.name || ""
                  )}
                </option>
              )
            )}

          </select>

        </div>

        {/* ====================================================
            START DATE
        ==================================================== */}

        <div className="store-issue-filter-group">

          <label>
            Start Date
          </label>

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(
                e.target.value
              );
            }}
          />

        </div>

        {/* ====================================================
            END DATE
        ==================================================== */}

        <div className="store-issue-filter-group">

          <label>
            End Date
          </label>

          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              setEndDate(
                e.target.value
              );
            }}
          />

        </div>

        {/* ====================================================
            SEARCH
        ==================================================== */}

        <div className="store-issue-filter-group search-group">

          <label>
            Search
          </label>

          <input
            type="text"
            placeholder="Search item or location..."
            value={search}
            onChange={(e) => {
              setSearch(
                e.target.value
              );
            }}
          />

        </div>

        {/* ====================================================
            CLEAR
        ==================================================== */}

        <div className="store-issue-filter-group">

          <label>
            &nbsp;
          </label>

          <button
            type="button"
            className="store-issue-clear-btn"
            onClick={clearFilters}
          >
            Clear
          </button>

        </div>

      </div>

      {/* ======================================================
          DATE DISPLAY
      ====================================================== */}

      <div className="store-issue-date-display">

        <span>
          Date Range
        </span>

        <strong>
          {dateDisplay}
        </strong>

      </div>

      {/* ======================================================
          TABLE CARD
      ====================================================== */}

      <div className="store-issue-record-card">

        <div className="store-issue-table-wrapper">

          <table className="store-issue-record-table">

            <thead>

              <tr>

                <th>
                  #
                </th>

                <th>
                  Date
                </th>

                <th>
                  Location
                </th>

                <th>
                  Item
                </th>

                <th>
                  Unit
                </th>

                <th>
                  Quantity
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Total Amount
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td
                    colSpan="8"
                    className="store-issue-table-loading"
                  >
                    Loading store issue records...
                  </td>

                </tr>

              ) : filteredRecords.length === 0 ? (

                <tr>

                  <td
                    colSpan="8"
                    className="store-issue-table-empty"
                  >
                    No store issue records found.
                  </td>

                </tr>

              ) : (

                filteredRecords.map(
                  (record, index) => (

                    <tr
                      key={`${record.item_id}-${record.location_id}-${record.issue_date}-${index}`}
                    >

                      {/* ====================================
                          NUMBER
                      ==================================== */}

                      <td className="store-issue-number">

                        {index + 1}

                      </td>

                      {/* ====================================
                          DATE
                      ==================================== */}

                      <td className="store-issue-date-cell">

                        {formatDateTime(
                          record.issue_date
                        )}

                      </td>

                      {/* ====================================
                          LOCATION
                      ==================================== */}

                      <td className="store-issue-location-cell">

                        <strong>
                          {String(
                            record.location_name ||
                              "-"
                          )}
                        </strong>

                      </td>

                      {/* ====================================
                          ITEM
                      ==================================== */}

                      <td className="store-issue-item-cell">

                        <strong>
                          {String(
                            record.item_name ||
                              "-"
                          )}
                        </strong>

                        <small>
                          ID:{" "}
                          {String(
                            record.item_id ||
                              "-"
                          )}
                        </small>

                      </td>

                      {/* ====================================
                          UNIT
                      ==================================== */}

                      <td>
                        {String(
                          record.unit ||
                            "-"
                        )}
                      </td>

                      {/* ====================================
                          QUANTITY
                      ==================================== */}

                      <td className="store-issue-quantity-cell">

                        {formatNumber(
                          record.quantity
                        )}

                      </td>

                      {/* ====================================
                          UNIT PRICE
                      ==================================== */}

                      <td className="store-issue-total-cell">

                        {record.unit_price !==
                        null &&
                        record.unit_price !==
                        undefined ? (
                          <>
                            ₦
                            {formatMoney(
                              record.unit_price
                            )}
                          </>
                        ) : (
                          "-"
                        )}

                      </td>

                      {/* ====================================
                          TOTAL
                      ==================================== */}

                      <td className="store-issue-total-cell">

                        {record.total_amount !==
                        null &&
                        record.total_amount !==
                        undefined ? (
                          <>
                            ₦
                            {formatMoney(
                              record.total_amount
                            )}
                          </>
                        ) : (
                          "-"
                        )}

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