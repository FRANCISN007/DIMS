
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
import RoomsPage from "./pages/RoomsPage";
import BookingsPage from "./pages/BookingsPage";
import RoomStatusBoard from "./pages/RoomStatusBoard";

// ================= STORE =================
import StoreDashboardPage from "./components/store/StoreDashboardPage";
import ListVendor from "./components/store/ListVendor";
import ListCategory from "./components/store/ListCategory";
import ListItem from "./components/store/ListItem";
import CreatePurchase from "./components/store/CreatePurchase";
import ListPurchase from "./components/store/ListPurchase";
import IssueToLocation from "./components/store/IssueToLocation";
import ListIssuesToLocation from "./components/store/ListIssuesToLocation";
import CreateKitchen from "./components/store/CreateKitchen";
import StockAdjustment from "./components/store/StockAdjustment";
import ListAdjustment from "./components/store/ListAdjustment";
import StockBalance from "./components/store/StockBalance";

import LocationBalanceStock from "./components/store/LocationBalanceStock";

import KitchenBalanceStock from "./components/store/KitchenBalanceStock";
import KitchenStockAdjust from "./components/store/KitchenStockAdjust";
import KitchenAdjustmentList from "./components/store/KitchenAdjustmentList";
import IssuesToKitchen from "./components/store/IssuesToKitchen";
import KitchenIssueList from "./components/store/KitchenIssueList";

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

// ================= RESTAURANT =================
import RestDashboardPage from "./components/restaurant/RestDashboardPage";
import RestaurantLocation from "./components/restaurant/RestaurantLocation";
import MealCategory from "./components/restaurant/MealCategory";
import MealCreate from "./components/restaurant/MealCreate";
import GuestOrderCreate from "./components/restaurant/GuestOrderCreate";
import ListGuestOrder from "./components/restaurant/ListGuestOrder";
import OrderToSales from "./components/restaurant/OrderToSales";
import ListRestaurantSales from "./components/restaurant/ListRestaurantSales";
import RestaurantPayment from "./components/restaurant/RestaurantPayment";
import ListRestaurantPayment from "./components/restaurant/ListRestaurantPayment";
import KitchenStock from "./components/restaurant/KitchenStock";
import SalesSummary from "./components/restaurant/SalesSummary";

// ================= BOOKINGS =================
import CreateBooking from "./components/bookings/CreateBooking";
import ListBooking from "./components/bookings/ListBooking";
import CheckoutGuest from "./components/bookings/CheckoutGuest";
import CancelBooking from "./components/bookings/CancelBooking";
import SummaryReport from "./components/bookings/SummaryReport";
import ReservationAlert from "./components/bookings/ReservationAlert";

// ================= PAYMENTS =================
import CreateBank from "./components/payments/CreateBank";
import CreatePayment from "./components/payments/CreatePayment";
import PaymentOutstandingList from "./components/payments/PaymentOutstandingList";
import ListPayment from "./components/payments/ListPayment";
import VoidPayment from "./components/payments/VoidPayment";

// ================= EVENTS =================
import CreateEvent from "./components/events/CreateEvent";
import ListEvent from "./components/events/ListEvent";
import EventPayment from "./components/events/EventPayment";
import ListEventPayment from "./components/events/ListEventPayment";
import VoidEventPayment from "./components/events/VoidEventPayment";
import ViewEventForm from "./components/events/ViewEventForm";
import EventUpdate from "./components/events/EventUpdate";
import ViewEventPayment from "./components/events/ViewEventPayment";


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


          <Route
            path="kitchenstock"
            element={<KitchenBalanceStock />}
          />

          <Route
            path="kitchen/create"
            element={<CreateKitchen />}
          />

          <Route
            path="kitchenadjustment/create"
            element={<KitchenStockAdjust />}
          />

          <Route
            path="kitchenadjustment/list"
            element={<KitchenAdjustmentList />}
          />

          <Route
            path="kitchen/issue"
            element={<IssuesToKitchen />}
          />

          <Route
            path="kitchenissue/list"
            element={<KitchenIssueList />}
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
            RESTAURANT
        ===================================================== */}

        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestDashboardPage />
            </ProtectedRoute>
          }
        >
          <Route
            path="location"
            element={<RestaurantLocation />}
          />

          <Route
            path="meal-category"
            element={<MealCategory />}
          />

          <Route
            path="meal-create"
            element={<MealCreate />}
          />

          <Route
            path="guest-order-create"
            element={<GuestOrderCreate />}
          />

          <Route
            path="guest-orders"
            element={<ListGuestOrder />}
          />

          <Route
            path="order-to-sales"
            element={<OrderToSales />}
          />

          <Route
            path="sales"
            element={<ListRestaurantSales />}
          />

          <Route
            path="payment"
            element={<RestaurantPayment />}
          />

          <Route
            path="payments"
            element={<ListRestaurantPayment />}
          />

          <Route
            path="kitchen-stock"
            element={<KitchenStock />}
          />

          <Route
            path="sales-summary"
            element={<SalesSummary />}
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

          {/* ================= ROOMS ================= */}

          <Route
            path="rooms"
            element={<RoomsPage />}
          />

          <Route
            path="rooms/status"
            element={<RoomStatusBoard />}
          />


          {/* ===================================================
              BOOKINGS
          =================================================== */}

          <Route
            path="bookings"
            element={<BookingsPage />}
          >
            <Route
              index
              element={<ListBooking />}
            />

            <Route
              path="create"
              element={<CreateBooking />}
            />

            <Route
              path="list"
              element={<ListBooking />}
            />

            <Route
              path="checkout"
              element={<CheckoutGuest />}
            />

            <Route
              path="cancel"
              element={<CancelBooking />}
            />

            <Route
              path="summary"
              element={<SummaryReport />}
            />
          </Route>


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
              EVENTS
          =================================================== */}

          <Route path="events">

            <Route
              index
              element={<ListEvent />}
            />

            <Route
              path="create"
              element={<CreateEvent />}
            />

            <Route
              path="list"
              element={<ListEvent />}
            />

            <Route
              path="payment"
              element={<EventPayment />}
            />

            <Route
              path="payments/list"
              element={<ListEventPayment />}
            />

            <Route
              path="payments/void"
              element={<VoidEventPayment />}
            />

            <Route
              path="view"
              element={<ViewEventForm />}
            />

            <Route
              path="update"
              element={<EventUpdate />}
            />

            <Route
              path="payments/view/:id"
              element={<ViewEventPayment />}
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


          {/* ===================================================
              RESERVATION ALERT
          =================================================== */}

          <Route
            path="reservation-alert"
            element={<ReservationAlert />}
          />

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
