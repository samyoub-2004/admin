import { useEffect, useState } from "react"

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-sdk"
const ENV_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || process.env.REACT_APP_GOOGLE_MAPS_PLACES_KEY
const FALLBACK_KEY = "AIzaSyBLGs7aK3AGCGcRok_d-t5_1KJL1R3sf7o"
const API_KEY = ENV_KEY || FALLBACK_KEY
const GOOGLE_MAPS_URL = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,directions`

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (window.google?.maps) {
      setIsLoaded(true)
      return
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener("load", () => setIsLoaded(true))
      existingScript.addEventListener("error", () => setError("Échec du chargement de Google Maps"))
      return
    }

    const script = document.createElement("script")
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = GOOGLE_MAPS_URL
    script.async = true
    script.defer = true

    const handleLoad = () => {
      setIsLoaded(true)
      setError(null)
    }

    const handleError = () => {
      setIsLoaded(false)
      setError("Échec du chargement de Google Maps")
    }

    script.addEventListener("load", handleLoad)
    script.addEventListener("error", handleError)

    document.head.appendChild(script)

    return () => {
      script.removeEventListener("load", handleLoad)
      script.removeEventListener("error", handleError)
    }
  }, [])

  return { isLoaded, error }
}
