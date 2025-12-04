import { useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { db, storage } from "../firebase"
import "./Pages.css"
import "./VehicleManagement.css"

const createEmptyForm = () => ({
  name: "",
  passengers: "",
  luggage: "",
  basePrice: "",
  pricePerKm: "",
  pricePerHour: "",
  available: true,
  imageUrl: "",
  imagePath: "",
})

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([])
  const [formData, setFormData] = useState(createEmptyForm())
  const [imageFile, setImageFile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: "", message: "" })

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        const fetched = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        fetched.sort((a, b) => a.name.localeCompare(b.name))
        setVehicles(fetched)
        setLoading(false)
      },
      (error) => {
        setFeedback({ type: "error", message: error.message })
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  const availableCount = useMemo(() => vehicles.filter((vehicle) => vehicle.available).length, [vehicles])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((previous) => ({ ...previous, [name]: value }))
  }

  const handleNumberChange = (event) => {
    const { name, value } = event.target
    if (value === "") {
      setFormData((previous) => ({ ...previous, [name]: "" }))
      return
    }

    const numericValue = Number(value)
    if (Number.isNaN(numericValue) || numericValue < 0) {
      return
    }

    setFormData((previous) => ({ ...previous, [name]: value }))
  }

  const handleToggleAvailable = () => {
    setFormData((previous) => ({ ...previous, available: !previous.available }))
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null
    setImageFile(file)
  }

  const resetForm = () => {
    setFormData(createEmptyForm())
    setImageFile(null)
    setEditingId(null)
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Le nom du véhicule est requis."
    }
    if (!formData.passengers) {
      return "Le nombre de passagers est requis."
    }
    if (!formData.basePrice) {
      return "Le prix de base est requis."
    }
    if (!formData.pricePerKm && !formData.pricePerHour) {
      return "Indiquez un tarif au kilomètre ou à l'heure."
    }
    return ""
  }

  const buildVehiclePayload = (imageUrl, imagePath) => ({
    name: formData.name.trim(),
    passengers: Number(formData.passengers || 0),
    luggage: Number(formData.luggage || 0),
    basePrice: Number(formData.basePrice || 0),
    pricePerKm: formData.pricePerKm === "" ? null : Number(formData.pricePerKm),
    pricePerHour: formData.pricePerHour === "" ? null : Number(formData.pricePerHour),
    available: formData.available,
    imageUrl: imageUrl || "",
    imagePath: imagePath || "",
    updatedAt: serverTimestamp(),
  })

  const uploadVehicleImage = async (vehicleId) => {
    if (!imageFile) {
      return { imageUrl: formData.imageUrl, imagePath: formData.imagePath }
    }

    const storagePath = `vehicles/${vehicleId}`
    const storageRef = ref(storage, storagePath)
    await uploadBytes(storageRef, imageFile)
    const url = await getDownloadURL(storageRef)

    return { imageUrl: url, imagePath: storagePath }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationMessage = validateForm()

    if (validationMessage) {
      setFeedback({ type: "error", message: validationMessage })
      return
    }

    setSubmitting(true)
    setFeedback({ type: "", message: "" })

    try {
      if (editingId) {
        const { imageUrl, imagePath } = await uploadVehicleImage(editingId)
        const payload = buildVehiclePayload(imageUrl, imagePath)
        await updateDoc(doc(db, "vehicles", editingId), payload)
        setFeedback({ type: "success", message: "Véhicule mis à jour avec succès." })
      } else {
        const docRef = await addDoc(collection(db, "vehicles"), {
          ...buildVehiclePayload("", ""),
          createdAt: serverTimestamp(),
        })
        const { imageUrl, imagePath } = await uploadVehicleImage(docRef.id)
        if (imageUrl) {
          await updateDoc(docRef, { imageUrl, imagePath })
        }
        setFeedback({ type: "success", message: "Véhicule ajouté avec succès." })
      }
      resetForm()
    } catch (error) {
      setFeedback({ type: "error", message: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (vehicle) => {
    setFormData({
      name: vehicle.name || "",
      passengers: vehicle.passengers?.toString() || "",
      luggage: vehicle.luggage?.toString() || "",
      basePrice: vehicle.basePrice?.toString() || "",
      pricePerKm: vehicle.pricePerKm === null || vehicle.pricePerKm === undefined ? "" : vehicle.pricePerKm.toString(),
      pricePerHour: vehicle.pricePerHour === null || vehicle.pricePerHour === undefined ? "" : vehicle.pricePerHour.toString(),
      available: Boolean(vehicle.available),
      imageUrl: vehicle.imageUrl || "",
      imagePath: vehicle.imagePath || "",
    })
    setEditingId(vehicle.id)
    setImageFile(null)
    setFeedback({ type: "", message: "" })
  }

  const handleDelete = async (vehicle) => {
    const confirmation = window.confirm("Supprimer ce véhicule ?")
    if (!confirmation) {
      return
    }

    try {
      await deleteDoc(doc(db, "vehicles", vehicle.id))
      if (vehicle.imagePath) {
        await deleteObject(ref(storage, vehicle.imagePath)).catch(() => undefined)
      }
      setFeedback({ type: "success", message: "Véhicule supprimé." })
      if (editingId === vehicle.id) {
        resetForm()
      }
    } catch (error) {
      setFeedback({ type: "error", message: error.message })
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Gestion de la flotte</h1>
        <p>Ajoutez, modifiez ou supprimez les véhicules disponibles pour les réservations.</p>
      </div>

      {feedback.message && (
        <div className={`status-banner ${feedback.type === "error" ? "error" : "success"}`}>
          {feedback.message}
        </div>
      )}

      <div className="management-layout">
        <div className="vehicle-list-wrapper">
          <div className="section-card stats-card">
            <div>
              <p className="stats-label">Total véhicules</p>
              <p className="stats-value">{vehicles.length}</p>
            </div>
            <div>
              <p className="stats-label">Disponibles</p>
              <p className="stats-value available">{availableCount}</p>
            </div>
          </div>

          {loading ? (
            <div className="section-card loading-card">Chargement des véhicules...</div>
          ) : vehicles.length === 0 ? (
            <div className="section-card empty-card">Aucun véhicule enregistré pour le moment.</div>
          ) : (
            <div className="vehicle-list">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="vehicle-card">
                  <div className="vehicle-media">
                    {vehicle.imageUrl ? (
                      <img src={vehicle.imageUrl} alt={vehicle.name} />
                    ) : (
                      <div className="vehicle-placeholder">🚗</div>
                    )}
                  </div>
                  <div className="vehicle-details">
                    <div className="vehicle-header">
                      <h3>{vehicle.name}</h3>
                      <span className={`availability ${vehicle.available ? "available" : "unavailable"}`}>
                        {vehicle.available ? "Disponible" : "Indisponible"}
                      </span>
                    </div>
                    <div className="vehicle-meta">
                      <span>{vehicle.passengers} passagers</span>
                      <span>{vehicle.luggage || 0} bagages</span>
                    </div>
                    <div className="vehicle-pricing">
                      <span>{vehicle.basePrice?.toFixed ? vehicle.basePrice.toFixed(2) : Number(vehicle.basePrice || 0).toFixed(2)} € base</span>
                      {vehicle.pricePerKm !== null && vehicle.pricePerKm !== undefined && (
                        <span>{Number(vehicle.pricePerKm).toFixed(2)} €/km</span>
                      )}
                      {vehicle.pricePerHour !== null && vehicle.pricePerHour !== undefined && (
                        <span>{Number(vehicle.pricePerHour).toFixed(2)} €/h</span>
                      )}
                    </div>
                  </div>
                  <div className="vehicle-actions">
                    <button type="button" className="secondary" onClick={() => handleEdit(vehicle)}>
                      Modifier
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(vehicle)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="vehicle-form-card">
          <h2>{editingId ? "Modifier le véhicule" : "Nouveau véhicule"}</h2>
          <form className="vehicle-form" onSubmit={handleSubmit}>
            <div className="vehicle-form-grid">
              <label>
                <span>Nom</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Tesla Model X"
                />
              </label>
              <label>
                <span>Passagers</span>
                <input
                  type="number"
                  min="0"
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleNumberChange}
                  placeholder="4"
                />
              </label>
              <label>
                <span>Bagages</span>
                <input
                  type="number"
                  min="0"
                  name="luggage"
                  value={formData.luggage}
                  onChange={handleNumberChange}
                  placeholder="2"
                />
              </label>
              <label>
                <span>Prix de base (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="basePrice"
                  value={formData.basePrice}
                  onChange={handleNumberChange}
                  placeholder="50"
                />
              </label>
              <label>
                <span>Tarif au km (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pricePerKm"
                  value={formData.pricePerKm}
                  onChange={handleNumberChange}
                  placeholder="1.20"
                />
              </label>
              <label>
                <span>Tarif à l'heure (€)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pricePerHour"
                  value={formData.pricePerHour}
                  onChange={handleNumberChange}
                  placeholder="60"
                />
              </label>
              <label className="availability-toggle">
                <span>Disponible</span>
                <div className="toggle-wrapper">
                  <input type="checkbox" checked={formData.available} onChange={handleToggleAvailable} />
                  <span>{formData.available ? "Oui" : "Non"}</span>
                </div>
              </label>
              <label>
                <span>Image</span>
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>

            {formData.imageUrl && !imageFile && (
              <div className="current-image">
                <img src={formData.imageUrl} alt="Visuel actuel" />
                <p>Image actuelle</p>
              </div>
            )}

            <div className="form-actions">
              {editingId && (
                <button type="button" className="ghost" onClick={resetForm} disabled={submitting}>
                  Annuler
                </button>
              )}
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? "Enregistrement..." : editingId ? "Mettre à jour" : "Ajouter"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
