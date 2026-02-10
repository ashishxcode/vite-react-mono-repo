import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const stats = [
  { label: "Team Members", value: "4" },
  { label: "Active Now", value: "2" },
  { label: "Open PRs", value: "7" },
  { label: "Deployments", value: "12" },
]

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="pb-2">
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-3xl">{stat.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
