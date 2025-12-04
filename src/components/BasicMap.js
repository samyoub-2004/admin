import { useEffect, useRef } from "react"
import { useGoogleMaps } from "../hooks/useGoogleMaps"

export default function BasicMap({ center = { lat: 48.8566, lng: 2.3522 }, zoom = 11, className = "" }) {
  const { isLoaded, error } = useGoogleMaps()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!isLoaded || !window.google?.maps || !mapRef.current) return

    // Initialize map once
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      new window.google.maps.Marker({ position: center, map: mapInstanceRef.current })
    } else {
      mapInstanceRef.current.setCenter(center)
      mapInstanceRef.current.setZoom(zoom)
    }
  }, [isLoaded, center, zoom])

  if (error) {
    return <div className={`live-map ${className}`}>Impossible de charger Google Maps.</div>
  }

  return <div ref={mapRef} className={`live-map ${className}`} />
}
