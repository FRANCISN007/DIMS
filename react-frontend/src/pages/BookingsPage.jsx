import React from "react";
import { Outlet } from "react-router-dom";
import "./BookingsPage.css";

const BookingsPage = () => {
  return (
    <div className="p-6 text-white relative">
      {/* This just serves as the main wrapper for subroutes */}
      <Outlet />
    </div>
  );
};



export default BookingsPage;
