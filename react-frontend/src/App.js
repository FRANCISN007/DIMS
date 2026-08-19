
// src/App.js

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import ProtectedRoute from "./utils/ProtectedRoute";

// ================= PUBLIC =================
import HomePage from "./pages/HomePage";
import LoginPage from "./modules/auth/LoginPage";

// ================= DASHBOARD =================
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";




// ================= STORE =================
import StoreDashboardPage from "./components/store/StoreDashboardPage";
import ListVendor from "./components/store/ListVendor";
import ListCategory from "./components/store/ListCategory";
import ListItem from "./components/store/ListItem";
import CreatePurchase from "./components/store/CreatePurchase";
import ListPurchase from "./components/store/ListPurchase";
import IssueToLocation from "./components/store/IssueToLocation";
import ListIssuesToLocation from "./components/store/ListIssuesToLocation";

import StockAdjustment from "./components/store/StockAdjustment";
import ListAdjustment from "./components/store/ListAdjustment";
import StockBalance from "./components/store/StockBalance";

import LocationBalanceStock from "./components/store/LocationBalanceStock";



// ================= BAR =================
import BarDashboardPage from "./components/bar/BarDashboardPage";


import ListBar from "./components/bar/ListBar";
import BarStockBalance from "./components/bar/BarStockBalance";
import StoreToBarControl from "./components/bar/StoreToBarControl";
import BarStockAdjustment from "./components/bar/BarStockAdjustment";
import ListBarAdjustment from "./components/bar/ListBarAdjustment";
import BarSalesCreate from "./components/bar/BarSalesCreate";
import ListBarSales from "./components/bar/ListBarSales";
import BarPaymentCreate from "./components/bar/BarPaymentCreate";
import ListBarPayment from "./components/bar/ListBarPayment";
import BarSalesSummary from "./components/bar/BarSalesSummary";




// ================= PAYMENTS =================
import CreateBank from "./components/payments/CreateBank";
import CreatePayment from "./components/payments/CreatePayment";
import PaymentOutstandingList from "./components/payments/PaymentOutstandingList";
import ListPayment from "./components/payments/ListPayment";
import VoidPayment from "./components/payments/VoidPayment";




// ================= ROLES =================
import CreateRole from "./components/roles/CreateRole";
import ListRole from "./components/roles/ListRole";


// ================= LOCATIONS =================
import CreateLocation from "./components/locations/CreateLocation";
import ListLocation from "./components/locations/ListLocation";


// ================= CATERING =================
import CateringDashboard from "./components/catering/CateringDashboard";
import CreateUsage from "./components/catering/CreateUsage";
import ListUsage from "./components/catering/ListUsage";
import CateringStockBalance from "./components/catering/CateringStockBalance";

import CreateCateringAdjustment from "./components/catering/CreateCateringAdjustment";
import ListCateringAdjustment from "./components/catering/ListCateringAdjustment";

import StoreIssueRecord from "./components/catering/StoreIssueRecord";





const App = () => {
  return (
    <Router>
      <Routes>

        {/* =====================================================
            PUBLIC
        ===================================================== */}

        <Route
          path="/"
          element={<HomePage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />


        {/* =====================================================
            STORE
        ===================================================== */}

        <Route
          path="/store"
          element={
            <ProtectedRoute>
              <StoreDashboardPage />
            </ProtectedRoute>
          }
        >
          <Route
            path="vendor/list"
            element={<ListVendor />}
          />

          <Route
            path="category/list"
            element={<ListCategory />}
          />

          <Route
            path="items/list"
            element={<ListItem />}
          />

          <Route
            path="purchase/create"
            element={<CreatePurchase />}
          />

          <Route
            path="purchase/list"
            element={<ListPurchase />}
          />

          <Route
            path="issue/create"
            element={<IssueToLocation />}
          />

          <Route
            path="issue/list"
            element={<ListIssuesToLocation />}
          />

          <Route
            path="adjustment/create"
            element={<StockAdjustment />}
          />

          <Route
            path="adjustment/list"
            element={<ListAdjustment />}
          />

          <Route
            path="stock-balance"
            element={<StockBalance />}
          />

          <Route
            path="locationstock-balance"
            element={<LocationBalanceStock />}
          />


        
        
        </Route>


        {/* =====================================================
            BAR
        ===================================================== */}

        <Route
          path="/bar"
          element={
            <ProtectedRoute>
              <BarDashboardPage />
            </ProtectedRoute>
          }
        >
          <Route
            path="list"
            element={<ListBar />}
          />


          

          <Route
            path="stock-balance"
            element={<BarStockBalance />}
          />

          <Route
            path="store-issues"
            element={<StoreToBarControl />}
          />

          <Route
            path="adjustment/create"
            element={<BarStockAdjustment />}
          />

          <Route
            path="adjustment/list"
            element={<ListBarAdjustment />}
          />

          <Route
            path="sales/create"
            element={<BarSalesCreate />}
          />

          <Route
            path="sales/list"
            element={<ListBarSales />}
          />

          <Route
            path="sales-summary"
            element={<BarSalesSummary />}
          />

          <Route
            path="payment/create"
            element={<BarPaymentCreate />}
          />

          <Route
            path="payment/list"
            element={<ListBarPayment />}
          />
        </Route>



        {/* =====================================================
            CATERING
        ===================================================== */}

        <Route
          path="/catering"
          element={
            <ProtectedRoute>
              <CateringDashboard />
            </ProtectedRoute>
          }
        >


        <Route
          path="usage/create"
          element={<CreateUsage />}
        />


        <Route
          path="usage/list"
          element={<ListUsage />}
        />

        
        <Route
          path="cateringstock-balance"
          element={<CateringStockBalance />}
        />
        

        <Route
          path="adjustment/create"
          element={<CreateCateringAdjustment />}
        />

        
        <Route
          path="adjustment/list"
          element={<ListCateringAdjustment />}
        />

        <Route
              path="store-issues"
              element={<StoreIssueRecord />}
            />


        </Route>


        

        {/* =====================================================
            MAIN DASHBOARD
        ===================================================== */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        >

          {/* ================= USERS ================= */}

          <Route
            path="users"
            element={<UsersPage />}
          />

          

          
          {/* ===================================================
              PAYMENTS
          =================================================== */}

          <Route path="payments">

            <Route
              path="create"
              element={<PaymentOutstandingList />}
            />

            <Route
              path="create/:booking_id"
              element={<CreatePayment />}
            />

            <Route
              path="list"
              element={<ListPayment />}
            />

            <Route
              path="void"
              element={<VoidPayment />}
            />

            <Route
              path="bankcreate"
              element={<CreateBank />}
            />

          </Route>


          

          {/* ===================================================
              ROLES
          =================================================== */}

          <Route path="roles">

            <Route
              index
              path="list"
              element={<ListRole />}
            />

            <Route
              path="create"
              element={<CreateRole />}
            />

            

          </Route>


          {/* ===================================================
            LOCATIONS
          =================================================== */}

          <Route path="locations">

            <Route
              index
              path="list"
              element={<ListLocation />}
            />

            <Route
              path="create"
              element={<CreateLocation />}
            />

            
            
            

          </Route>


          

        </Route>


        {/* =====================================================
            FALLBACK
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </Router>
  );
};


export default App;
