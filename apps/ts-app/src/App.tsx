import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"

const teamMembers = [
  { name: "Alice Chen", role: "Lead Engineer", status: "active", initials: "AC" },
  { name: "Bob Martinez", role: "Designer", status: "active", initials: "BM" },
  { name: "Carol Smith", role: "PM", status: "away", initials: "CS" },
  { name: "Dan Kim", role: "Backend Dev", status: "offline", initials: "DK" },
]

const recentActivity = [
  { user: "Alice", action: "merged PR #142", time: "2 min ago" },
  { user: "Bob", action: "updated design tokens", time: "15 min ago" },
  { user: "Carol", action: "created sprint backlog", time: "1 hr ago" },
  { user: "Dan", action: "deployed v2.3.1 to staging", time: "3 hr ago" },
]

const statusColor: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  away: "secondary",
  offline: "outline",
}

function App() {
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")

  const filtered = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your team, track activity, and stay connected.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Team Members", value: "4" },
            { label: "Active Now", value: "2" },
            { label: "Open PRs", value: "7" },
            { label: "Deployments", value: "12" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Current roster and availability.</CardDescription>
              <div className="pt-2">
                <Input
                  placeholder="Search by name or role..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filtered.map((member) => (
                  <div key={member.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{member.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <Badge variant={statusColor[member.status]}>{member.status}</Badge>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground">No members found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>What the team has been up to.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((item, i) => (
                  <div key={i}>
                    <p className="text-sm">
                      <span className="font-medium">{item.user}</span> {item.action}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                    {i < recentActivity.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Message</CardTitle>
            <CardDescription>Send an update to the whole team.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <p className="text-xs text-muted-foreground">
              {message.length > 0 ? `${message.length} characters` : "Markdown supported"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMessage("")}>
                Clear
              </Button>
              <Button disabled={message.length === 0}>Send to Team</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default App
