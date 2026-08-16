import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CateringStockBalance.css";

const LocationBalanceStock = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [balances, setBalances] = useState([]);
  const [locations, setLocations] = useState([]);

  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedItemType, setSelectedItemType] = useState("");

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
    selectedCategoryId,
    selectedItemType,
    search,
  ]);

  /* ==========================================================
     FETCH BALANCES
  ========================================================== */

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
         CATEGORY
      ------------------------------------------------------ */

      if (selectedCategoryId) {
        params.append(
          "category_id",
          selectedCategoryId
        );
      }

      /* ------------------------------------------------------
         ITEM TYPE
      ------------------------------------------------------ */

      if (selectedItemType) {
        params.append(
          "item_type",
          selectedItemType
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
     
     Build unique items from current balance result.
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
  ).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  /* ==========================================================
     CATEGORY OPTIONS
  ========================================================== */

  const categoryOptions = Array.from(
    new Map(
      balances
        .filter(
          (item) =>
            item.category_name &&
            item.category_name !== "Uncategorized"
        )
        .map((item) => [
          item.category_name,
          {
            name: item.category_name,
          },
        ])
    ).values()
  ).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  /* ==========================================================
     ITEM TYPE OPTIONS
  ========================================================== */

  const itemTypeOptions = Array.from(
    new Set(
      balances
        .map((item) => item.item_type)
        .filter(Boolean)
    )
  ).sort();

  /* ==========================================================
     TOTAL BALANCE
  ========================================================== */

  const totalBalance = balances.reduce(
    (sum, item) =>
      sum + Number(item.balance || 0),
    0
  );

  /* ==========================================================
     TOTAL VALUE
  ========================================================== */

  const totalValue = balances.reduce(
    (sum, item) =>
      sum +
      Number(
        item.balance_total_amount || 0
      ),
    0
  );

  /* ==========================================================
     TOTAL OPENING STOCK
  ========================================================== */

  const totalOpening = balances.reduce(
    (sum, item) =>
      sum +
      Number(item.opening_stock || 0),
    0
  );

  /* ==========================================================
     TOTAL RECEIVED
  ========================================================== */

  const totalReceived = balances.reduce(
    (sum, item) =>
      sum +
      Number(item.total_received || 0),
    0
  );

  /* ==========================================================
     TOTAL USED
  ========================================================== */

  const totalUsed = balances.reduce(
    (sum, item) =>
      sum +
      Number(item.total_used || 0),
    0
  );

  /* ==========================================================
     TOTAL ADJUSTED
  ========================================================== */

  const totalAdjusted = balances.reduce(
    (sum, item) =>
      sum +
      Number(item.total_adjusted || 0),
    0
  );

  /* ==========================================================
     CLEAR FILTERS
  ========================================================== */

  const clearFilters = () => {
    setSelectedLocation("");
    setSelectedItemId("");
    setSelectedCategoryId("");
    setSelectedItemType("");
    setSearch("");
  };

  /* ==========================================================
     FORMAT QUANTITY
  ========================================================== */

  const formatQuantity = (value) => {
    return Number(value || 0).toLocaleString(
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
    return Number(value || 0).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
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

          <div className="filter-group1">

            <label>
              Location
            </label>

            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(
                  e.target.value
                );

                setSelectedItemId("");
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
              CATEGORY
          -------------------------------------------------- */}

          <div className="filter-group1">

            <label>
              Category
            </label>

            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(
                  e.target.value
                );

                setSelectedItemId("");
              }}
            >

              <option value="">
                All Categories
              </option>

              {categoryOptions.map(
                (category) => (
                  <option
                    key={category.name}
                    value={
                      category.name
                    }
                  >
                    {category.name}
                  </option>
                )
              )}

            </select>

          </div>

          {/* --------------------------------------------------
              ITEM TYPE
          -------------------------------------------------- */}

          <div className="filter-group1">

            <label>
              Item Type
            </label>

            <select
              value={selectedItemType}
              onChange={(e) => {
                setSelectedItemType(
                  e.target.value
                );

                setSelectedItemId("");
              }}
            >

              <option value="">
                All Types
              </option>

              {itemTypeOptions.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}

            </select>

          </div>

          {/* --------------------------------------------------
              ITEM
          -------------------------------------------------- */}

          <div className="filter-group1">

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
              SEARCH
          -------------------------------------------------- */}

          <div className="filter-group1 search-filter">

            <label>
              Search
            </label>

            <input
              type="text"
              placeholder="Search item or category..."
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
              CLEAR
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
            Stock Balance:{" "}
            <strong>
              {formatQuantity(
                totalBalance
              )}
            </strong>
          </div>

          <div>
            Total Stock Value:{" "}
            <strong>
              ₦
              {formatMoney(
                totalValue
              )}
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
                  Opening
                </th>

                <th>
                  Received
                </th>

                <th>
                  Adjusted
                </th>

                <th>
                  Used
                </th>

                <th>
                  Balance
                </th>

                <th>
                  Unit Price
                </th>

                <th>
                  Total Value
                </th>

              </tr>

            </thead>

            <tbody>

              {balances.length === 0 ? (

                <tr>

                  <td
                    colSpan="12"
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

                      {/* ------------------------------------------------
                          LOCATION
                      ------------------------------------------------ */}

                      <td>
                        {item.location_name ||
                          "-"}
                      </td>

                      {/* ------------------------------------------------
                          ITEM
                      ------------------------------------------------ */}

                      <td>
                        {item.item_name ||
                          "-"}
                      </td>

                      {/* ------------------------------------------------
                          UNIT
                      ------------------------------------------------ */}

                      <td>
                        {item.unit ||
                          "-"}
                      </td>

                      {/* ------------------------------------------------
                          CATEGORY
                      ------------------------------------------------ */}

                      <td>
                        {item.category_name ||
                          "Uncategorized"}
                      </td>

                      {/* ------------------------------------------------
                          ITEM TYPE
                      ------------------------------------------------ */}

                      <td>
                        {item.item_type ||
                          "-"}
                      </td>

                      {/* ------------------------------------------------
                          OPENING
                      ------------------------------------------------ */}

                      <td>
                        {formatQuantity(
                          item.opening_stock
                        )}
                      </td>

                      {/* ------------------------------------------------
                          RECEIVED
                      ------------------------------------------------ */}

                      <td>
                        {formatQuantity(
                          item.total_received
                        )}
                      </td>

                      {/* ------------------------------------------------
                          ADJUSTED
                      ------------------------------------------------ */}

                      <td>
                        {formatQuantity(
                          item.total_adjusted
                        )}
                      </td>

                      {/* ------------------------------------------------
                          USED
                      ------------------------------------------------ */}

                      <td>
                        {formatQuantity(
                          item.total_used
                        )}
                      </td>

                      {/* ------------------------------------------------
                          BALANCE
                      ------------------------------------------------ */}

                      <td>
                        <strong>
                          {formatQuantity(
                            item.balance
                          )}
                        </strong>
                      </td>

                      {/* ------------------------------------------------
                          CURRENT UNIT PRICE
                      ------------------------------------------------ */}

                      <td>
                        ₦
                        {formatMoney(
                          item.current_unit_price
                        )}
                      </td>

                      {/* ------------------------------------------------
                          BALANCE TOTAL AMOUNT
                      ------------------------------------------------ */}

                      <td>
                        ₦
                        {formatMoney(
                          item.balance_total_amount
                        )}
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