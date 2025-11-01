import { type NextRequest, NextResponse } from "next/server"

interface WeatherData {
  temperature: number
  condition: string
  precipitation: number
  windSpeed: number
}

interface OutfitRecommendations {
  outerwear: string[]
  shoes: string[]
  accessories: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, date, startTime, city, temperatureUnit = "fahrenheit", speedUnit = "mph" } = body

    if (!lat || !lon || !date || !startTime) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const tempUnitParam = temperatureUnit === "celsius" ? "celsius" : "fahrenheit"
    const speedUnitParam = speedUnit === "kmh" ? "kmh" : "mph"

    // Fetch weather data from Open-Meteo API (free, no API key required)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code&temperature_unit=${tempUnitParam}&wind_speed_unit=${speedUnitParam}&timezone=auto&forecast_days=16`

    const weatherResponse = await fetch(weatherUrl)
    if (!weatherResponse.ok) {
      throw new Error("Failed to fetch weather data")
    }

    const weatherData = await weatherResponse.json()

    // Parse the start time and date to find the correct hour index
    const targetDate = new Date(date)
    const [time, period] = startTime.split(" ")
    let [hours, minutes] = time.split(":").map(Number)

    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) hours += 12
    if (period === "AM" && hours === 12) hours = 0

    // Find the closest hour in the forecast
    const targetDateTime = new Date(targetDate)
    targetDateTime.setHours(hours, 0, 0, 0)

    const hourlyTimes = weatherData.hourly.time
    const targetIndex = hourlyTimes.findIndex((t: string) => {
      const forecastTime = new Date(t)
      return forecastTime >= targetDateTime
    })

    const index = targetIndex >= 0 ? targetIndex : 0

    // Extract weather data for the walk time
    const temperature = Math.round(weatherData.hourly.temperature_2m[index])
    const precipitation = weatherData.hourly.precipitation_probability[index]
    const windSpeed = Math.round(weatherData.hourly.wind_speed_10m[index])
    const weatherCode = weatherData.hourly.weather_code[index]

    const condition = getWeatherCondition(weatherCode)

    const weather: WeatherData = {
      temperature,
      condition,
      precipitation,
      windSpeed,
    }

    // Generate outfit recommendations based on weather
    const recommendations = generateOutfitRecommendations(weather)

    return NextResponse.json({
      weather,
      recommendations,
    })
  } catch (error) {
    console.error("Error fetching outfit recommendations:", error)
    return NextResponse.json(
      { error: `Failed to fetch recommendations: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes
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

function generateOutfitRecommendations(weather: WeatherData): OutfitRecommendations {
  const { temperature, condition, precipitation, windSpeed } = weather
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
  if (precipitation > 50 || condition.toLowerCase().includes("rain")) {
    outerwear.push("Rain jacket")
    shoes.push("Waterproof boots")
    accessories.push("Umbrella")
  } else if (precipitation > 20) {
    accessories.push("Light rain jacket (just in case)")
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

  // Temperature-based accessories
  if (temperature < 40 && !accessories.includes("Winter hat")) {
    accessories.push("Beanie or winter hat")
    if (!accessories.includes("Gloves")) {
      accessories.push("Gloves")
    }
  }

  if (temperature > 70 && condition.toLowerCase().includes("clear")) {
    accessories.push("Sunglasses")
    accessories.push("Sun hat")
    accessories.push("Sunscreen")
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
