import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout"
import RequireAuth from "./components/RequireAuth"
import VehicleManagement from "./pages/VehicleManagement"
import ManualReservation from "./pages/ManualReservation"
import ReservationsDashboard from "./pages/ReservationsDashboard"
import Login from "./pages/Login"
import RegisterAdmin from "./pages/RegisterAdmin"
import "./App.css"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/register-admin" element={<RegisterAdmin />} />
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/reservations" replace />} />
          <Route path="/reservations" element={<ReservationsDashboard />} />
          <Route path="/reservations/new" element={<ManualReservation />} />
          <Route path="/vehicles" element={<VehicleManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  )
}

export default App
