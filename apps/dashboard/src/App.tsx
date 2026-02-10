import { useAuth } from "@workspace/firebase/hooks/useAuth"
import { Navbar } from "@/components/navbar"
import { StatsCards } from "@/components/stats-cards"
import { TeamMembers } from "@/components/team-members"
import { RecentActivity } from "@/components/recent-activity"
import { QuickMessage } from "@/components/quick-message"

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    window.location.href = "/auth"
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar email={user.email ?? ""} onSignOut={signOut} />

      <div className="p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your team, track activity, and stay connected.
            </p>
          </div>

          <StatsCards />

          <div className="grid gap-6 lg:grid-cols-3">
            <TeamMembers />
            <RecentActivity />
          </div>

          <QuickMessage />
        </div>
      </div>
    </div>
  )
}

export default App
