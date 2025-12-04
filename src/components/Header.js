"use client"
import { useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "./Header.css"

export default function Header({ onMenuClick }) {
  const location = useLocation()
  const { admin, logout, loading } = useAuth()

  const getPageTitle = () => {
    const paths = {
      "/reservations": "Tableau de bord des réservations",
      "/reservations/new": "Nouvelle réservation",
      "/vehicles": "Gestion de la flotte",
    }
    return paths[location.pathname] || "Dashboard"
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-btn" onClick={onMenuClick}>
          ☰
        </button>
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>

      <div className="header-right">
        <div className="admin-pill" title={admin?.email || ""}>
          <span className="admin-avatar">{admin?.pseudo?.[0]?.toUpperCase() || "?"}</span>
          <span className="admin-name">{admin?.pseudo || "Admin"}</span>
        </div>
        <button className="logout-btn" onClick={logout} disabled={loading}>
          {loading ? "Déconnexion..." : "Se déconnecter"}
        </button>
      </div>
    </header>
  )
}
