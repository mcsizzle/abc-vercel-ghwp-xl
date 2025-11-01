// MCP Weather Intelligence Server
// Provides tools for real-time weather checking and outfit recommendation updates

import { z } from "zod"

// Tool schemas
export const getCurrentConditionsSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  tempUnit: z.enum(["celsius", "fahrenheit"]).optional(),
})

export const compareForecastToActualSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  forecastTemp: z.number(),
  forecastCondition: z.string(),
  forecastPrecipitation: z.number(),
  forecastWindSpeed: z.number(),
  tempUnit: z.enum(["celsius", "fahrenheit"]).optional(),
})

export const getGranularWeatherFactorsSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  tempUnit: z.enum(["celsius", "fahrenheit"]).optional(),
})

export const shouldUpdateOutfitSchema = z.object({
  originalTemp: z.number(),
  currentTemp: z.number(),
  originalWindSpeed: z.number(),
  currentWindSpeed: z.number(),
  originalPrecipitation: z.number(),
  currentPrecipitation: z.number(),
})

// MCP Tool: Get Current Weather Conditions
export async function getCurrentConditions(params: z.infer<typeof getCurrentConditionsSchema>) {
  const { lat, lon, tempUnit = "fahrenheit" } = params

  try {
    // Use the correct temperature and speed units
    const speedUnit = tempUnit === "celsius" ? "kmh" : "mph"

    // Fetch current weather from Open-Meteo API
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,weather_code,relative_humidity_2m,apparent_temperature&temperature_unit=${tempUnit}&wind_speed_unit=${speedUnit}&timezone=auto`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch current weather")
    }

    const data = await response.json()
    const current = data.current

    return {
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature),
      precipitation: current.precipitation || 0,
      windSpeed: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      condition: getWeatherCondition(current.weather_code),
      weatherCode: current.weather_code,
      timestamp: current.time,
    }
  } catch (error) {
    console.error("Error fetching current conditions:", error)
    throw error
  }
}

// MCP Tool: Compare Forecast to Actual Conditions
export async function compareForecastToActual(params: z.infer<typeof compareForecastToActualSchema>) {
  const {
    lat,
    lon,
    forecastTemp,
    forecastCondition,
    forecastPrecipitation,
    forecastWindSpeed,
    tempUnit = "fahrenheit",
  } = params

  const current = await getCurrentConditions({ lat, lon, tempUnit })

  const tempDiff = current.temperature - forecastTemp
  const windDiff = current.windSpeed - forecastWindSpeed
  const precipDiff = current.precipitation - forecastPrecipitation

  const comparison = {
    temperature: {
      forecast: forecastTemp,
      actual: current.temperature,
      difference: tempDiff,
      significant: Math.abs(tempDiff) > 5,
    },
    windSpeed: {
      forecast: forecastWindSpeed,
      actual: current.windSpeed,
      difference: windDiff,
      significant: Math.abs(windDiff) > 5,
    },
    precipitation: {
      forecast: forecastPrecipitation,
      actual: current.precipitation,
      difference: precipDiff,
      significant: Math.abs(precipDiff) > 20,
    },
    condition: {
      forecast: forecastCondition,
      actual: current.condition,
      changed: forecastCondition.toLowerCase() !== current.condition.toLowerCase(),
    },
  }

  const hasSignificantChanges =
    comparison.temperature.significant || comparison.windSpeed.significant || comparison.precipitation.significant

  return {
    comparison,
    hasSignificantChanges,
    summary: generateComparisonSummary(comparison),
  }
}

// MCP Tool: Get Granular Weather Factors
export async function getGranularWeatherFactors(params: z.infer<typeof getGranularWeatherFactorsSchema>) {
  const { lat, lon, tempUnit = "fahrenheit" } = params

  try {
    // Use the correct temperature and speed units
    const speedUnit = tempUnit === "celsius" ? "kmh" : "mph"

    // Fetch detailed weather data including UV, air quality, etc.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=uv_index&temperature_unit=${tempUnit}&wind_speed_unit=${speedUnit}&timezone=auto`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error("Failed to fetch granular weather data")
    }

    const data = await response.json()
    const current = data.current

    // Get current hour's UV index
    const currentHour = new Date().getHours()
    const uvIndex = data.hourly.uv_index[currentHour] || 0

    // Calculate wind chill (works with both Celsius and Fahrenheit)
    const windChill = calculateWindChill(current.temperature_2m, current.wind_speed_10m, tempUnit)

    return {
      windChill: Math.round(windChill),
      humidity: current.relative_humidity_2m,
      uvIndex: Math.round(uvIndex * 10) / 10,
      cloudCover: current.cloud_cover,
      windDirection: current.wind_direction_10m,
      windGusts: Math.round(current.wind_gusts_10m),
      feelsLike: Math.round(current.apparent_temperature),
      visibility: "Good", // Open-Meteo doesn't provide this in free tier
      airQuality: "Moderate", // Would need separate API for real AQI
    }
  } catch (error) {
    console.error("Error fetching granular weather factors:", error)
    throw error
  }
}

// MCP Tool: Determine if Outfit Should Be Updated
export function shouldUpdateOutfit(params: z.infer<typeof shouldUpdateOutfitSchema>) {
  const {
    originalTemp,
    currentTemp,
    originalWindSpeed,
    currentWindSpeed,
    originalPrecipitation,
    currentPrecipitation,
  } = params

  const tempChange = Math.abs(currentTemp - originalTemp)
  const windChange = Math.abs(currentWindSpeed - originalWindSpeed)
  const precipChange = Math.abs(currentPrecipitation - originalPrecipitation)

  const shouldUpdate = tempChange > 5 || windChange > 5 || precipChange > 20

  const reasons = []
  if (tempChange > 5) {
    reasons.push(`Temperature changed by ${tempChange}°F`)
  }
  if (windChange > 5) {
    reasons.push(`Wind speed changed by ${windChange} mph`)
  }
  if (precipChange > 20) {
    reasons.push(`Precipitation probability changed by ${precipChange}%`)
  }

  return {
    shouldUpdate,
    reasons,
    severity: tempChange > 10 || windChange > 10 || precipChange > 40 ? "high" : "moderate",
  }
}

// Helper Functions

function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear sky"
  if (code <= 3) return "Partly cloudy"
  if (code <= 48) return "Foggy"
  if (code <= 67) return "Rainy"
  if (code <= 77) return "Snowy"
  if (code <= 82) return "Rain showers"
  if (code <= 86) return "Snow showers"
  if (code <= 99) return "Thunderstorm"
  return "Partly cloudy"
}

function calculateWindChill(temp: number, windSpeed: number, unit = "fahrenheit"): number {
  if (unit === "celsius") {
    // Wind chill only applies below 10°C
    if (temp > 10 || windSpeed < 4.8) {
      return temp
    }
    // Wind chill formula for Celsius (km/h)
    return 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16)
  } else {
    // Wind chill only applies below 50°F
    if (temp > 50 || windSpeed < 3) {
      return temp
    }
    // Wind chill formula for Fahrenheit (mph)
    return 35.74 + 0.6215 * temp - 35.75 * Math.pow(windSpeed, 0.16) + 0.4275 * temp * Math.pow(windSpeed, 0.16)
  }
}

function generateComparisonSummary(comparison: any): string {
  const parts = []

  if (comparison.temperature.significant) {
    const direction = comparison.temperature.difference > 0 ? "warmer" : "cooler"
    parts.push(
      `Temperature is ${Math.abs(comparison.temperature.difference)}° ${direction} than predicted (${comparison.temperature.actual}° vs ${comparison.temperature.forecast}°)`,
    )
  } else {
    parts.push(`Temperature is close to forecast (${comparison.temperature.actual}°)`)
  }

  if (comparison.windSpeed.significant) {
    const direction = comparison.windSpeed.difference > 0 ? "windier" : "calmer"
    parts.push(
      `Wind is ${Math.abs(comparison.windSpeed.difference)} ${direction} than expected (${comparison.windSpeed.actual} vs ${comparison.windSpeed.forecast})`,
    )
  }

  if (comparison.precipitation.significant) {
    parts.push(
      `Precipitation probability changed significantly (${comparison.precipitation.actual}% vs ${comparison.precipitation.forecast}%)`,
    )
  }

  if (comparison.condition.changed) {
    parts.push(`Conditions changed from ${comparison.condition.forecast} to ${comparison.condition.actual}`)
  }

  return parts.join(". ")
}
