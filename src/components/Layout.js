"use client"

import { useEffect, useRef, useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"
import "./Layout.css"

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const previousIsMobile = useRef(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const updateViewport = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)

      if (previousIsMobile.current === null || mobile !== previousIsMobile.current) {
        setSidebarOpen(!mobile)
      }

      previousIsMobile.current = mobile
    }

    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  const content = children ?? <Outlet />

  return (
    <div className="layout" data-sidebar-open={sidebarOpen} data-mobile={isMobile}>
      <Sidebar isOpen={sidebarOpen} />
      {isMobile && sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className="layout-content" data-sidebar-open={sidebarOpen}>
        <Header onMenuClick={() => setSidebarOpen((prev) => (isMobile ? !prev : !prev))} />
        <main className="main-content">{content}</main>
      </div>
    </div>
  )
}
