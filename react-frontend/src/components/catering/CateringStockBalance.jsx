import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CateringStockBalance.css";

const CateringStockBalance = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [balances, setBalances] = useState([]);

  const [locations, setLocations] = useState([]);

  const [categories, setCategories] = useState([]);

  const [selectedLocation, setSelectedLocation] = useState("");

  const [selectedItemId, setSelectedItemId] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const [selectedItemType, setSelectedItemType] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  /* ==========================================================
     ERROR MESSAGE HELPER
     
     IMPORTANT:
     Never render FastAPI validation objects directly.
  ========================================================== */

  const getApiErrorMessage = (err) => {
    const data = err?.response?.data;

    const detail = data?.detail;

    /* ----------------------------------------------------------
       FastAPI validation error array
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

            if (location) {
              return `${location}: ${msg}`;
            }

            return String(msg);
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

    return "❌ An unexpected error occurred.";
  };

  /* ==========================================================
     MESSAGE HELPER
  ========================================================== */

  const showMessage = (msg) => {
    const safeMessage =
      typeof msg === "string"
        ? msg
        : getApiErrorMessage({
            response: {
              data: {
                detail: msg,
              },
            },
          });

    setMessage(safeMessage);

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
        const res = await axios.get(
          "/locations/simple"
        );

        console.log(
          "Locations response:",
          res.data
        );

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
          getApiErrorMessage(err)
        );
      }
    };

    fetchLocations();
  }, []);

  /* ==========================================================
     FETCH CATEGORIES
     
     IMPORTANT:
     Categories now come from their own endpoint.
     
     They are NOT built from balances.
  ========================================================== */

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(
          "/store/categories/simple"
        );

        console.log(
          "Categories response:",
          res.data
        );

        const data =
          Array.isArray(res.data)
            ? res.data
            : [];

        const cleanCategories = data
          .filter(
            (category) =>
              category &&
              category.id !== null &&
              category.id !== undefined &&
              category.name
          )
          .map((category) => ({
            id: Number(category.id),
            name: String(category.name),
          }))
          .sort((a, b) =>
            a.name.localeCompare(b.name)
          );

        setCategories(
          cleanCategories
        );

      } catch (err) {
        console.error(
          "Failed to fetch categories:",
          err
        );

        console.error(
          "Category response:",
          err?.response?.data
        );

        setCategories([]);

        showMessage(
          getApiErrorMessage(err)
        );
      }
    };

    fetchCategories();
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
          String(selectedLocation)
        );
      }

      /* ------------------------------------------------------
         ITEM
      ------------------------------------------------------ */

      if (selectedItemId) {
        params.append(
          "item_id",
          String(selectedItemId)
        );
      }

      /* ------------------------------------------------------
         CATEGORY
         
         IMPORTANT:
         Send CATEGORY ID.
      ------------------------------------------------------ */

      if (selectedCategoryId) {
        params.append(
          "category_id",
          String(selectedCategoryId)
        );
      }

      /* ------------------------------------------------------
         ITEM TYPE
      ------------------------------------------------------ */

      if (selectedItemType) {
        params.append(
          "item_type",
          String(selectedItemType)
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

      const queryString =
        params.toString();

      const url = queryString
        ? `/catering/location-balance-stock?${queryString}`
        : "/catering/location-balance-stock";

      
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
        err?.response?.data
      );

      setBalances([]);

      showMessage(
        getApiErrorMessage(err)
      );

    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     ITEM OPTIONS
     
     Items come from the current result.
  ========================================================== */

  const itemOptions = Array.from(
    new Map(
      balances
        .filter(
          (item) =>
            item &&
            item.item_id !== null &&
            item.item_id !== undefined
        )
        .map((item) => [
          item.item_id,
          {
            id: item.item_id,
            name:
              item.item_name ||
              `Item ${item.item_id}`,
          },
        ])
    ).values()
  ).sort((a, b) =>
    String(a.name).localeCompare(
      String(b.name)
    )
  );

  /* ==========================================================
     ITEM TYPE OPTIONS
  ========================================================== */

  const itemTypeOptions = Array.from(
    new Set(
      balances
        .map(
          (item) =>
            item?.item_type
        )
        .filter(
          (type) =>
            type !== null &&
            type !== undefined &&
            String(type).trim() !== ""
        )
    )
  ).sort((a, b) =>
    String(a).localeCompare(
      String(b)
    )
  );

  /* ==========================================================
     TOTAL BALANCE
  ========================================================== */

  const totalBalance =
    balances.reduce(
      (sum, item) =>
        sum +
        Number(
          item?.balance || 0
        ),
      0
    );

  /* ==========================================================
     TOTAL VALUE
  ========================================================== */

  const totalValue =
    balances.reduce(
      (sum, item) =>
        sum +
        Number(
          item?.balance_total_amount ||
            0
        ),
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

          {/* ==================================================
              LOCATION
          ================================================== */}

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

          {/* ==================================================
              CATEGORY
          ================================================== */}

          <div className="filter-group1">

            <label>
              Category
            </label>

            <select
              value={selectedCategoryId}
              onChange={(e) => {

                const value =
                  e.target.value;

                console.log(
                  "CATEGORY SELECTED:",
                  value
                );

                setSelectedCategoryId(
                  value
                );

                setSelectedItemId("");
              }}
            >

              <option value="">
                All Categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={String(
                      category.id
                    )}
                    value={String(
                      category.id
                    )}
                  >
                    {String(
                      category.name
                    )}
                  </option>
                )
              )}

            </select>

          </div>

          {/* ==================================================
              ITEM TYPE
          ================================================== */}

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
                    key={String(type)}
                    value={String(type)}
                  >
                    {String(type)}
                  </option>
                )
              )}

            </select>

          </div>

          {/* ==================================================
              ITEM
          ================================================== */}

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

              {itemOptions.map(
                (item) => (
                  <option
                    key={String(item.id)}
                    value={String(item.id)}
                  >
                    {String(item.name)}
                  </option>
                )
              )}

            </select>

          </div>

          {/* ==================================================
              SEARCH
          ================================================== */}

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

          {/* ==================================================
              CLEAR
          ================================================== */}

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
          {String(message)}
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
                      textAlign:
                        "center",
                      padding:
                        "20px",
                    }}
                  >
                    No location stock
                    balance found.
                  </td>

                </tr>

              ) : (

                balances.map(
                  (item, idx) => (

                    <tr
                      key={`${item.location_id}-${item.item_id}-${idx}`}
                      className={
                        idx % 2 === 0
                          ? "even-row"
                          : "odd-row"
                      }
                    >

                      <td>
                        {String(
                          item.location_name ||
                            "-"
                        )}
                      </td>

                      <td>
                        {String(
                          item.item_name ||
                            "-"
                        )}
                      </td>

                      <td>
                        {String(
                          item.unit ||
                            "-"
                        )}
                      </td>

                      <td>
                        {String(
                          item.category_name ||
                            "Uncategorized"
                        )}
                      </td>

                      <td>
                        {String(
                          item.item_type ||
                            "-"
                        )}
                      </td>

                      <td>
                        {formatQuantity(
                          item.opening_stock
                        )}
                      </td>

                      <td>
                        {formatQuantity(
                          item.total_received
                        )}
                      </td>

                      <td>
                        {formatQuantity(
                          item.total_adjusted
                        )}
                      </td>

                      <td>
                        {formatQuantity(
                          item.total_used
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatQuantity(
                            item.balance
                          )}
                        </strong>
                      </td>

                      <td>
                        ₦
                        {formatMoney(
                          item.current_unit_price
                        )}
                      </td>

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

export default CateringStockBalance;