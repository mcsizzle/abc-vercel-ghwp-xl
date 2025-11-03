import { type NextRequest, NextResponse } from "next/server"
import moment from "moment-timezone"
import { DateTime } from "luxon"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, date, hours, minutes, city } = body

    if (!lat || !lon || !date || (hours === undefined && minutes === undefined)) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    let timezone = "UTC"
    try {
      const timezoneUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto`
      const timezoneResponse = await fetch(timezoneUrl)

      if (timezoneResponse.ok) {
        const timezoneData = await timezoneResponse.json()
        if (timezoneData.timezone) {
          timezone = timezoneData.timezone
        }
      }
    } catch (error) {
      console.error("Error looking up timezone, using UTC:", error)
    }

    let actualDate = date
    if (date === "today") {
      actualDate = moment.tz(timezone).format("YYYY-MM-DD")
    }

    // Fetch sunset data
    let sunsetData
    try {
      const sunsetUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${actualDate}&formatted=0`
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
    const walkDurationMinutes = hours * 60 + minutes

    // Calculate start time (sunset time minus walk duration)
    const startTime = new Date(sunsetUTC.getTime() - walkDurationMs)

    // Calculate time until walk
    const now = new Date()
    const timeUntilWalkMs = startTime.getTime() - now.getTime()

    let minutesWalkingInDark = 0
    let shouldHaveLeftBy: string | undefined = undefined

    if (timeUntilWalkMs < 0 && walkDurationMinutes > 0) {
      // Walk should have already started
      // Calculate when they should have left to finish at sunset
      shouldHaveLeftBy = startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: timezone,
      })

      // Calculate how many minutes they'll be walking in the dark if they start now
      const timeUntilSunsetMs = sunsetUTC.getTime() - now.getTime()
      if (timeUntilSunsetMs > 0) {
        // Sunset hasn't happened yet
        const minutesUntilSunset = Math.floor(timeUntilSunsetMs / (1000 * 60))
        if (walkDurationMinutes > minutesUntilSunset) {
          minutesWalkingInDark = walkDurationMinutes - minutesUntilSunset
        }
      } else {
        // Sunset has already passed
        minutesWalkingInDark = walkDurationMinutes
      }
    }

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

    const timezoneAbbr = moment.tz(timezone).zoneAbbr()

    console.log("[v0] Timezone from Open-Meteo:", timezone)
    console.log("[v0] Moment-timezone abbreviation:", timezoneAbbr)
    console.log("[v0] DateTime object:", DateTime.now().setZone(timezone).toString())

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
      date: actualDate, // Return the actual date used (not "today")
      timezone: timezoneAbbr,
      walkDurationMinutes,
      minutesWalkingInDark: minutesWalkingInDark > 0 ? minutesWalkingInDark : undefined,
      shouldHaveLeftBy,
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
