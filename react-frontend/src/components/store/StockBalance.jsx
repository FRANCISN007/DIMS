import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockBalance.css";

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItemType, setSelectedItemType] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ==========================================================
  // AXIOS
  // ==========================================================

  const axios = axiosWithAuth();

  // ==========================================================
  // FETCH CATEGORIES
  // ==========================================================

  useEffect(() => {
    fetchCategories();
  }, []);

  // ==========================================================
  // FETCH STOCK BALANCE
  // ==========================================================

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStockBalances();
    }, 300);

    return () => clearTimeout(delay);
  }, [
    selectedCategory,
    selectedItemType,
    selectedItemId,
    search,
  ]);

  // ==========================================================
  // AUTO-HIDE MESSAGE
  // ==========================================================

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  // ==========================================================
  // FETCH CATEGORIES
  // ==========================================================

  const fetchCategories = async () => {
    try {
      const res = await axios.get(
        "/store/categories"
      );

      setCategories(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (error) {
      console.error(
        "Failed to fetch categories:",
        error
      );

      setCategories([]);
    }
  };

  // ==========================================================
  // FETCH STOCK BALANCES
  // ==========================================================

  const fetchStockBalances = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        "/store/balance-stock",
        {
          params: {
            category_id:
              selectedCategory || undefined,

            item_type:
              selectedItemType || undefined,

            item_id:
              selectedItemId || undefined,

            search:
              search.trim() || undefined,
          },
        }
      );

      setBalances(
        Array.isArray(res.data)
          ? res.data
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load stock balance:",
        error
      );

      setBalances([]);

      setMessage(
        error.response?.data?.detail ||
          "❌ Failed to load stock balances."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedItemType("");
    setSelectedItemId("");
    setSearch("");
  };

  // ==========================================================
  // TOTAL BALANCE VALUE
  // ==========================================================

  const totalStockAmount = balances.reduce(
    (sum, item) =>
      sum +
      Number(
        item.balance_total_amount || 0
      ),
    0
  );

  // ==========================================================
  // TOTAL BALANCE QUANTITY
  // ==========================================================

  const totalBalanceQuantity = balances.reduce(
    (sum, item) =>
      sum +
      Number(item.balance || 0),
    0
  );

  // ==========================================================
  // FORMAT NUMBER
  // ==========================================================

  const formatNumber = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString(
      "en-NG",
      {
        maximumFractionDigits: 2,
      }
    );
  };

  // ==========================================================
  // FORMAT CURRENCY
  // ==========================================================

  const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `₦${number.toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="stock-balance-container3">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="stock-balance-header">

        <h2>
          📊 Store Stock Balance
        </h2>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <div className="filter-frame3">

          {/* CATEGORY */}

          <div className="filter-group3 category-filter">

            <label>
              Category
            </label>

            <select
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value
                )
              }
            >
              <option value="">
                All Categories
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>

          </div>

          {/* ITEM TYPE */}

          <div className="filter-group3 type-filter">

            <label>
              Type
            </label>

            

            <select
              value={selectedItemType}
              onChange={(e) =>
                setSelectedItemType(
                  e.target.value
                )
              }
            >
              <option value="">
                All Types
              </option>

              <option value="food stuff">
                Food Stuff
              </option>

              <option value="protein">
                Protein
              </option>

              <option value="ingredients">
                Ingredients
              </option>

              <option value="general">
                General
              </option>

            </select>

          </div>

          {/* SEARCH */}

          <div className="filter-group3 search-filter">

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

          {/* ITEM */}

          <div className="filter-group3 item-filter">

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

              {balances.map((item) => (
                <option
                  key={item.item_id}
                  value={item.item_id}
                >
                  {item.item_name}
                </option>
              ))}

            </select>

          </div>

          {/* CLEAR */}

          <div className="filter-group3 clear-filter">

            <label>
              &nbsp;
            </label>

            <button
              type="button"
              className="clear-filter-btn"
              onClick={clearFilters}
            >
              Clear
            </button>

          </div>

        </div>

        {/* ====================================================
            SUMMARY
        ==================================================== */}

        <div className="stock-summary3">

          <div className="summary-box3">

            <span>
              Items
            </span>

            <strong>
              {balances.length}
            </strong>

          </div>

          <div className="summary-box3">

            <span>
              Total Balance
            </span>

            <strong>
              {formatNumber(
                totalBalanceQuantity
              )}
            </strong>

          </div>

          <div className="summary-box3 total-stock3">

            <span>
              Total Stock Value
            </span>

            <strong>
              {formatCurrency(
                totalStockAmount
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
          <p>
            Loading stock balance...
          </p>
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
                  Item
                </th>

                <th>
                  Unit
                </th>

                <th>
                  Category
                </th>

                <th>
                  Type
                </th>

                <th>
                  Opening Stock
                </th>

                <th>
                  Received
                </th>

                <th>
                  Issued
                </th>

                <th>
                  Adjusted
                </th>

                <th>
                  Balance
                </th>

                <th>
                  Current Unit Price
                </th>

                <th>
                  Balance Value
                </th>

              </tr>

            </thead>

            <tbody>

              {balances.length === 0 ? (

                <tr>

                  <td
                    colSpan="11"
                    className="no-data"
                  >
                    No stock balance found.
                  </td>

                </tr>

              ) : (

                balances.map(
                  (item, index) => (

                    <tr
                      key={item.item_id}
                      className={
                        index % 2 === 0
                          ? "even-row"
                          : "odd-row"
                      }
                    >

                      {/* ITEM */}

                      <td>
                        {item.item_name}
                      </td>

                      {/* UNIT */}

                      <td>
                        {item.unit || "-"}
                      </td>

                      {/* CATEGORY */}

                      <td>
                        {item.category_name ||
                          "Uncategorized"}
                      </td>

                      {/* TYPE */}

                      <td>
                        {item.item_type || "-"}
                      </td>

                      {/* OPENING */}

                      <td>
                        {formatNumber(
                          item.opening_stock
                        )}
                      </td>

                      {/* RECEIVED */}

                      <td>
                        {formatNumber(
                          item.total_received
                        )}
                      </td>

                      {/* ISSUED */}

                      <td>
                        {formatNumber(
                          item.total_issued
                        )}
                      </td>

                      {/* ADJUSTED */}

                      <td>
                        {formatNumber(
                          item.total_adjusted
                        )}
                      </td>

                      {/* BALANCE */}

                      <td>
                        <strong>
                          {formatNumber(
                            item.balance
                          )}
                        </strong>
                      </td>

                      {/* CURRENT UNIT PRICE */}

                      <td>
                        {formatCurrency(
                          item.current_unit_price
                        )}
                      </td>

                      {/* BALANCE VALUE */}

                      <td>
                        <strong>
                          {formatCurrency(
                            item.balance_total_amount
                          )}
                        </strong>
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

export default StockBalance;