import { useEffect, useRef } from "react"
import { useGoogleMaps } from "../hooks/useGoogleMaps"

export default function RouteMap({
  departure,
  destination,
  waypoints = [],
  className = "",
  options = {},
}) {
  const { isLoaded, error } = useGoogleMaps()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const directionsRendererRef = useRef(null)

  useEffect(() => {
    if (!isLoaded || !window.google?.maps || !mapRef.current) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 48.8566, lng: 2.3522 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        ...options,
      })
    }

    const map = mapInstanceRef.current

    if (!departure || !destination) {
      return
    }

    const service = new window.google.maps.DirectionsService()

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: false,
        draggable: false,
        polylineOptions: {
          strokeColor: "#7c3aed",
          strokeOpacity: 1.0,
          strokeWeight: 4,
        },
      })
      directionsRendererRef.current.setMap(map)
    }

    const request = {
      origin: departure,
      destination: destination,
      waypoints: (waypoints || [])
        .filter((wp) => typeof wp === "string" && wp.trim() !== "")
        .map((wp) => ({ location: wp, stopover: true })),
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      optimizeWaypoints: false,
      provideRouteAlternatives: false,
    }

    service.route(request, (response, status) => {
      if (status !== "OK" || !response) {
        return
      }

      directionsRendererRef.current.setDirections(response)

      const route = response.routes[0]
      const legStart = route.legs[0]
      const legEnd = route.legs[route.legs.length - 1]

      // Clear old custom markers if any by resetting map instance overlays
      // (DirectionsRenderer suppresses default markers; we add our own.)
      if (map.__customMarkers) {
        map.__customMarkers.forEach((m) => m.setMap(null))
      }
      map.__customMarkers = []

      const startMarker = new window.google.maps.Marker({
        position: legStart.start_location,
        map,
        title: departure,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#065f46",
          strokeWeight: 2,
        },
      })
      const endMarker = new window.google.maps.Marker({
        position: legEnd.end_location,
        map,
        title: destination,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#7f1d1d",
          strokeWeight: 2,
        },
      })

      const infoStart = new window.google.maps.InfoWindow({ content: `<div><strong>Départ</strong><br/>${escapeHtml(departure)}</div>` })
      const infoEnd = new window.google.maps.InfoWindow({ content: `<div><strong>Destination</strong><br/>${escapeHtml(destination)}</div>` })

      // Open labels by default and keep click to reopen
      infoStart.open({ map, anchor: startMarker })
      infoEnd.open({ map, anchor: endMarker })
      startMarker.addListener("click", () => infoStart.open({ map, anchor: startMarker }))
      endMarker.addListener("click", () => infoEnd.open({ map, anchor: endMarker }))

      map.__customMarkers.push(startMarker, endMarker)

      // Fit bounds to route
      const bounds = new window.google.maps.LatLngBounds()
      route.overview_path.forEach((p) => bounds.extend(p))
      map.fitBounds(bounds)
    })
  }, [isLoaded, departure, destination, JSON.stringify(waypoints), options])

  if (error) {
    return <div className={`live-map ${className}`}>Impossible de charger Google Maps.</div>
  }

  return <div ref={mapRef} className={`live-map ${className}`} />
}

// Basic HTML escaping for InfoWindow content
function escapeHtml(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
