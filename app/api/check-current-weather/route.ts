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

    const currentWeatherOutfit = generateOutfitForCurrentConditions(currentConditions)

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

function generateOutfitForCurrentConditions(currentConditions: any): OutfitRecommendations {
  const { temperature, condition, precipitation, windSpeed } = currentConditions
  const outerwear: string[] = []
  const shoes: string[] = []
  const accessories: string[] = []

  // Temperature-based outerwear recommendations
  if (temperature >= 75) {
    outerwear.push("Light breathable shirt")
    outerwear.push("Tank top or t-shirt")
  } else if (temperature >= 60) {
    outerwear.push("Light jacket")
    outerwear.push("Long sleeve shirt")
  } else if (temperature >= 45) {
    outerwear.push("Medium jacket")
    outerwear.push("Sweater or hoodie")
  } else if (temperature >= 32) {
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
  if (windSpeed > 15) {
    outerwear.push("Windbreaker")
    if (temperature < 50) {
      accessories.push("Ear warmers or hat")
    }
  }

  // Temperature-based accessories (Rule 4: below 40°F always suggest winter accessories)
  if (temperature < 40) {
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
    if (temperature > 75) {
      shoes.push("Comfortable walking shoes")
      shoes.push("Breathable sneakers")
    } else if (temperature > 50) {
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
  if (currentTempF < COLD_TEMP_F && tempDifference >= 3) {
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
