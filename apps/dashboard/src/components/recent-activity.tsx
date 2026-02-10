import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { recentActivity } from "@/data/dashboard-data"

export function RecentActivity() {
  return (
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
  )
}
