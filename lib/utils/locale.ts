// Countries that use Fahrenheit (very few)
const FAHRENHEIT_COUNTRIES = ["United States", "United States of America", "USA", "US", "Liberia", "Myanmar", "Burma"]

export function getTemperatureUnit(country: string): "celsius" | "fahrenheit" {
  // Check if the country uses Fahrenheit
  const usesFahrenheit = FAHRENHEIT_COUNTRIES.some((fc) => country.toLowerCase().includes(fc.toLowerCase()))

  return usesFahrenheit ? "fahrenheit" : "celsius"
}

export function getSpeedUnit(country: string): "mph" | "kmh" {
  // Same countries that use Fahrenheit typically use mph
  const usesMph = FAHRENHEIT_COUNTRIES.some((fc) => country.toLowerCase().includes(fc.toLowerCase()))

  return usesMph ? "mph" : "kmh"
}

export function formatTemperature(temp: number, unit: "celsius" | "fahrenheit"): string {
  const celsius = unit === "celsius" ? temp : ((temp - 32) * 5) / 9
  const fahrenheit = unit === "fahrenheit" ? temp : (temp * 9) / 5 + 32

  return `${Math.round(fahrenheit)}°F / ${Math.round(celsius)}°C`
}

export function formatSpeed(speed: number, unit: "mph" | "kmh"): string {
  const mph = unit === "mph" ? speed : speed * 0.621371
  const kmh = unit === "kmh" ? speed : speed * 1.60934

  return `${Math.round(mph)} mph / ${Math.round(kmh)} km/h`
}
