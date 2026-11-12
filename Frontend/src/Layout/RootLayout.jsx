import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import Navbar from "../components/Navbar";

const RootLayout = () => {
  const { pathname } = useLocation();


  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="max-w-7xl mx-auto w-full flex-1 px-4 md:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
};

export default RootLayout;
