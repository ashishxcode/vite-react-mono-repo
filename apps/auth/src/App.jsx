import { useState } from "react"
import { useAuth } from "@workspace/firebase/hooks/useAuth"
import { Navbar } from "@/components/navbar"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"

function App() {
  const { user, loading } = useAuth()
  const [view, setView] = useState("login")

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (user) {
    window.location.href = "/"
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onLoginClick={() => setView("login")} />

      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          {view === "login" ? (
            <LoginForm onSwitch={() => setView("signup")} />
          ) : (
            <SignupForm onSwitch={() => setView("login")} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
