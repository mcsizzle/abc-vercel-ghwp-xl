import { type NextRequest, NextResponse } from "next/server"
import { getCurrentConditions, compareForecastToActual, getGranularWeatherFactors } from "@/lib/mcp/weather-server"

interface OutfitRecommendations {
  outerwear: string[]
  shoes: string[]
  accessories: string[]
}

const COLD_TEMP_F = 40
const COLD_TEMP_C = 4
const HOT_TEMP_F = 75
const HOT_TEMP_C = 24

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lat,
      lon,
      forecastWeather,
      city,
      startTime,
      temperatureUnit = "fahrenheit",
      speedUnit = "mph",
      originalOutfit,
    } = body

    if (!lat || !lon || !forecastWeather || !originalOutfit) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const tempUnit = temperatureUnit === "celsius" ? "celsius" : "fahrenheit"

    // Call MCP tools to get current weather intelligence
    const currentConditions = await getCurrentConditions({ lat, lon, tempUnit })

    const comparison = await compareForecastToActual({
      lat,
      lon,
      forecastTemp: forecastWeather.temperature,
      forecastCondition: forecastWeather.condition,
      forecastPrecipitation: forecastWeather.precipitation,
      forecastWindSpeed: forecastWeather.windSpeed,
      tempUnit,
    })

    const granularFactors = await getGranularWeatherFactors({ lat, lon, tempUnit })

    const currentWeatherOutfit = generateOutfitForCurrentConditions(currentConditions, tempUnit, speedUnit)

    // Generate friendly response message
    const message = generateResponseMessage(comparison, granularFactors, currentConditions, tempUnit)

    return NextResponse.json({
      currentConditions,
      comparison,
      granularFactors,
      updateDecision: {
        shouldUpdate: true, // Always show the outfit check
        reasons: [], // No need for change reasons since we're showing complete outfit
      },
      updatedOutfit: currentWeatherOutfit, // Complete outfit based on current conditions
      message,
    })
  } catch (error) {
    console.error("Error checking current weather:", error)
    return NextResponse.json(
      { error: `Failed to check current weather: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

function generateOutfitForCurrentConditions(
  currentConditions: any,
  tempUnit: string,
  speedUnit: string,
): OutfitRecommendations {
  const { temperature, condition, precipitation, windSpeed } = currentConditions
  const outerwear: string[] = []
  const shoes: string[] = []
  const accessories: string[] = []

  const isCelsius = tempUnit === "celsius"
  const isKmh = speedUnit === "kmh"

  // Temperature thresholds based on unit
  const HOT_TEMP = isCelsius ? 24 : 75 // 75°F = 24°C
  const WARM_TEMP = isCelsius ? 15 : 60 // 60°F = 15°C
  const COOL_TEMP = isCelsius ? 7 : 45 // 45°F = 7°C
  const COLD_TEMP = isCelsius ? 0 : 32 // 32°F = 0°C
  const VERY_COLD_TEMP = isCelsius ? 4 : 40 // 40°F = 4°C

  // Wind speed thresholds based on unit
  const WINDY_THRESHOLD = isKmh ? 24 : 15 // 15 mph = 24 km/h

  // Temperature-based outerwear recommendations
  if (temperature >= HOT_TEMP) {
    outerwear.push("Light breathable shirt")
    outerwear.push("Tank top or t-shirt")
  } else if (temperature >= WARM_TEMP) {
    outerwear.push("Light jacket")
    outerwear.push("Long sleeve shirt")
  } else if (temperature >= COOL_TEMP) {
    outerwear.push("Medium jacket")
    outerwear.push("Sweater or hoodie")
  } else if (temperature >= COLD_TEMP) {
    outerwear.push("Heavy coat")
    outerwear.push("Insulated jacket")
  } else {
    outerwear.push("Winter coat")
    outerwear.push("Thermal layers")
  }

  // Precipitation-based recommendations
  if (precipitation > 0 || condition.toLowerCase().includes("rain")) {
    if (precipitation > 5) {
      outerwear.push("Rain jacket")
      shoes.push("Waterproof boots")
    }
    accessories.push("Umbrella")
  }

  // Snow-based recommendations
  if (condition.toLowerCase().includes("snow")) {
    outerwear.push("Waterproof winter coat")
    shoes.push("Insulated winter boots")
    accessories.push("Winter hat")
    accessories.push("Gloves")
    accessories.push("Scarf")
  }

  // Wind-based recommendations
  if (windSpeed > WINDY_THRESHOLD) {
    outerwear.push("Windbreaker")
    if (temperature < (isCelsius ? 10 : 50)) {
      accessories.push("Ear warmers or hat")
    }
  }

  // Temperature-based accessories (Rule 4: below 40°F/4°C always suggest winter accessories)
  if (temperature < VERY_COLD_TEMP) {
    if (!accessories.includes("Winter hat") && !accessories.includes("Beanie or winter hat")) {
      accessories.push("Winter hat")
    }
    if (!accessories.includes("Gloves")) {
      accessories.push("Gloves")
    }
    if (!accessories.includes("Scarf")) {
      accessories.push("Scarf")
    }
  }

  // Default shoe recommendations if not set
  if (shoes.length === 0) {
    if (temperature > HOT_TEMP) {
      shoes.push("Comfortable walking shoes")
      shoes.push("Breathable sneakers")
    } else if (temperature > (isCelsius ? 10 : 50)) {
      shoes.push("Walking shoes")
      shoes.push("Athletic sneakers")
    } else {
      shoes.push("Closed-toe shoes")
      shoes.push("Warm sneakers or boots")
    }
  }

  return {
    outerwear: outerwear.slice(0, 3), // Limit to top 3 recommendations
    shoes: shoes.slice(0, 2),
    accessories: accessories.slice(0, 4),
  }
}

function generateResponseMessage(
  comparison: any,
  granularFactors: any,
  currentConditions: any,
  tempUnit: string,
): string {
  const parts = []

  // Convert temperature to Fahrenheit for consistent logic
  const currentTempF =
    tempUnit === "celsius" ? (currentConditions.temperature * 9) / 5 + 32 : currentConditions.temperature

  // Add comparison summary
  parts.push(`${comparison.summary}.`)

  // Rule 6: Only mention wind chill for very cold weather (below 40°F / 4°C) and when significant
  const tempDifference = Math.abs(granularFactors.feelsLike - currentConditions.temperature)
  if (currentTempF < HOT_TEMP_F && tempDifference >= 3) {
    const comparison = granularFactors.feelsLike < currentConditions.temperature ? "colder" : "warmer"
    parts.push(
      `Feels like ${granularFactors.feelsLike}°${tempUnit === "celsius" ? "C" : "F"} (${comparison} than actual temperature).`,
    )
  }

  // Rule 5: Only mention humidity for hot weather (above 75°F / 24°C) and when significant
  if (currentTempF >= HOT_TEMP_F) {
    if (granularFactors.humidity > 70) {
      const impact = granularFactors.humidity > 80 ? "very muggy" : "humid"
      parts.push(`Humidity is ${granularFactors.humidity}% (${impact} - will feel hotter).`)
    }
  }

  return parts.join(" ")
}
