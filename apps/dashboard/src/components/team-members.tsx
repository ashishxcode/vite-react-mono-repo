import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { teamMembers, statusColor } from "@/data/dashboard-data"

export function TeamMembers() {
  const [search, setSearch] = useState("")

  const filtered = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()),
  )

  return (
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
  )
}
