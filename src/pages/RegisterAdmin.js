import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth"
import { collection, doc, getDocs, setDoc, serverTimestamp, query, where, limit } from "firebase/firestore"
import { auth, db } from "../firebase"
import "./Login.css"

export default function RegisterAdmin() {
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState({ type: "info", message: "" })
  const [loading, setLoading] = useState(false)
  // Autoriser la création de plusieurs administrateurs. Plus de blocage initial.

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!pseudo.trim() || !password.trim()) {
      setStatus({ type: "error", message: "Pseudo et mot de passe requis." })
      return
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Les mots de passe ne correspondent pas." })
      return
    }

    const normalizedPseudo = pseudo.trim().toLowerCase()
    const email = `${normalizedPseudo}@lilyadmin.local`

    setLoading(true)
    setStatus({ type: "info", message: "Vérification des doublons..." })

    try {
      // Vérifier qu'aucun admin avec le même pseudo n'existe déjà
      const q = query(
        collection(db, "adminProfiles"),
        where("pseudo", "==", normalizedPseudo),
        limit(1),
      )
      const dupSnap = await getDocs(q)
      if (!dupSnap.empty) {
        setStatus({ type: "error", message: "Ce pseudo est déjà utilisé par un administrateur." })
        return
      }

      setStatus({ type: "info", message: "Création de l'administrateur..." })
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (normalizedPseudo !== userCredential.user.displayName) {
        await updateProfile(userCredential.user, { displayName: normalizedPseudo })
      }

      await setDoc(doc(db, "adminProfiles", userCredential.user.uid), {
        pseudo: normalizedPseudo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await signOut(auth)

      setStatus({ type: "success", message: "Administrateur créé. Redirection vers la connexion..." })

      setTimeout(() => {
        navigate("/login", { replace: true })
      }, 1200)
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") {
        setStatus({ type: "error", message: "Cet administrateur existe déjà." })
      } else {
        setStatus({ type: "error", message: error.message || "Création impossible." })
      }
    } finally {
      setLoading(false)
    }
  }

  // Plus d'écrans de blocage: on permet la création à tout moment.

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Créer l'administrateur</h1>
        <p className="login-subtitle">Cette page est temporaire. Créez le premier compte administrateur puis supprimez-la.</p>

        {status.message && (
          <div className={`login-error${status.type === "success" ? " login-success" : ""}`} data-type={status.type}>
            {status.message}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="pseudo">
            Pseudo
          </label>
          <input
            id="pseudo"
            type="text"
            value={pseudo}
            onChange={(event) => setPseudo(event.target.value)}
            placeholder="admin"
            autoComplete="username"
            disabled={loading}
          />

          <label className="login-label" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />

          <label className="login-label" htmlFor="confirmPassword">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={loading}
          />

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Création..." : "Créer l'administrateur"}
          </button>
        </form>
      </div>
    </div>
  )
}
