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
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

export function QuickMessage() {
  const [message, setMessage] = useState("")

  return (
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
  )
}
