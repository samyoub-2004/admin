import { useEffect, useMemo, useState } from "react"
import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "../firebase"
import BasicMap from "../components/BasicMap"
import RouteMap from "../components/RouteMap"
import "./Pages.css"
import "./ReservationsDashboard.css"

const STATUS_OPTIONS = ["pending", "confirmed", "assigned", "completed", "cancelled", "rejected"]
const PAYMENT_METHODS = ["all", "stripe", "paypal", "cash", "manual"]

const DEFAULT_FILTERS = {
  status: "all",
  paymentMethod: "all",
  dateFrom: "",
  dateTo: "",
}

// Static map no longer used; live map is rendered via RouteMap

const defaultDrivers = [
  { id: "driver-1", name: "Jean Dupont" },
  { id: "driver-2", name: "Sophie Martin" },
  { id: "driver-3", name: "Karim Ben" },
  { id: "driver-4", name: "Laura Chen" },
]

// buildStaticMapUrl removed

const toDateValue = (value) => {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    return new Date(value.seconds * 1000 + value.nanoseconds / 1e6)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatTimestamp = (value) => {
  const date = toDateValue(value)
  return date ? date.toLocaleString("fr-FR") : ""
}

const getCustomerName = (reservation) => {
  if (!reservation) return "Client"
  const direct = reservation.userName && typeof reservation.userName === "string" ? reservation.userName.trim() : ""
  if (direct) return direct
  const first = reservation.personalInfo?.firstName || reservation.guestInfo?.firstName || "Client"
  const last = reservation.personalInfo?.lastName || reservation.guestInfo?.lastName || ""
  return `${first} ${last}`.trim()
}

export default function ReservationsDashboard() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingReservationId, setSavingReservationId] = useState(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [statusType, setStatusType] = useState("")
  const [drivers, setDrivers] = useState(defaultDrivers)

  useEffect(() => {
    const reservationsRef = collection(db, "reservations")
    const baseQuery = query(reservationsRef, orderBy("createdAt", "desc"), limit(100))

    const unsubscribe = onSnapshot(
      baseQuery,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setReservations(items)
        setLoading(false)
      },
      (error) => {
        setStatusMessage(error.message)
        setStatusType("error")
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "drivers"))
        if (!snapshot.empty) {
          const fetchedDrivers = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
          const normalized = fetchedDrivers
            .filter((driver) => driver.name)
            .map((driver) => ({ id: driver.id, name: driver.name }))
          if (normalized.length > 0) {
            setDrivers(normalized)
          }
        }
      } catch (error) {
        // keep default list if collection missing
        console.warn("[reservations] Unable to fetch drivers:", error)
      }
    }

    fetchDrivers()
  }, [])

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const { status, paymentMethod, dateFrom, dateTo } = filters

      const reservationStatus = reservation.status || "pending"
      const reservationPayment = reservation.paymentMethod || reservation.paymentInfo?.method || ""

      const matchesStatus = status === "all" || reservationStatus === status
      const matchesPayment = paymentMethod === "all" || reservationPayment === paymentMethod

      const reservationDate = toDateValue(reservation.date)
      const fromDate = toDateValue(dateFrom)
      const toDate = toDateValue(dateTo)

      const matchesDate =
        !reservationDate ||
        ((fromDate ? reservationDate >= fromDate : true) && (toDate ? reservationDate <= toDate : true))

      return matchesStatus && matchesPayment && matchesDate
    })
  }, [reservations, filters])

  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) {
      return null
    }
    return reservations.find((reservation) => reservation.id === selectedReservationId) || null
  }, [reservations, selectedReservationId])

  useEffect(() => {
    if (filteredReservations.length === 0) {
      setSelectedReservationId(null)
      return
    }

    const stillSelected = filteredReservations.some((reservation) => reservation.id === selectedReservationId)
    if (!stillSelected) {
      setSelectedReservationId(filteredReservations[0].id)
    }
  }, [filteredReservations, selectedReservationId])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const updateReservationStatus = async (reservationId, updates) => {
    setSavingStatus(true)
    setSavingReservationId(reservationId)
    setStatusMessage("")
    setStatusType("")
    try {
      await updateDoc(doc(db, "reservations", reservationId), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setStatusMessage("Réservation mise à jour avec succès.")
      setStatusType("success")
    } catch (error) {
      setStatusMessage(error.message)
      setStatusType("error")
    } finally {
      setSavingStatus(false)
      setSavingReservationId(null)
    }
  }

  const handleStatusSelect = (reservationId, newStatus) => {
    const currentReservation = reservations.find((item) => item.id === reservationId)
    if (!currentReservation) {
      return
    }

    if (newStatus === currentReservation.status) {
      return
    }

    if (newStatus === "rejected") {
      const defaultReason = currentReservation.rejectionReason || ""
      const reason = window.prompt(
        "Veuillez indiquer le motif du refus de cette réservation :",
        defaultReason,
      )

      if (reason === null) {
        return
      }

      const trimmedReason = reason.trim()

      if (trimmedReason.length < 3) {
        setStatusMessage("Le motif de rejet doit contenir au moins 3 caractères.")
        setStatusType("error")
        return
      }

      updateReservationStatus(reservationId, { status: "rejected", rejectionReason: trimmedReason })
      return
    }

    if (newStatus === "cancelled") {
      const defaultReason = currentReservation.cancellationReason || ""
      const reason = window.prompt(
        "Veuillez indiquer le motif de l'annulation de cette réservation :",
        defaultReason,
      )

      if (reason === null) {
        return
      }

      const trimmedReason = reason.trim()

      if (trimmedReason.length < 3) {
        setStatusMessage("Le motif d'annulation doit contenir au moins 3 caractères.")
        setStatusType("error")
        return
      }

      updateReservationStatus(reservationId, { status: "cancelled", cancellationReason: trimmedReason })
      return
    }

    const updates = { status: newStatus }

    if (currentReservation.rejectionReason) {
      updates.rejectionReason = deleteField()
    }

    if (currentReservation.cancellationReason) {
      updates.cancellationReason = deleteField()
    }

    updateReservationStatus(reservationId, updates)
  }

  const handleAssignDriver = (reservationId, driverId) => {
    const driver = drivers.find((item) => item.id === driverId)
    updateReservationStatus(reservationId, {
      assignedDriver: driver ? { id: driverId, name: driver.name } : null,
      status: driver ? "assigned" : "confirmed",
      assignedAt: driver ? serverTimestamp() : null,
    })
  }

  const computeTimeline = (reservation) => {
    if (!reservation) return []

    const tripType = reservation.type || reservation.tripType || "simple"
    const customerName = getCustomerName(reservation)

    const timeline = [
      {
        label: "Réservation créée",
        time: formatTimestamp(reservation.createdAt),
        description: `${customerName || "Client"} a réservé un trajet ${tripType}.`,
      },
    ]

    if (reservation.status === "confirmed") {
      timeline.push({
        label: "Confirmée",
        time: formatTimestamp(reservation.updatedAt),
        description: "Réservation validée par l'équipe.",
      })
    }

    if (reservation.status === "assigned" && reservation.assignedDriver) {
      timeline.push({
        label: "Chauffeur assigné",
        time: formatTimestamp(reservation.assignedAt || reservation.updatedAt),
        description: `${reservation.assignedDriver.name} prendra en charge ce trajet.`,
      })
    }

    if (reservation.status === "completed") {
      timeline.push({
        label: "Trajet terminé",
        time: formatTimestamp(reservation.completedAt || reservation.updatedAt),
        description: "Le trajet est marqué comme terminé.",
      })
    }

    if (reservation.status === "cancelled") {
      timeline.push({
        label: "Annulée",
        time: formatTimestamp(reservation.updatedAt),
        description: reservation.cancellationReason
          ? `Motif : ${reservation.cancellationReason}`
          : "Réservation annulée.",
      })
    }

    if (reservation.status === "rejected") {
      timeline.push({
        label: "Refusée",
        time: formatTimestamp(reservation.updatedAt),
        description: reservation.rejectionReason ? `Motif : ${reservation.rejectionReason}` : "Réservation refusée.",
      })
    }

    if (reservation.paymentStatus === "completed") {
      timeline.push({
        label: "Paiement confirmé",
        time: formatTimestamp(reservation.paymentCompletedAt || reservation.updatedAt),
        description: `Paiement ${reservation.paymentMethod || ""} enregistré.`,
      })
    }

    return timeline
  }

  const timelineItems = useMemo(() => computeTimeline(selectedReservation), [selectedReservation])

  // Static map URL no longer used; RouteMap renders live route

  return (
    <div className="page-container reservations-page">
      <div className="page-header">
        <h1>Tableau de bord des réservations</h1>
        <p>Suivez vos réservations, assignez des chauffeurs et visualisez les itinéraires.</p>
      </div>

      {statusMessage && <div className={`status-banner ${statusType === "error" ? "error" : "success"}`}>{statusMessage}</div>}

      <div className="filter-bar">
        <div className="filter-control">
          <label>Statut</label>
          <select value={filters.status} onChange={(event) => handleFilterChange("status", event.target.value)}>
            <option value="all">Tous</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-control">
          <label>Méthode de paiement</label>
          <select
            value={filters.paymentMethod}
            onChange={(event) => handleFilterChange("paymentMethod", event.target.value)}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method === "all" ? "Toutes" : method}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-control">
          <label>Date de début</label>
          <input type="date" value={filters.dateFrom} onChange={(event) => handleFilterChange("dateFrom", event.target.value)} />
        </div>

        <div className="filter-control">
          <label>Date de fin</label>
          <input type="date" value={filters.dateTo} onChange={(event) => handleFilterChange("dateTo", event.target.value)} />
        </div>

        <button type="button" className="secondary-action" onClick={resetFilters}>
          Réinitialiser
        </button>
      </div>

      <div className="reservations-layout">
        <div className="reservations-column">
          {loading ? (
            <div className="status-banner info">Chargement des réservations...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="status-banner info">Aucune réservation ne correspond aux filtres.</div>
          ) : (
            <div className="reservations-card-list">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className={`reservation-card ${selectedReservationId === reservation.id ? "selected" : ""}`}
                  onClick={() => setSelectedReservationId(reservation.id)}
                >
                  <div className="reservation-card-header">
                    <div>
                      <h3>{getCustomerName(reservation)}</h3>
                      <div className="reservation-meta">
                        <span>
                          <strong>Date :</strong> {formatTimestamp(reservation.date)}
                          {reservation.time ? ` ${reservation.time}` : ""}
                        </span>
                        <span>
                          <strong>Départ :</strong> {reservation.departure || ""}
                        </span>
                        {reservation.destination && (
                          <span>
                            <strong>Destination :</strong> {reservation.destination}
                          </span>
                        )}
                        <span>
                          <strong>Passagers :</strong> {reservation.passengers || reservation.guestInfo?.passengers || ""}
                        </span>
                        <span>
                          <strong>Montant :</strong> {(reservation.totalPrice || 0).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                    <span className="status-badge" data-status={reservation.status || "pending"}>
                      {reservation.status || "pending"}
                    </span>
                  </div>

                  <div className="reservation-actions">
                    <select
                      value={reservation.status || "pending"}
                      onChange={(event) => handleStatusSelect(reservation.id, event.target.value)}
                      disabled={savingStatus && savingReservationId === reservation.id}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <select
                      value={reservation.assignedDriver?.id || ""}
                      onChange={(event) => handleAssignDriver(reservation.id, event.target.value)}
                      disabled={savingStatus && savingReservationId === reservation.id}
                    >
                      <option value="">Assigner un chauffeur</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>

                    {reservation.type === "simple" || reservation.tripType === "simple" ? (
                      reservation.distance !== undefined && (
                        <span className="pill info">{reservation.distance} km</span>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="reservation-detail-column">
          {selectedReservation ? (
            <div className="detail-stack">
              <div className="reservation-map-card">
                <h3>Itinéraire</h3>
                {selectedReservation?.departure && selectedReservation?.destination ? (
                  <div className="map-preview">
                    <RouteMap
                      departure={selectedReservation.departure}
                      destination={selectedReservation.destination}
                      waypoints={selectedReservation.waypoints || []}
                    />
                  </div>
                ) : (
                  <div className="map-preview">
                    <BasicMap />
                  </div>
                )}
                <div className="reservation-meta">
                  <span>
                    <strong>Départ :</strong> {selectedReservation.departure}
                  </span>
                  {selectedReservation.destination && (
                    <span>
                      <strong>Destination :</strong> {selectedReservation.destination}
                    </span>
                  )}
                  {selectedReservation.waypoints && selectedReservation.waypoints.length > 0 && (
                    <span>
                      <strong>Étapes :</strong> {selectedReservation.waypoints.join(" • ")}
                    </span>
                  )}
                </div>

                {selectedReservation.status === "rejected" && selectedReservation.rejectionReason && (
                  <div className="reason-banner rejected">
                    <h4>Motif du refus</h4>
                    <p>{selectedReservation.rejectionReason}</p>
                  </div>
                )}

                {selectedReservation.status === "cancelled" && selectedReservation.cancellationReason && (
                  <div className="reason-banner cancelled">
                    <h4>Motif de l'annulation</h4>
                    <p>{selectedReservation.cancellationReason}</p>
                  </div>
                )}
              </div>

              <div className="timeline-card">
                <h3>Historique</h3>
                <div className="timeline-list">
                  {timelineItems.map((item, index) => (
                    <div key={index} className="timeline-item">
                      <div>
                        <h4>{item.label}</h4>
                        <span>{item.time}</span>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="status-banner info">Sélectionnez une réservation pour voir les détails.</div>
          )}
        </div>
      </div>
    </div>
  )
}
