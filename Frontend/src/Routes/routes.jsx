import { createBrowserRouter } from "react-router";
import RootLayout from "../Layout/RootLayout";
import HomePage from "../Pages/HomePage";
import Complaints from "../Pages/Complaints";
import ReportComplaint from "../Pages/ReportComplaint";
import TrackReport from "../Pages/TrackReport";
import EmergencyContacts from "../Pages/EmergencyContacts";
import Guidelines from "../Pages/Guidelines";
import Login from "../Pages/Login";
import AdminLayout from "../admin/AdminLayout";
import Dashboard from "../admin/pages/Dashboard";
import AllReports from "../admin/pages/AllReports";
import Categories from "../admin/pages/Categories";
import GuidelinesAdmin from "../admin/pages/Guidelines";
import EmergencyContactsAdmin from "../admin/pages/EmergencyContacts";
import Users from "../admin/pages/Users";
import Settings from "../admin/pages/Settings";
import PrivateRoute from "../context/PrivateRoute";
import AdminRoute from "../context/AdminRoute";

/**
 * The report workspace is open to every authenticated staff member, while
 * the dashboard and the configuration screens are restricted to admins.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "complaints", element: <Complaints /> },
      { path: "report", element: <ReportComplaint /> },
      { path: "track", element: <TrackReport /> },
      { path: "emergency", element: <EmergencyContacts /> },
      { path: "guidelines", element: <Guidelines /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <PrivateRoute>
        <AdminLayout />
      </PrivateRoute>
    ),
    children: [
      { index: true, element: <AdminRoute><Dashboard /></AdminRoute> },
      { path: "dashboard", element: <AdminRoute><Dashboard /></AdminRoute> },
      { path: "all-reports", element: <AllReports /> },
      { path: "reports", element: <AllReports /> },
      { path: "categories", element: <AdminRoute><Categories /></AdminRoute> },
      { path: "guidelines", element: <AdminRoute><GuidelinesAdmin /></AdminRoute> },
      {
        path: "emergency-contacts",
        element: <AdminRoute><EmergencyContactsAdmin /></AdminRoute>,
      },
      { path: "users", element: <AdminRoute><Users /></AdminRoute> },
      { path: "settings", element: <AdminRoute><Settings /></AdminRoute> },
    ],
  },
  {
    path: "/admin-login",
    element: <Login />,
  },
]);
