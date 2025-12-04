import { useEffect, useMemo, useRef, useState } from "react"
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore"
import { db } from "../firebase"
import { useGoogleMaps } from "../hooks/useGoogleMaps"
import "./Pages.css"
import "./ManualReservation.css"

const STEPS = [
  { title: "Trajet", description: "Définissez le type de trajet et l'itinéraire" },
  { title: "Planification", description: "Choisissez la date et l'heure" },
  { title: "Passagers", description: "Renseignez le nombre de passagers" },
  { title: "Véhicule", description: "Sélectionnez un véhicule" },
  { title: "Client", description: "Ajoutez les informations du client" },
  { title: "Résumé", description: "Vérifiez et confirmez" },
]

const BASE_OPTIONS = [
  { id: "airportVIP", name: "Service VIP aéroport", price: 30 },
  { id: "babySeat", name: "Siège bébé (0-12 mois)", price: 10 },
  { id: "childSeat", name: "Siège enfant (1-4 ans)", price: 10 },
  { id: "boosterSeat", name: "Siège d'appoint (4-8 ans)", price: 10 },
  { id: "pets", name: "Transport d'animaux", price: 20 },
  { id: "earlyArrival", name: "Arrivée anticipée (15 min)", price: 0 },
]

const createDefaultOptions = () => BASE_OPTIONS.map((option) => ({ ...option, selected: false }))

const INITIAL_FORM = {
  tripType: "simple",
  departure: "",
  destination: "",
  date: "",
  time: "",
  duration: "1",
  passengers: "1",
  luggage: "0",
  notes: "",
}

const INITIAL_PERSONAL_INFO = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  flightNumber: "",
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ManualReservation() {
  const { isLoaded: isMapsLoaded } = useGoogleMaps()
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [waypoints, setWaypoints] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [vehiclePricing, setVehiclePricing] = useState({})
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [options, setOptions] = useState(() => createDefaultOptions())
  const [personalInfo, setPersonalInfo] = useState(INITIAL_PERSONAL_INFO)
  const [distanceKm, setDistanceKm] = useState(null)
  const [distanceError, setDistanceError] = useState("")
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [statusType, setStatusType] = useState("")
  const [validationMessage, setValidationMessage] = useState("")

  const [departureSuggestions, setDepartureSuggestions] = useState([])
  const [destinationSuggestions, setDestinationSuggestions] = useState([])
  const [waypointSuggestions, setWaypointSuggestions] = useState([])
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  const [showWaypointSuggestions, setShowWaypointSuggestions] = useState([])

  const departureRef = useRef(null)
  const destinationRef = useRef(null)
  const waypointRefs = useRef([])

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId],
  )

  const selectedOptions = useMemo(() => options.filter((option) => option.selected), [options])

  const baseTripTotal = useMemo(() => {
    if (!selectedVehicle) {
      return 0
    }
    const pricing = vehiclePricing[selectedVehicle.id]
    if (!pricing) {
      return Number(selectedVehicle.basePrice || 0)
    }
    return pricing.total
  }, [selectedVehicle, vehiclePricing])

  const optionsTotal = useMemo(() => selectedOptions.reduce((sum, option) => sum + option.price, 0), [selectedOptions])

  const grandTotal = useMemo(() => Number((baseTripTotal + optionsTotal).toFixed(2)), [baseTripTotal, optionsTotal])

  useEffect(() => {
    const syncWaypointHelpers = () => {
      setWaypointSuggestions((prev) => (prev.length === waypoints.length ? prev : Array(waypoints.length).fill([])))
      setShowWaypointSuggestions((prev) => (prev.length === waypoints.length ? prev : Array(waypoints.length).fill(false)))
      waypointRefs.current = waypointRefs.current.slice(0, waypoints.length)
    }
    syncWaypointHelpers()
  }, [waypoints.length])

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoadingVehicles(true)
      try {
        const snapshot = await getDocs(collection(db, "vehicles"))
        const fetched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((vehicle) => vehicle.available !== false)
        setVehicles(fetched)
      } catch (error) {
        setStatusMessage(error.message)
        setStatusType("error")
      } finally {
        setLoadingVehicles(false)
      }
    }
    fetchVehicles()
  }, [])

  useEffect(() => {
    if (formData.tripType !== "simple") {
      setDistanceKm(null)
      setDistanceError("")
      return
    }
    if (!isMapsLoaded || !window.google?.maps) {
      return
    }
    if (!formData.departure || !formData.destination) {
      setDistanceKm(null)
      return
    }
    const timer = setTimeout(() => {
      const service = new window.google.maps.DirectionsService()
      const waypointsForApi = waypoints
        .filter((wp) => wp.trim() !== "")
        .map((wp) => ({ location: wp, stopover: true }))
      service.route(
        {
          origin: formData.departure,
          destination: formData.destination,
          waypoints: waypointsForApi.length > 0 ? waypointsForApi : undefined,
          travelMode: window.google.maps.TravelMode.DRIVING,
          unitSystem: window.google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          if (status === "OK" && response) {
            const meters = response.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0)
            setDistanceKm(Math.ceil(meters / 1000))
            setDistanceError("")
          } else {
            setDistanceKm(null)
            setDistanceError("Impossible de calculer la distance. Vérifiez l'itinéraire.")
          }
        },
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.tripType, formData.departure, formData.destination, waypoints, isMapsLoaded])

  useEffect(() => {
    if (vehicles.length === 0) {
      return
    }
    if (formData.tripType === "simple") {
      const distanceValue = distanceKm ?? 0
      const calculations = {}
      vehicles.forEach((vehicle) => {
        const base = Number(vehicle.basePrice || 0)
        const perKm = vehicle.pricePerKm !== null && vehicle.pricePerKm !== undefined ? Number(vehicle.pricePerKm) : 0
        const min = vehicle.minimumPrice ? Number(vehicle.minimumPrice) : base
        const variable = distanceValue > 0 ? distanceValue * perKm : 0
        const total = Math.max(base + variable, min)
        calculations[vehicle.id] = {
          base: Number(base.toFixed(2)),
          variable: Number(variable.toFixed(2)),
          total: Number(total.toFixed(2)),
          label: "Distance",
        }
      })
      setVehiclePricing(calculations)
    } else {
      const durationHours = Number(formData.duration || 0)
      const calculations = {}
      vehicles.forEach((vehicle) => {
        const base = Number(vehicle.basePrice || 0)
        const perHour = vehicle.pricePerHour !== null && vehicle.pricePerHour !== undefined ? Number(vehicle.pricePerHour) : 0
        const variable = durationHours > 0 ? durationHours * perHour : 0
        const total = base + variable
        calculations[vehicle.id] = {
          base: Number(base.toFixed(2)),
          variable: Number(variable.toFixed(2)),
          total: Number(total.toFixed(2)),
          label: "Durée",
        }
      })
      setVehiclePricing(calculations)
    }
  }, [vehicles, formData.tripType, distanceKm, formData.duration])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departureRef.current && !departureRef.current.contains(event.target)) {
        setShowDepartureSuggestions(false)
      }
      if (destinationRef.current && !destinationRef.current.contains(event.target)) {
        setShowDestinationSuggestions(false)
      }
      waypointRefs.current.forEach((ref, index) => {
        if (ref && !ref.contains(event.target)) {
          setShowWaypointSuggestions((prev) => {
            if (!prev[index]) {
              return prev
            }
            const next = [...prev]
            next[index] = false
            return next
          })
        }
      })
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const fetchSuggestions = (input, callback) => {
    if (!isMapsLoaded || !window.google?.maps || !input) {
      callback([])
      return
    }
    const service = new window.google.maps.places.AutocompleteService()
    service.getPlacePredictions(
      {
        input,
        types: ["geocode", "establishment"],
        componentRestrictions: { country: "fr" },
      },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          callback(
            predictions.map((prediction) => ({
              description: prediction.description,
              place_id: prediction.place_id,
            })),
          )
        } else {
          callback([])
        }
      },
    )
  }

  const handleDepartureChange = (event) => {
    const value = event.target.value
    updateForm("departure", value)
    if (value.length > 2) {
      fetchSuggestions(value, (suggestions) => {
        setDepartureSuggestions(suggestions)
        setShowDepartureSuggestions(suggestions.length > 0)
      })
    } else {
      setDepartureSuggestions([])
      setShowDepartureSuggestions(false)
    }
  }

  const handleDestinationChange = (event) => {
    const value = event.target.value
    updateForm("destination", value)
    if (value.length > 2) {
      fetchSuggestions(value, (suggestions) => {
        setDestinationSuggestions(suggestions)
        setShowDestinationSuggestions(suggestions.length > 0)
      })
    } else {
      setDestinationSuggestions([])
      setShowDestinationSuggestions(false)
    }
  }

  const handleWaypointChange = (index, value) => {
    setWaypoints((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    if (value.length > 2) {
      fetchSuggestions(value, (suggestions) => {
        setWaypointSuggestions((prev) => {
          const next = [...prev]
          next[index] = suggestions
          return next
        })
        setShowWaypointSuggestions((prev) => {
          const next = [...prev]
          next[index] = suggestions.length > 0
          return next
        })
      })
    } else {
      setWaypointSuggestions((prev) => {
        const next = [...prev]
        next[index] = []
        return next
      })
      setShowWaypointSuggestions((prev) => {
        const next = [...prev]
        next[index] = false
        return next
      })
    }
  }

  const selectDepartureSuggestion = (suggestion) => {
    updateForm("departure", suggestion.description)
    setDepartureSuggestions([])
    setShowDepartureSuggestions(false)
  }

  const selectDestinationSuggestion = (suggestion) => {
    updateForm("destination", suggestion.description)
    setDestinationSuggestions([])
    setShowDestinationSuggestions(false)
  }

  const selectWaypointSuggestion = (index, suggestion) => {
    setWaypoints((prev) => {
      const next = [...prev]
      next[index] = suggestion.description
      return next
    })
    setWaypointSuggestions((prev) => {
      const next = [...prev]
      next[index] = []
      return next
    })
    setShowWaypointSuggestions((prev) => {
      const next = [...prev]
      next[index] = false
      return next
    })
  }

  const addWaypoint = () => {
    setWaypoints((prev) => [...prev, ""])
  }

  const removeWaypoint = (index) => {
    setWaypoints((prev) => prev.filter((_, idx) => idx !== index))
    setWaypointSuggestions((prev) => prev.filter((_, idx) => idx !== index))
    setShowWaypointSuggestions((prev) => prev.filter((_, idx) => idx !== index))
  }

  const toggleOption = (optionId) => {
    setOptions((prev) => prev.map((option) => (option.id === optionId ? { ...option, selected: !option.selected } : option)))
  }

  const updatePersonalInfo = (field, value) => {
    setPersonalInfo((prev) => ({ ...prev, [field]: value }))
  }

  const validateStep = (stepIndex) => {
    switch (stepIndex) {
      case 0:
        if (!formData.departure.trim()) {
          return "Le point de départ est requis."
        }
        if (formData.tripType === "simple" && !formData.destination.trim()) {
          return "La destination est requise pour un trajet simple."
        }
        return ""
      case 1:
        if (!formData.date) {
          return "La date est obligatoire."
        }
        if (!formData.time) {
          return "L'heure est obligatoire."
        }
        if (formData.tripType === "hourly" && (!formData.duration || Number(formData.duration) <= 0)) {
          return "Indiquez une durée valide."
        }
        return ""
      case 2:
        if (!formData.passengers || Number(formData.passengers) <= 0) {
          return "Le nombre de passagers doit être supérieur à 0."
        }
        return ""
      case 3:
        if (!selectedVehicleId) {
          return "Sélectionnez un véhicule."
        }
        return ""
      case 4:
        if (!personalInfo.firstName.trim()) {
          return "Le prénom est requis."
        }
        if (!personalInfo.lastName.trim()) {
          return "Le nom est requis."
        }
        if (!personalInfo.phone.trim()) {
          return "Le téléphone est requis."
        }
        if (!personalInfo.email.trim() || !EMAIL_REGEX.test(personalInfo.email)) {
          return "Adresse email invalide."
        }
        return ""
      default:
        return ""
    }
  }

  const handleNextStep = () => {
    const error = validateStep(currentStep)
    if (error) {
      setValidationMessage(error)
      return
    }
    setValidationMessage("")
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handlePreviousStep = () => {
    setValidationMessage("")
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const resetWizard = () => {
    setFormData(INITIAL_FORM)
    setWaypoints([])
    setSelectedVehicleId(null)
    setOptions(createDefaultOptions())
    setPersonalInfo(INITIAL_PERSONAL_INFO)
    setDistanceKm(null)
    setDistanceError("")
    setCurrentStep(0)
  }

  const handleConfirmReservation = async () => {
    const stepError = validateStep(4)
    if (stepError) {
      setValidationMessage(stepError)
      setCurrentStep(4)
      return
    }
    if (!selectedVehicle) {
      setValidationMessage("Sélectionnez un véhicule valide avant de confirmer.")
      setCurrentStep(3)
      return
    }
    setSaving(true)
    setStatusMessage("")
    setStatusType("")
    try {
      const chosenOptions = options.filter((option) => option.selected)
      const docPayload = {
        type: formData.tripType,
        departure: formData.departure,
        destination: formData.tripType === "simple" ? formData.destination : "",
        waypoints: waypoints.filter((wp) => wp.trim() !== ""),
        date: formData.date,
        time: formData.time,
        duration: formData.tripType === "hourly" ? formData.duration : null,
        distance: formData.tripType === "simple" ? distanceKm : null,
        distanceValue: formData.tripType === "simple" ? distanceKm || 0 : 0,
        selectedVehicle: selectedVehicle.id,
        selectedVehicleName: selectedVehicle.name || "",
        selectedOptions: chosenOptions.map((option) => option.id),
        optionsDetails: chosenOptions,
        personalInfo: {
          firstName: personalInfo.firstName.trim(),
          lastName: personalInfo.lastName.trim(),
          phone: personalInfo.phone.trim(),
          email: personalInfo.email.trim(),
          flightNumber: personalInfo.flightNumber.trim(),
        },
        passengers: Number(formData.passengers || 0),
        luggage: Number(formData.luggage || 0),
        notes: formData.notes.trim(),
        vehiclePricing: vehiclePricing[selectedVehicle.id] || null,
        totalPrice: grandTotal,
        paymentMethod: "manual",
        paymentStatus: "pending",
        status: "confirmed",
        source: "admin",
        createdBy: "admin",
        createdAt: serverTimestamp(),
      }
      await addDoc(collection(db, "reservations"), docPayload)
      setStatusMessage("Réservation manuelle enregistrée avec succès.")
      setStatusType("success")
      resetWizard()
    } catch (error) {
      setStatusMessage(error.message)
      setStatusType("error")
    } finally {
      setSaving(false)
    }
  }

  const renderTripStep = () => (
    <div className="wizard-form-grid">
      <div className="wizard-form-group">
        <label>Type de trajet</label>
        <div className="wizard-segmented-control">
          <button
            type="button"
            className={formData.tripType === "simple" ? "active" : ""}
            onClick={() => updateForm("tripType", "simple")}
          >
            Trajet simple
          </button>
          <button
            type="button"
            className={formData.tripType === "hourly" ? "active" : ""}
            onClick={() => updateForm("tripType", "hourly")}
          >
            Mise à disposition
          </button>
        </div>
      </div>

      <div className="wizard-form-group autocomplete-wrapper" ref={departureRef}>
        <label>Point de départ *</label>
        <input type="text" value={formData.departure} onChange={handleDepartureChange} placeholder="Adresse, aéroport..." />
        {showDepartureSuggestions && (
          <div className="autocomplete-list">
            {departureSuggestions.map((suggestion) => (
              <div
                key={suggestion.place_id}
                className="autocomplete-item"
                onMouseDown={() => selectDepartureSuggestion(suggestion)}
              >
                {suggestion.description}
              </div>
            ))}
          </div>
        )}
      </div>

      {formData.tripType === "simple" && (
        <div className="wizard-form-group autocomplete-wrapper" ref={destinationRef}>
          <label>Destination *</label>
          <input
            type="text"
            value={formData.destination}
            onChange={handleDestinationChange}
            placeholder="Adresse ou lieu"
          />
          {showDestinationSuggestions && (
            <div className="autocomplete-list">
              {destinationSuggestions.map((suggestion) => (
                <div
                  key={suggestion.place_id}
                  className="autocomplete-item"
                  onMouseDown={() => selectDestinationSuggestion(suggestion)}
                >
                  {suggestion.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {formData.tripType === "simple" && (
        <div className="wizard-form-group">
          <label>Points d'arrêt (optionnel)</label>
          <div className="waypoint-list">
            {waypoints.map((waypoint, index) => (
              <div
                key={index}
                className="waypoint-row"
                ref={(node) => {
                  waypointRefs.current[index] = node
                }}
              >
                <div className="autocomplete-wrapper" style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={waypoint}
                    onChange={(event) => handleWaypointChange(index, event.target.value)}
                    placeholder="Ajouter une étape"
                  />
                  {showWaypointSuggestions[index] && (
                    <div className="autocomplete-list">
                      {waypointSuggestions[index]?.map((suggestion) => (
                        <div
                          key={suggestion.place_id}
                          className="autocomplete-item"
                          onMouseDown={() => selectWaypointSuggestion(index, suggestion)}
                        >
                          {suggestion.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="remove-button" onClick={() => removeWaypoint(index)}>
                  Retirer
                </button>
              </div>
            ))}
            <button type="button" className="add-waypoint-button" onClick={addWaypoint}>
              + Ajouter un arrêt
            </button>
          </div>
        </div>
      )}

      {formData.tripType === "simple" && distanceKm !== null && (
        <div className="summary-card">
          <div className="summary-row">
            <span>Distance estimée</span>
            <strong>{distanceKm} km</strong>
          </div>
        </div>
      )}

      {distanceError && <p className="validation-message">{distanceError}</p>}
    </div>
  )

  const renderScheduleStep = () => (
    <div className="wizard-form-grid two-columns">
      <div className="wizard-form-group">
        <label>Date *</label>
        <input type="date" value={formData.date} onChange={(event) => updateForm("date", event.target.value)} />
      </div>
      <div className="wizard-form-group">
        <label>Heure *</label>
        <input type="time" value={formData.time} onChange={(event) => updateForm("time", event.target.value)} />
      </div>
      {formData.tripType === "hourly" && (
        <div className="wizard-form-group">
          <label>Durée (heures) *</label>
          <input
            type="number"
            min="1"
            value={formData.duration}
            onChange={(event) => updateForm("duration", event.target.value)}
          />
        </div>
      )}
      <div className="wizard-form-group" style={{ gridColumn: "1 / -1" }}>
        <label>Notes internes (optionnel)</label>
        <textarea
          value={formData.notes}
          onChange={(event) => updateForm("notes", event.target.value)}
          placeholder="Informations pratiques pour l'équipe ou le chauffeur"
        />
      </div>
    </div>
  )

  const renderPassengerStep = () => (
    <div className="wizard-form-grid two-columns">
      <div className="wizard-form-group">
        <label>Passagers *</label>
        <input
          type="number"
          min="1"
          value={formData.passengers}
          onChange={(event) => updateForm("passengers", event.target.value)}
        />
      </div>
      <div className="wizard-form-group">
        <label>Bagages</label>
        <input
          type="number"
          min="0"
          value={formData.luggage}
          onChange={(event) => updateForm("luggage", event.target.value)}
        />
      </div>
    </div>
  )

  const renderVehicleStep = () => {
    if (loadingVehicles) {
      return <div>Chargement des véhicules...</div>
    }
    if (vehicles.length === 0) {
      return <div>Aucun véhicule disponible.</div>
    }
    return (
      <div className="vehicle-grid">
        {vehicles.map((vehicle) => {
          const pricing = vehiclePricing[vehicle.id]
          return (
            <div
              key={vehicle.id}
              className={`vehicle-card-option ${selectedVehicleId === vehicle.id ? "selected" : ""}`}
              onClick={() => setSelectedVehicleId(vehicle.id)}
            >
              <div className="vehicle-card-header">
                <div>
                  <div className="wizard-step-title">{vehicle.name}</div>
                  <div className="vehicle-card-meta">
                    <span>{vehicle.passengers} passagers</span>
                    <span>{vehicle.luggage || 0} bagages</span>
                  </div>
                </div>
                <div className="vehicle-card-price">
                  <strong>{pricing ? `${pricing.total.toFixed(2)} €` : `${Number(vehicle.basePrice || 0).toFixed(2)} €`}</strong>
                  {pricing && <span>{pricing.label}: {pricing.variable.toFixed(2)} €</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderClientStep = () => (
    <div className="wizard-form-grid two-columns">
      <div className="wizard-form-group">
        <label>Prénom *</label>
        <input
          type="text"
          value={personalInfo.firstName}
          onChange={(event) => updatePersonalInfo("firstName", event.target.value)}
        />
      </div>
      <div className="wizard-form-group">
        <label>Nom *</label>
        <input
          type="text"
          value={personalInfo.lastName}
          onChange={(event) => updatePersonalInfo("lastName", event.target.value)}
        />
      </div>
      <div className="wizard-form-group">
        <label>Téléphone *</label>
        <input
          type="tel"
          value={personalInfo.phone}
          onChange={(event) => updatePersonalInfo("phone", event.target.value)}
        />
      </div>
      <div className="wizard-form-group">
        <label>Email *</label>
        <input
          type="email"
          value={personalInfo.email}
          onChange={(event) => updatePersonalInfo("email", event.target.value)}
        />
      </div>
      <div className="wizard-form-group" style={{ gridColumn: "1 / -1" }}>
        <label>Numéro de vol (optionnel)</label>
        <input
          type="text"
          value={personalInfo.flightNumber}
          onChange={(event) => updatePersonalInfo("flightNumber", event.target.value)}
        />
      </div>
    </div>
  )

  const renderSummaryStep = () => (
    <div className="wizard-form-grid">
      <div className="summary-card">
        <div className="wizard-step-title">Trajet</div>
        <div className="summary-row">
          <span>Type</span>
          <strong>{formData.tripType === "simple" ? "Trajet simple" : "Mise à disposition"}</strong>
        </div>
        <div className="summary-row">
          <span>Départ</span>
          <strong>{formData.departure}</strong>
        </div>
        {formData.tripType === "simple" && (
          <div className="summary-row">
            <span>Destination</span>
            <strong>{formData.destination}</strong>
          </div>
        )}
        {waypoints.length > 0 && (
          <div className="summary-row" style={{ alignItems: "flex-start" }}>
            <span>Stops</span>
            <strong>{waypoints.filter((wp) => wp.trim() !== "").join(" • ") || "-"}</strong>
          </div>
        )}
        {distanceKm !== null && (
          <div className="summary-row">
            <span>Distance estimée</span>
            <strong>{distanceKm} km</strong>
          </div>
        )}
      </div>

      <div className="summary-card">
        <div className="wizard-step-title">Planification</div>
        <div className="summary-row">
          <span>Date</span>
          <strong>{formData.date}</strong>
        </div>
        <div className="summary-row">
          <span>Heure</span>
          <strong>{formData.time}</strong>
        </div>
        {formData.tripType === "hourly" && (
          <div className="summary-row">
            <span>Durée</span>
            <strong>{formData.duration} h</strong>
          </div>
        )}
        {formData.notes && (
          <div className="summary-row" style={{ alignItems: "flex-start" }}>
            <span>Notes</span>
            <strong>{formData.notes}</strong>
          </div>
        )}
      </div>

      <div className="summary-card">
        <div className="wizard-step-title">Passagers</div>
        <div className="summary-row">
          <span>Nombre</span>
          <strong>{formData.passengers}</strong>
        </div>
        <div className="summary-row">
          <span>Bagages</span>
          <strong>{formData.luggage}</strong>
        </div>
      </div>

      {selectedVehicle && (
        <div className="summary-card">
          <div className="wizard-step-title">Véhicule</div>
          <div className="summary-row">
            <span>Modèle</span>
            <strong>{selectedVehicle.name}</strong>
          </div>
          <div className="summary-row">
            <span>Tarif de base</span>
            <strong>{vehiclePricing[selectedVehicle.id]?.base.toFixed(2) ?? Number(selectedVehicle.basePrice || 0).toFixed(2)} €</strong>
          </div>
          {vehiclePricing[selectedVehicle.id] && (
            <div className="summary-row">
              <span>{vehiclePricing[selectedVehicle.id].label}</span>
              <strong>{vehiclePricing[selectedVehicle.id].variable.toFixed(2)} €</strong>
            </div>
          )}
        </div>
      )}

      <div className="summary-card">
        <div className="wizard-step-title">Options</div>
        {selectedOptions.length === 0 ? (
          <div className="summary-row">
            <span>Options</span>
            <strong>Aucune</strong>
          </div>
        ) : (
          selectedOptions.map((option) => (
            <div key={option.id} className="summary-row">
              <span>{option.name}</span>
              <strong>{option.price.toFixed(2)} €</strong>
            </div>
          ))
        )}
      </div>

      <div className="summary-card">
        <div className="wizard-step-title">Client</div>
        <div className="summary-row">
          <span>Nom</span>
          <strong>
            {personalInfo.firstName} {personalInfo.lastName}
          </strong>
        </div>
        <div className="summary-row">
          <span>Email</span>
          <strong>{personalInfo.email}</strong>
        </div>
        <div className="summary-row">
          <span>Téléphone</span>
          <strong>{personalInfo.phone}</strong>
        </div>
        {personalInfo.flightNumber && (
          <div className="summary-row">
            <span>Vol</span>
            <strong>{personalInfo.flightNumber}</strong>
          </div>
        )}
      </div>

      <div className="summary-card">
        <div className="wizard-step-title">Total</div>
        <div className="summary-row">
          <span>Trajet</span>
          <strong>{baseTripTotal.toFixed(2)} €</strong>
        </div>
        <div className="summary-row">
          <span>Options</span>
          <strong>{optionsTotal.toFixed(2)} €</strong>
        </div>
        <div className="summary-row">
          <span>Total général</span>
          <strong>{grandTotal.toFixed(2)} €</strong>
        </div>
      </div>
    </div>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderTripStep()
      case 1:
        return renderScheduleStep()
      case 2:
        return renderPassengerStep()
      case 3:
        return (
          <>
            {renderVehicleStep()}
            <div className="options-list">
              {options.map((option) => (
                <div
                  key={option.id}
                  className={`option-item ${option.selected ? "selected" : ""}`}
                  onClick={() => toggleOption(option.id)}
                >
                  <span>{option.name}</span>
                  <strong>{option.price > 0 ? `+${option.price.toFixed(2)} €` : "Gratuit"}</strong>
                </div>
              ))}
            </div>
          </>
        )
      case 4:
        return renderClientStep()
      case 5:
        return renderSummaryStep()
      default:
        return null
    }
  }

  return (
    <div className="page-container manual-reservation-page">
      <div className="page-header">
        <h1>Réservation manuelle</h1>
        <p>Créez une réservation pas à pas tout en restant aligné avec l'expérience utilisateur.</p>
      </div>

      {statusMessage && <div className={`status-banner ${statusType === "error" ? "error" : "success"}`}>{statusMessage}</div>}

      <div className="manual-reservation-layout">
        <div className="wizard-card">
          <div className="wizard-step-title">{STEPS[currentStep].title}</div>
          <p className="wizard-step-description">{STEPS[currentStep].description}</p>
          {renderStepContent()}
          {validationMessage && <p className="validation-message">{validationMessage}</p>}
          <div className="wizard-footer">
            <button type="button" className="secondary-button" onClick={handlePreviousStep} disabled={currentStep === 0 || saving}>
              Retour
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" className="primary-button" onClick={handleNextStep} disabled={saving}>
                Suivant
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={handleConfirmReservation} disabled={saving}>
                {saving ? "Enregistrement..." : "Confirmer"}
              </button>
            )}
          </div>
        </div>

        <div className="wizard-progress">
          <div className="wizard-steps">
            {STEPS.map((step, index) => {
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              return (
                <div
                  key={step.title}
                  className={`wizard-step ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                  onClick={() => {
                    if (index <= currentStep && !saving) {
                      setCurrentStep(index)
                      setValidationMessage("")
                    }
                  }}
                >
                  <div className="wizard-step-indicator">{index + 1}</div>
                  <div className="wizard-step-info">
                    <span className="wizard-step-title">{step.title}</span>
                    <span className="wizard-step-description">{step.description}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="summary-card" style={{ marginTop: 24 }}>
            <div className="wizard-step-title">Total actuel</div>
            <div className="summary-row">
              <span>Trajet</span>
              <strong>{baseTripTotal.toFixed(2)} €</strong>
            </div>
            <div className="summary-row">
              <span>Options</span>
              <strong>{optionsTotal.toFixed(2)} €</strong>
            </div>
            <div className="summary-row">
              <span>Total</span>
              <strong>{grandTotal.toFixed(2)} €</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
