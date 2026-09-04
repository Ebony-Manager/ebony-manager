import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Scopes needed: read/write Sheets
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)   // { name, email, picture }
  const [token, setToken]       = useState(null)   // OAuth access token
  const [loading, setLoading]   = useState(true)
  const [tokenClient, setTokenClient] = useState(null)

  // Load user from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('ebony_user')
    const savedToken = sessionStorage.getItem('ebony_token')
    if (saved && savedToken) {
      setUser(JSON.parse(saved))
      setToken(savedToken)
    }
    setLoading(false)
  }, [])

  // Initialize Google Identity Services token client
  useEffect(() => {
    if (!CLIENT_ID || typeof window.google === 'undefined') return

    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('OAuth error', response)
          return
        }
        setToken(response.access_token)
        sessionStorage.setItem('ebony_token', response.access_token)

        // Get user info
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${response.access_token}` },
        })
          .then((r) => r.json())
          .then((info) => {
            const u = { name: info.name, email: info.email, picture: info.picture }
            setUser(u)
            sessionStorage.setItem('ebony_user', JSON.stringify(u))
          })
      },
    })

    setTokenClient(tc)
  }, [])

  const signIn = useCallback(() => {
    if (!tokenClient) {
      alert('Google Identity Services no está listo. Verifica VITE_GOOGLE_CLIENT_ID.')
      return
    }
    tokenClient.requestAccessToken()
  }, [tokenClient])

  const signOut = useCallback(() => {
    if (token) {
      window.google?.accounts.oauth2.revoke(token)
    }
    setUser(null)
    setToken(null)
    sessionStorage.removeItem('ebony_user')
    sessionStorage.removeItem('ebony_token')
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
