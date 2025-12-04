import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "./Login.css"

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pseudo, setPseudo] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = location.state?.from?.pathname || "/reservations"
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    try {
      await login(pseudo, password)
    } catch (submitError) {
      setError(submitError.message || "Impossible de se connecter.")
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Portail administrateur</h1>
        <p className="login-subtitle">Connectez-vous pour accéder au tableau de bord LilyAdmin.</p>

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
            autoComplete="current-password"
            disabled={loading}
          />

          {error && <div className="login-error">{error}</div>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  )
}
