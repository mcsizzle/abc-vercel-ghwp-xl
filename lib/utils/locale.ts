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
  return `${Math.round(temp)}°${unit === "celsius" ? "C" : "F"}`
}

export function formatSpeed(speed: number, unit: "mph" | "kmh"): string {
  return `${Math.round(speed)} ${unit === "mph" ? "mph" : "km/h"}`
}
