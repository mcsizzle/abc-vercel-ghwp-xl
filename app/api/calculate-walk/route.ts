import { type NextRequest, NextResponse } from "next/server"
import { find } from "geo-tz"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, date, hours, minutes, city } = body

    if (!lat || !lon || !date || (hours === undefined && minutes === undefined)) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    let timezone = "UTC"
    try {
      const timezones = find(lat, lon)
      if (timezones && timezones.length > 0) {
        timezone = timezones[0]
      }
    } catch (error) {
      console.error("Error looking up timezone, using UTC:", error)
    }

    // Fetch sunset data
    let sunsetData
    try {
      const sunsetUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${date}&formatted=0`
      const sunsetResponse = await fetch(sunsetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      })

      if (!sunsetResponse.ok) {
        throw new Error(`Sunset API returned ${sunsetResponse.status}`)
      }

      sunsetData = await sunsetResponse.json()

      if (sunsetData.status !== "OK") {
        throw new Error("Invalid sunset data received")
      }
    } catch (error) {
      console.error("Error fetching sunset data:", error)
      throw new Error(`Failed to fetch sunset data: ${error}`)
    }

    // Parse sunset time (in UTC)
    const sunsetUTC = new Date(sunsetData.results.sunset)

    // Calculate walk duration in milliseconds
    const walkDurationMs = (hours * 60 + minutes) * 60 * 1000

    // Calculate start time (sunset time minus walk duration)
    const startTime = new Date(sunsetUTC.getTime() - walkDurationMs)

    // Calculate time until walk
    const now = new Date()
    const timeUntilWalkMs = startTime.getTime() - now.getTime()

    let timeUntilWalkStr = ""
    if (timeUntilWalkMs < 0) {
      timeUntilWalkStr = "You should have already started!"
    } else {
      const hoursUntil = Math.floor(timeUntilWalkMs / (1000 * 60 * 60))
      const minutesUntil = Math.floor((timeUntilWalkMs % (1000 * 60 * 60)) / (1000 * 60))
      const daysUntil = Math.floor(hoursUntil / 24)

      if (daysUntil > 0) {
        timeUntilWalkStr = `${daysUntil} day${daysUntil > 1 ? "s" : ""} and ${hoursUntil % 24} hour${hoursUntil % 24 !== 1 ? "s" : ""}`
      } else if (hoursUntil > 0) {
        timeUntilWalkStr = `${hoursUntil} hour${hoursUntil > 1 ? "s" : ""} and ${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`
      } else {
        timeUntilWalkStr = `${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`
      }
    }

    const timezoneAbbr =
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short",
      })
        .formatToParts(sunsetUTC)
        .find((part) => part.type === "timeZoneName")?.value || timezone

    const result = {
      sunsetTime: sunsetUTC.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      }),
      startTime: startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      }),
      timeUntilWalk: timeUntilWalkStr,
      city,
      date,
      timezone: timezoneAbbr, // Return abbreviation instead of full timezone name
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error calculating walk time:", error)
    return NextResponse.json(
      { error: `Failed to calculate walk time: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
