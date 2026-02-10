export interface TeamMember {
  name: string
  role: string
  status: string
  initials: string
}

export interface Activity {
  user: string
  action: string
  time: string
}

export const teamMembers: TeamMember[] = [
  { name: "Alice Chen", role: "Lead Engineer", status: "active", initials: "AC" },
  { name: "Bob Martinez", role: "Designer", status: "active", initials: "BM" },
  { name: "Carol Smith", role: "PM", status: "away", initials: "CS" },
  { name: "Dan Kim", role: "Backend Dev", status: "offline", initials: "DK" },
]

export const recentActivity: Activity[] = [
  { user: "Alice", action: "merged PR #142", time: "2 min ago" },
  { user: "Bob", action: "updated design tokens", time: "15 min ago" },
  { user: "Carol", action: "created sprint backlog", time: "1 hr ago" },
  { user: "Dan", action: "deployed v2.3.1 to staging", time: "3 hr ago" },
]

export const statusColor: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  away: "secondary",
  offline: "outline",
}
