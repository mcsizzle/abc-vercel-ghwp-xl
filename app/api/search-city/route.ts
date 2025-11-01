import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const city = searchParams.get("city")

  if (!city) {
    return NextResponse.json({ error: "City parameter is required" }, { status: 400 })
  }

  // Sanitize and validate input
  const sanitizedCity = city.trim()

  // Length validation
  if (sanitizedCity.length === 0) {
    return NextResponse.json({ error: "City name cannot be empty" }, { status: 400 })
  }

  if (sanitizedCity.length > 100) {
    return NextResponse.json({ error: "City name is too long" }, { status: 400 })
  }

  // Character validation - only allow letters, spaces, hyphens, apostrophes, and periods
  const validCityPattern = /^[a-zA-Z\s\-'.]+$/
  if (!validCityPattern.test(sanitizedCity)) {
    return NextResponse.json({ error: "City name contains invalid characters" }, { status: 400 })
  }

  // Prevent potential injection attacks by checking for suspicious patterns
  const suspiciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i, /eval\(/i, /expression\(/i]

  if (suspiciousPatterns.some((pattern) => pattern.test(sanitizedCity))) {
    return NextResponse.json({ error: "Invalid input detected" }, { status: 400 })
  }

  try {
    // Use OpenStreetMap Nominatim API for geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(sanitizedCity)}&format=json&limit=5`,
      {
        headers: {
          "User-Agent": "SunsetWalkPlanner/1.0",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Failed to fetch city data")
    }

    const data = await response.json()

    const cities = data
      .filter((item: any) => item.type === "city" || item.type === "administrative")
      .map((item: any) => {
        const addressParts = item.display_name.split(", ")
        return {
          name: item.name || addressParts[0],
          country: addressParts[addressParts.length - 1],
          state: addressParts.length > 2 ? addressParts[addressParts.length - 2] : undefined,
          lat: Number.parseFloat(item.lat),
          lon: Number.parseFloat(item.lon),
        }
      })

    return NextResponse.json({ cities })
  } catch (error) {
    console.error("Error searching for city:", error)
    return NextResponse.json({ error: "Failed to search for cities" }, { status: 500 })
  }
}
