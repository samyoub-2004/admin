"use client"

import { useState } from "react"
import "./AppCard.css"

export default function AppCard({ app }) {
  const [isFavorite, setIsFavorite] = useState(app.isFavorite)

  return (
    <div className="app-card">
      <div className="app-card-header">
        <div className="app-icon">{app.icon}</div>
        <button className={`favorite-btn ${isFavorite ? "active" : ""}`} onClick={() => setIsFavorite(!isFavorite)}>
          ⭐
        </button>
      </div>
      <h3 className="app-name">{app.name}</h3>
      <p className="app-description">{app.description}</p>
      <button className="app-btn">Open</button>
    </div>
  )
}
