import { Button } from "@workspace/ui/components/button"

export function Navbar({ onLoginClick }) {
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <span className="text-lg font-semibold">Workspace</span>
        <Button variant="outline" size="sm" onClick={onLoginClick}>
          Login
        </Button>
      </div>
    </nav>
  )
}
