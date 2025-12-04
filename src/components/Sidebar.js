import { Link, useLocation } from "react-router-dom"
import "./Sidebar.css"

export default function Sidebar({ isOpen }) {
  const location = useLocation()

  const menuItems = [
    { label: "Tableau réservations", path: "/reservations", icon: "📊" },
    { label: "Fleet", path: "/vehicles", icon: "🚘" },
    { label: "Nouvelle réservation", path: "/reservations/new", icon: "🗓️" },
  ]

  return (
    <aside className={`sidebar ${isOpen ? "open" : "closed"}`} data-collapsed={!isOpen}>
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">✨</div>
          <div className="logo-text">
            <h2>LilyAdmin</h2>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}
