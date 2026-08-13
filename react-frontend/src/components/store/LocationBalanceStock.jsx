import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./LocationBalanceStock.css";

const LocationBalanceStock = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [balances, setBalances] = useState([]);
  const [locations, setLocations] = useState([]);

  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  /* ==========================================================
     MESSAGE HELPER
  ========================================================== */

  const showMessage = (msg) => {
    setMessage(msg);

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
        const res = await axios.get("/locations/simple");

        console.log("Locations response:", res.data);

        setLocations(
          Array.isArray(res.data)
            ? res.data
            : []
        );
      } catch (err) {
        console.error(
          "Failed to fetch locations:",
          err
        );

        showMessage(
          err.response?.data?.detail ||
            "❌ Failed to load locations"
        );
      }
    };

    fetchLocations();
  }, []);

  /* ==========================================================
     FETCH LOCATION STOCK BALANCE
  ========================================================== */

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStockBalances();
    }, 300);

    return () => clearTimeout(delay);
  }, [
    selectedLocation,
    selectedItemId,
    search,
  ]);

  const fetchStockBalances = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      /* ------------------------------------------------------
         LOCATION
      ------------------------------------------------------ */

      if (selectedLocation) {
        params.append(
          "location_id",
          selectedLocation
        );
      }

      /* ------------------------------------------------------
         ITEM
      ------------------------------------------------------ */

      if (selectedItemId) {
        params.append(
          "item_id",
          selectedItemId
        );
      }

      /* ------------------------------------------------------
         SEARCH
      ------------------------------------------------------ */

      if (search.trim()) {
        params.append(
          "search",
          search.trim()
        );
      }

      const queryString = params.toString();

      const url = queryString
        ? `/store/location-balance-stock?${queryString}`
        : "/store/location-balance-stock";

      console.log(
        "Fetching location stock:",
        url
      );

      const res = await axios.get(url);

      console.log(
        "Location stock response:",
        res.data
      );

      setBalances(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (err) {
      console.error(
        "Failed to fetch location stock balance:",
        err
      );

      console.error(
        "Response:",
        err.response?.data
      );

      setBalances([]);

      showMessage(
        err.response?.data?.detail ||
          "❌ Failed to load location stock balance"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     ITEM OPTIONS
     
     Get unique items from the current balance result.
  ========================================================== */

  const itemOptions = Array.from(
    new Map(
      balances.map((item) => [
        item.item_id,
        {
          id: item.item_id,
          name: item.item_name,
        },
      ])
    ).values()
  );

  /* ==========================================================
     TOTAL QUANTITY
  ========================================================== */

  const totalQuantity = balances.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0
  );

  /* ==========================================================
     TOTAL VALUE
  ========================================================== */

  const totalValue = balances.reduce(
    (sum, item) =>
      sum + Number(item.total_amount || 0),
    0
  );

  /* ==========================================================
     CLEAR FILTERS
  ========================================================== */

  const clearFilters = () => {
    setSelectedLocation("");
    setSelectedItemId("");
    setSearch("");
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="stock-balance-container1">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="stock-balance-header">

        <h2>
          📊 Location Stock Balance Report
        </h2>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <div className="filter-frame1">

          {/* --------------------------------------------------
              LOCATION
          -------------------------------------------------- */}

          <div className="filter-group1 bar-filter">

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

              {locations.map((location) => (
                <option
                  key={location.id}
                  value={location.id}
                >
                  {location.name}
                </option>
              ))}

            </select>

          </div>

          {/* --------------------------------------------------
              SEARCH
          -------------------------------------------------- */}

          <div className="filter-group1 search-filter">

            <label>
              Search
            </label>

            <input
              type="text"
              placeholder="Search item, category or location..."
              value={search}
              onChange={(e) => {
                setSearch(
                  e.target.value
                );

                setSelectedItemId("");
              }}
            />

          </div>

          {/* --------------------------------------------------
              ITEM
          -------------------------------------------------- */}

          <div className="filter-group1 item-filter">

            <label>
              Item
            </label>

            <select
              value={selectedItemId}
              onChange={(e) => {

                setSelectedItemId(
                  e.target.value
                );

                setSearch("");
              }}
            >

              <option value="">
                All Items
              </option>

              {itemOptions.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                </option>
              ))}

            </select>

          </div>

          {/* --------------------------------------------------
              CLEAR FILTERS
          -------------------------------------------------- */}

          <div className="filter-group1">

            <label>
              &nbsp;
            </label>

            <button
              type="button"
              className="clear-filter-btn"
              onClick={clearFilters}
            >
              Clear Filters
            </button>

          </div>

        </div>

        {/* ====================================================
            TOTALS
        ==================================================== */}

        <div className="total-stock1">

          <div>
            Total Stock Value:{" "}
            <strong>
              ₦
              {totalValue.toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </strong>
          </div>

          <div>
            Stock Balance:{" "}
            <strong>
              {totalQuantity.toLocaleString()}
            </strong>
          </div>

        </div>

      </div>

      {/* ======================================================
          MESSAGE
      ====================================================== */}

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading ? (

        <div className="loading-container">
          Loading location stock balance...
        </div>

      ) : (

        /* ====================================================
           TABLE
        ==================================================== */

        <div className="table-scroll-container">

          <table>

            <thead>

              <tr>

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
                  Category
                </th>

                <th>
                  Item Type
                </th>

                <th>
                  Quantity
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Total Value
                </th>

                <th>
                  Received At
                </th>

              </tr>

            </thead>

            <tbody>

              {balances.length === 0 ? (

                <tr>

                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "20px",
                    }}
                  >
                    No location stock balance found.
                  </td>

                </tr>

              ) : (

                balances.map(
                  (item, idx) => (

                    <tr
                      key={`${item.location_id}-${item.item_id}`}
                      className={
                        idx % 2 === 0
                          ? "even-row"
                          : "odd-row"
                      }
                    >

                      {/* Location */}

                      <td>
                        {item.location_name || "-"}
                      </td>

                      {/* Item */}

                      <td>
                        {item.item_name || "-"}
                      </td>

                      {/* Unit */}

                      <td>
                        {item.unit || "-"}
                      </td>

                      {/* Category */}

                      <td>
                        {item.category_name ||
                          "Uncategorized"}
                      </td>

                      {/* Item Type */}

                      <td>
                        {item.item_type || "-"}
                      </td>

                      {/* Quantity */}

                      <td>
                        {Number(
                          item.quantity || 0
                        ).toLocaleString()}
                      </td>

                      {/* Unit Price */}

                      <td>
                        ₦
                        {Number(
                          item.unit_price || 0
                        ).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      {/* Total Value */}

                      <td>
                        ₦
                        {Number(
                          item.total_amount || 0
                        ).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      {/* Received At */}

                      <td>
                        {item.received_at
                          ? new Date(
                              item.received_at
                            ).toLocaleString()
                          : "-"}
                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
};

export default LocationBalanceStock;