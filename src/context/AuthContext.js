import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth"
import { auth, db } from "../firebase"

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdmin(null)
        setInitializing(false)
        return
      }

      try {
        const profileSnapshot = await getDoc(doc(db, "adminProfiles", user.uid))
        if (!profileSnapshot.exists()) {
          await signOut(auth)
          setAdmin(null)
          setInitializing(false)
          return
        }

        const data = profileSnapshot.data()
        const pseudo = (data?.pseudo || user.displayName || user.email?.split("@")[0] || "admin").toLowerCase()
        setAdmin({
          id: user.uid,
          pseudo,
          email: user.email,
        })
      } catch (error) {
        console.error("[auth] Failed to resolve admin session", error)
        await signOut(auth)
        setAdmin(null)
      } finally {
        setInitializing(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const login = useCallback(async (pseudo, password) => {
    const normalizedPseudo = pseudo.trim().toLowerCase()
    if (!normalizedPseudo || !password) {
      throw new Error("Pseudo et mot de passe requis.")
    }

    setLoading(true)
    try {
      const email = `${normalizedPseudo}@lilyadmin.local`
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      if (error?.code === "auth/invalid-credential" || error?.code === "auth/user-not-found") {
        throw new Error("Identifiants invalides.")
      }
      if (error?.code === "auth/wrong-password") {
        throw new Error("Mot de passe incorrect.")
      }
      throw new Error(error?.message || "Impossible de se connecter.")
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await signOut(auth)
      setAdmin(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo(
    () => ({
      admin,
      loading,
      initializing,
      login,
      logout,
      isAuthenticated: Boolean(admin),
    }),
    [admin, loading, initializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
