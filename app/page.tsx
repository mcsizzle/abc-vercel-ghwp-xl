import { SunsetWalkPlanner } from "@/components/sunset-walk-planner"

export default function Home() {
  console.log("[v0] Home page rendering")
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <SunsetWalkPlanner />
    </main>
  )
}
