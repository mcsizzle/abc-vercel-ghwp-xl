"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CalendarIcon,
  Loader2,
  Sunrise,
  Clock,
  MapPin,
  CloudSun,
  Moon,
  Sunset,
  Watch,
  Footprints,
  Leaf,
  Star,
  Sun,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { getTemperatureUnit, getSpeedUnit, formatTemperature, formatSpeed } from "@/lib/utils/locale"

type Step = "city" | "cityConfirmed" | "planWalk" | "result"

interface CityOption {
  name: string
  country: string
  state?: string
  lat: number
  lon: number
}

interface WalkPlan {
  sunsetTime: string
  startTime: string
  timeUntilWalk: string
  city: string
  date: string
  timezone?: string
  walkDurationMinutes?: number
  minutesWalkingInDark?: number
  shouldHaveLeftBy?: string
  weather?: {
    temperature: number
    condition: string
    precipitation: number
    windSpeed: number
  }
  outfitRecommendations?: {
    outerwear: string[]
    shoes: string[]
    accessories: string[]
  }
}

interface CurrentWeatherCheck {
  currentConditions: {
    temperature: number
    apparentTemperature: number
    precipitation: number
    windSpeed: number
    humidity: number
    condition: string
  }
  comparison: {
    hasSignificantChanges: boolean
    summary: string
  }
  granularFactors: {
    windChill: number
    humidity: number
    uvIndex: number
    feelsLike: number
  }
  updateDecision: {
    shouldUpdate: boolean
    reasons: string[]
  }
  updatedOutfit?: {
    outerwear: string[]
    shoes: string[]
    accessories: string[]
  }
  message: string
  timeUntilDeparture: string
}

function formatTimeWithBoth(time12h: string): string {
  try {
    // Parse the 12-hour time format (e.g., "5:30 PM")
    const match = time12h.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (!match) return time12h

    let hours = Number.parseInt(match[1])
    const minutes = match[2]
    const period = match[3].toUpperCase()

    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) {
      hours += 12
    } else if (period === "AM" && hours === 12) {
      hours = 0
    }

    const time24h = `${hours.toString().padStart(2, "0")}:${minutes}`
    return `${time12h} (${time24h})`
  } catch (e) {
    return time12h
  }
}

function getWeatherEmoji(condition: string): string {
  const lower = condition.toLowerCase()
  if (lower.includes("clear") || lower.includes("sunny")) return "☀️"
  if (lower.includes("cloud")) return "☁️"
  if (lower.includes("rain")) return "🌧️"
  if (lower.includes("snow")) return "❄️"
  if (lower.includes("storm") || lower.includes("thunder")) return "⛈️"
  if (lower.includes("fog") || lower.includes("mist")) return "🌫️"
  if (lower.includes("wind")) return "💨"
  return "🌤️"
}

export function SunsetWalkPlanner() {
  console.log("[v0] SunsetWalkPlanner component rendering")

  const [step, setStep] = useState<Step>("city")
  const [city, setCity] = useState("")
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [todaySunsetInfo, setTodaySunsetInfo] = useState<{
    sunsetTime: string
    timeUntilSunset: string
    timezone: string
    sunsetPassed: boolean
  } | null>(null)
  const [hours, setHours] = useState("0")
  const [minutes, setMinutes] = useState("30")
  const [date, setDate] = useState<Date>()
  const [loading, setLoading] = useState(false)
  const [walkPlan, setWalkPlan] = useState<WalkPlan | null>(null)
  const [error, setError] = useState("")
  const [loadingOutfit, setLoadingOutfit] = useState(false)
  const [checkingCurrentWeather, setCheckingCurrentWeather] = useState(false)
  const [currentWeatherCheck, setCurrentWeatherCheck] = useState<CurrentWeatherCheck | null>(null)
  const [temperatureUnit, setTemperatureUnit] = useState<"celsius" | "fahrenheit">("fahrenheit")
  const [speedUnit, setSpeedUnit] = useState<"mph" | "kmh">("mph")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weatherCheckTime, setWeatherCheckTime] = useState<Date | null>(null)

  useEffect(() => {
    console.log("[v0] SunsetWalkPlanner mounted, current step:", step)
  }, [step])

  const handleCitySearch = async () => {
    const sanitizedCity = city.trim()

    // Validate input length
    if (sanitizedCity.length === 0) {
      setError("Please enter a city name")
      return
    }

    if (sanitizedCity.length > 100) {
      setError("City name is too long. Please enter a valid city name.")
      return
    }

    // Validate characters - only allow letters, spaces, hyphens, apostrophes, and periods
    const validCityPattern = /^[a-zA-Z\s\-'.]+$/
    if (!validCityPattern.test(sanitizedCity)) {
      setError("City name contains invalid characters. Please use only letters, spaces, hyphens, and apostrophes.")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Search for cities using geocoding API
      const response = await fetch(`/api/search-city?city=${encodeURIComponent(sanitizedCity)}`)
      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      if (data.cities.length === 0) {
        setError("No cities found with that name. Please try again.")
        setLoading(false)
        return
      }

      if (data.cities.length === 1) {
        handleCitySelect(data.cities[0])
      } else {
        setCityOptions(data.cities)
        setLoading(false)
      }
    } catch (err) {
      setError("Failed to search for cities. Please try again.")
      setLoading(false)
    }
  }

  const handleCitySelect = async (cityOption: CityOption) => {
    setSelectedCity(cityOption)
    setCityOptions([])
    const tempUnit = getTemperatureUnit(cityOption.country)
    const spdUnit = getSpeedUnit(cityOption.country)
    setTemperatureUnit(tempUnit)
    setSpeedUnit(spdUnit)

    setLoading(true)
    try {
      const response = await fetch("/api/calculate-walk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: cityOption.lat,
          lon: cityOption.lon,
          date: "today",
          hours: 0,
          minutes: 0,
          city: `${cityOption.name}, ${cityOption.state ? cityOption.state + ", " : ""}${cityOption.country}`,
          temperatureUnit: tempUnit,
          speedUnit: spdUnit,
        }),
      })

      const data = await response.json()

      if (!data.error) {
        setTodaySunsetInfo({
          sunsetTime: data.sunsetTime,
          timeUntilSunset:
            data.timeUntilWalk === "You should have already started!"
              ? "Sunset has already passed"
              : data.timeUntilWalk,
          timezone: data.timezone,
          sunsetPassed: data.timeUntilWalk === "You should have already started!",
        })
      }
    } catch (err) {
      console.error("Failed to fetch sunset time:", err)
    } finally {
      setLoading(false)
    }

    setStep("cityConfirmed")
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return
    setDate(selectedDate)
  }

  const handleCalculate = async () => {
    const h = Number.parseInt(hours) || 0
    const m = Number.parseInt(minutes) || 0

    if (h === 0 && m === 0) {
      setError("Please enter a walk duration")
      return
    }

    if (h < 0 || m < 0 || m >= 60) {
      setError("Please enter a valid duration")
      return
    }

    if (!date || !selectedCity) {
      setError("Please select a date")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/calculate-walk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: selectedCity.lat,
          lon: selectedCity.lon,
          date: format(date, "yyyy-MM-dd"),
          hours: h,
          minutes: m,
          city: `${selectedCity.name}, ${selectedCity.state ? selectedCity.state + ", " : ""}${selectedCity.country}`,
          temperatureUnit,
          speedUnit,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setWalkPlan(data)
      setStep("result")

      fetchOutfitRecommendations(data, selectedCity, date)
    } catch (err) {
      setError("Failed to calculate walk time. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fetchOutfitRecommendations = async (plan: WalkPlan, cityData: CityOption, walkDate: Date) => {
    setLoadingOutfit(true)
    try {
      const response = await fetch("/api/outfit-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: cityData.lat,
          lon: cityData.lon,
          date: format(walkDate, "yyyy-MM-dd"),
          startTime: plan.startTime,
          city: plan.city,
          temperatureUnit,
          speedUnit,
        }),
      })

      const data = await response.json()

      if (!data.error) {
        setWalkPlan((prev) => ({
          ...prev!,
          weather: data.weather,
          outfitRecommendations: data.recommendations,
        }))
      }
    } catch (err) {
      console.error("Failed to fetch outfit recommendations:", err)
    } finally {
      setLoadingOutfit(false)
    }
  }

  const handleCheckCurrentWeather = async () => {
    if (!walkPlan || !selectedCity) return

    setCheckingCurrentWeather(true)
    setError("")

    try {
      const response = await fetch("/api/check-current-weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: selectedCity.lat,
          lon: selectedCity.lon,
          forecastWeather: walkPlan.weather,
          city: walkPlan.city,
          startTime: walkPlan.startTime,
          temperatureUnit,
          speedUnit,
          originalOutfit: walkPlan.outfitRecommendations,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setCurrentWeatherCheck(data)
      setWeatherCheckTime(new Date())
    } catch (err) {
      console.error("Error checking current weather:", err)
      setError("Failed to check current weather. Please try again.")
    } finally {
      setCheckingCurrentWeather(false)
    }
  }

  const handleRefreshTimeRemaining = () => {
    setCurrentTime(new Date())
  }

  const getMinutesSinceWeatherCheck = (): number => {
    if (!weatherCheckTime) return 0
    const now = new Date()
    const diffMs = now.getTime() - weatherCheckTime.getTime()
    return Math.floor(diffMs / 60000) // Convert milliseconds to minutes
  }

  const handleReset = () => {
    setStep("city")
    setCity("")
    setCityOptions([])
    setSelectedCity(null)
    setTodaySunsetInfo(null)
    setHours("0")
    setMinutes("30")
    setDate(undefined)
    setWalkPlan(null)
    setError("")
    setLoadingOutfit(false)
    setCurrentWeatherCheck(null)
    setTemperatureUnit("fahrenheit")
    setSpeedUnit("mph")
    setCurrentTime(new Date())
    setWeatherCheckTime(null)
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-48">
          <div
            className="absolute inset-0 bg-gradient-to-b from-amber-200/40 via-transparent to-transparent"
            style={{
              clipPath: "polygon(50% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(0deg)",
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-amber-200/30 via-transparent to-transparent"
            style={{
              clipPath: "polygon(50% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(20deg)",
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-amber-200/30 via-transparent to-transparent"
            style={{
              clipPath: "polygon(50% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(-20deg)",
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-amber-200/20 via-transparent to-transparent"
            style={{
              clipPath: "polygon(50% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(40deg)",
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-amber-200/20 via-transparent to-transparent"
            style={{
              clipPath: "polygon(50% 0%, 60% 100%, 40% 100%)",
              transform: "rotate(-40deg)",
            }}
          />
        </div>
        {/* Happy clouds */}
        <div className="absolute top-12 left-8 w-20 h-10 bg-white/40 dark:bg-white/10 rounded-full blur-sm" />
        <div className="absolute top-16 left-12 w-16 h-8 bg-white/30 dark:bg-white/10 rounded-full blur-sm" />
        <div className="absolute top-20 right-12 w-24 h-12 bg-white/40 dark:bg-white/10 rounded-full blur-sm" />
        <div className="absolute top-24 right-16 w-20 h-10 bg-white/30 dark:bg-white/10 rounded-full blur-sm" />
      </div>

      <CardHeader className="text-center space-y-2 relative z-10">
        <div className="flex justify-center mb-2">
          <div className="p-3 bg-accent rounded-full">
            <Sunrise className="h-8 w-8 text-accent-foreground" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold text-balance text-amber-700 dark:text-amber-500">
          Golden Hour Walk Planner
        </CardTitle>
        <CardDescription className="text-base text-pretty">
          ✨ Plan your perfect evening stroll and catch the sunset ✨
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10">
        {/* City Step */}
        {step === "city" && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-base font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>
                  Enter the city where you plan to walk{" "}
                  <span className="text-sm italic text-muted-foreground font-normal">(type only the city name)</span>
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="city"
                  placeholder="Enter your city name..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCitySearch()}
                  className="text-base"
                  maxLength={100}
                />
                <Button onClick={handleCitySearch} disabled={loading} size="lg">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
                </Button>
              </div>
            </div>

            {cityOptions.length > 0 && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <p className="text-sm text-muted-foreground">We found multiple cities with that name. Which one?</p>
                <div className="grid gap-2">
                  {cityOptions.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="justify-start h-auto py-3 text-left bg-transparent"
                      onClick={() => handleCitySelect(option)}
                    >
                      <div>
                        <div className="font-medium">{option.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {option.state && `${option.state}, `}
                          {option.country}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {step === "cityConfirmed" && todaySunsetInfo && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="p-4 bg-secondary rounded-lg">
              <p className="text-sm text-secondary-foreground">
                <span className="font-medium">Location:</span> {selectedCity?.name}
                {selectedCity?.state && `, ${selectedCity.state}`}, {selectedCity?.country}
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-accent/20 to-primary/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Sunrise className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">Today's Sunset</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Sunset time:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatTimeWithBoth(todaySunsetInfo.sunsetTime)}
                    <span className="text-sm font-normal text-muted-foreground ml-2">{todaySunsetInfo.timezone}</span>
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Time until sunset:</span>
                  <span className="text-lg font-semibold">{todaySunsetInfo.timeUntilSunset}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("city")} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep("planWalk")} className="flex-1">
                Plan walk
              </Button>
            </div>
          </div>
        )}

        {step === "planWalk" && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="p-4 bg-secondary rounded-lg">
              <p className="text-sm text-secondary-foreground">
                <span className="font-medium">Location:</span> {selectedCity?.name}
                {selectedCity?.state && `, ${selectedCity.state}`}, {selectedCity?.country}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                How long would you like to walk?
              </Label>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="hours" className="text-sm text-muted-foreground">
                    Hours
                  </Label>
                  <Input
                    id="hours"
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="minutes" className="text-sm text-muted-foreground">
                    Minutes
                  </Label>
                  <Input
                    id="minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                When do you plan to walk?
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-auto py-3",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      if (date < today) return true
                      if (date.getTime() === today.getTime() && todaySunsetInfo?.sunsetPassed) return true
                      return false
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("cityConfirmed")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCalculate} disabled={!date || loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate walk"}
              </Button>
            </div>
          </div>
        )}

        {/* Result Step */}
        {step === "result" && walkPlan && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-4 p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg">
              <div className="text-6xl">🌅</div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-balance">Time to chase the sunset!</h3>
                <p className="text-muted-foreground text-pretty">
                  Here's your perfect walking schedule for {walkPlan.city}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="p-4 bg-gradient-to-br from-accent/20 to-primary/20 rounded-lg space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sunset className="h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Sunset time:</p>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatTimeWithBoth(walkPlan.sunsetTime)}
                  {walkPlan.timezone && (
                    <span className="text-base font-normal text-muted-foreground ml-2">{walkPlan.timezone}</span>
                  )}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-orange-100 to-amber-200 dark:from-orange-900/40 dark:to-amber-800/40 border border-orange-200/50 dark:border-orange-800/30 rounded-lg space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Watch className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                  <p className="text-sm text-muted-foreground">
                    {walkPlan.shouldHaveLeftBy ? "Oops, It's after suggested departure time!" : "Start your walk by:"}
                  </p>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {formatTimeWithBoth(walkPlan.shouldHaveLeftBy || walkPlan.startTime)}
                  {walkPlan.timezone && (
                    <span className="text-base font-normal text-muted-foreground ml-2">{walkPlan.timezone}</span>
                  )}
                </p>
              </div>

              {walkPlan.minutesWalkingInDark && walkPlan.minutesWalkingInDark > 0 && (
                <div className="p-4 bg-gradient-to-br from-slate-100 to-indigo-100 dark:from-slate-800/50 dark:to-indigo-900/30 border border-slate-300/50 dark:border-indigo-700/30 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Walking after sunset</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    With this walk duration, you'll be walking for approximately{" "}
                    <span className="font-semibold">{walkPlan.minutesWalkingInDark} minutes</span> after sunset.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("planWalk")}
                    className="w-full mt-2 bg-slate-700 text-white hover:bg-slate-600 border-slate-700"
                  >
                    Adjust Walk Duration
                  </Button>
                </div>
              )}

              {!walkPlan.shouldHaveLeftBy && (
                <div className="p-4 bg-gradient-to-br from-lime-50 to-green-100 dark:from-lime-950/30 dark:to-green-900/30 border border-lime-600/70 dark:border-lime-600/50 rounded-lg space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Footprints className="h-5 w-5 text-lime-600 dark:text-lime-400" />
                      <p className="text-sm text-muted-foreground">Time remaining until you need to leave:</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshTimeRemaining}
                      className="h-8 w-8 p-0 hover:bg-lime-200/50 dark:hover:bg-lime-800/30"
                      title="Refresh time remaining"
                    >
                      <RefreshCw className="h-4 w-4 text-lime-600 dark:text-lime-400" />
                    </Button>
                  </div>
                  <p className="text-2xl font-bold text-lime-700 dark:text-lime-400">{walkPlan.timeUntilWalk}</p>
                </div>
              )}
            </div>

            {loadingOutfit && (
              <div className="p-6 bg-card border rounded-lg text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Checking weather and preparing outfit suggestions...</p>
              </div>
            )}

            {walkPlan.weather && walkPlan.outfitRecommendations && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border rounded-lg space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="text-3xl">{getWeatherEmoji(walkPlan.weather.condition)}</div>
                    <div>
                      <h4 className="font-semibold text-lg">Weather Forecast</h4>
                      <p className="text-sm text-muted-foreground">For your walk time</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Temperature</p>
                      <p className="font-medium">{formatTemperature(walkPlan.weather.temperature, temperatureUnit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conditions</p>
                      <p className="font-medium">{walkPlan.weather.condition}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Precipitation</p>
                      <p className="font-medium">{walkPlan.weather.precipitation}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Wind Speed</p>
                      <p className="font-medium">{formatSpeed(walkPlan.weather.windSpeed, speedUnit)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-primary/20 space-y-3">
                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-2 border-yellow-600/50 dark:border-yellow-700/40 rounded-lg space-y-3">
                      <div>
                        <h4 className="font-semibold text-base mb-1">What to Wear</h4>
                        <p className="text-sm text-muted-foreground text-pretty">
                          Based on the weather conditions, here's what we recommend:
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Outerwear</p>
                          <div className="flex flex-wrap gap-2">
                            {walkPlan.outfitRecommendations.outerwear.map((item, index) => (
                              <span
                                key={index}
                                className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Footwear</p>
                          <div className="flex flex-wrap gap-2">
                            {walkPlan.outfitRecommendations.shoes.map((item, index) => (
                              <span
                                key={index}
                                className="px-3 py-1.5 bg-accent/10 text-accent rounded-full text-sm font-medium"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Accessories</p>
                          <div className="flex flex-wrap gap-2">
                            {walkPlan.outfitRecommendations.accessories.map((item, index) => (
                              <span
                                key={index}
                                className="px-3 py-1.5 bg-yellow-50/70 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-medium"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-accent/20 to-primary/20 border border-accent rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <CloudSun className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">Ready to head out?</h4>
                      <p className="text-sm text-muted-foreground text-pretty">
                        Check the current weather conditions right before your walk to make sure your outfit is still
                        perfect!
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCheckCurrentWeather}
                    disabled={checkingCurrentWeather}
                    className="w-full"
                    variant="default"
                  >
                    {checkingCurrentWeather ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking current weather...
                      </>
                    ) : (
                      <>
                        <CloudSun className="h-4 w-4 mr-2" />
                        Check current weather
                      </>
                    )}
                  </Button>
                </div>

                {currentWeatherCheck && (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/20 rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="text-3xl">
                          {getWeatherEmoji(currentWeatherCheck.currentConditions.condition)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">Current Weather Update</h4>
                          <p className="text-sm text-muted-foreground">
                            Live conditions right now
                            {weatherCheckTime && (
                              <span className="ml-1">
                                (checked {getMinutesSinceWeatherCheck()}{" "}
                                {getMinutesSinceWeatherCheck() === 1 ? "minute" : "minutes"} ago)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-card/50 rounded-lg">
                        <p className="text-sm leading-relaxed">{currentWeatherCheck.message}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Current Temp</p>
                          <p className="font-medium text-lg">
                            {formatTemperature(currentWeatherCheck.currentConditions.temperature, temperatureUnit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Feels Like</p>
                          <p className="font-medium text-lg">
                            {formatTemperature(currentWeatherCheck.granularFactors.feelsLike, temperatureUnit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Wind Speed</p>
                          <p className="font-medium">
                            {formatSpeed(currentWeatherCheck.currentConditions.windSpeed, speedUnit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Humidity</p>
                          <p className="font-medium">{currentWeatherCheck.granularFactors.humidity}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">UV Index</p>
                          <p className="font-medium">{currentWeatherCheck.granularFactors.uvIndex}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Wind Chill</p>
                          <p className="font-medium">
                            {formatTemperature(currentWeatherCheck.granularFactors.windChill, temperatureUnit)}
                          </p>
                        </div>
                      </div>

                      {currentWeatherCheck.updatedOutfit && (
                        <div className="p-4 bg-accent/20 border border-accent rounded-lg space-y-3">
                          <p className="font-semibold text-sm">Outfit Check</p>
                          <div className="text-sm space-y-2">
                            <p className="text-muted-foreground">Based on current conditions, here's what to wear:</p>
                            {currentWeatherCheck.updateDecision.shouldUpdate &&
                              currentWeatherCheck.updateDecision.reasons.length > 0 && (
                                <ul className="space-y-1">
                                  {currentWeatherCheck.updateDecision.reasons.map((reason, index) => (
                                    <li key={index} className="text-muted-foreground">
                                      • {reason}
                                    </li>
                                  ))}
                                </ul>
                              )}
                          </div>

                          <div className="space-y-3 pt-2 border-t border-accent/30">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">Outerwear</p>
                              <div className="flex flex-wrap gap-1.5">
                                {currentWeatherCheck.updatedOutfit.outerwear.map((item, index) => (
                                  <span
                                    key={index}
                                    className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">Footwear</p>
                              <div className="flex flex-wrap gap-1.5">
                                {currentWeatherCheck.updatedOutfit.shoes.map((item, index) => (
                                  <span
                                    key={index}
                                    className="px-2.5 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">Accessories</p>
                              <div className="flex flex-wrap gap-1.5">
                                {currentWeatherCheck.updatedOutfit.accessories.map((item, index) => (
                                  <span
                                    key={index}
                                    className="px-2.5 py-1 bg-yellow-50/70 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Encouragement Section */}
            <div className="p-6 bg-gradient-to-br from-lime-50 to-green-100 dark:from-lime-950/30 dark:to-green-900/30 border border-lime-200/50 dark:border-lime-800/30 rounded-lg space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Leaf className="h-6 w-6 text-lime-600 dark:text-lime-400 flex-shrink-0" />
                <h3 className="text-2xl font-bold text-balance text-lime-700 dark:text-lime-400">
                  Good job planning to get outside!
                </h3>
              </div>
              <p className="text-sm text-muted-foreground text-center text-pretty flex items-center justify-center gap-2">
                <Star className="h-4 w-4 flex-shrink-0" />
                <span>Come back again soon, tomorrow is a new day!</span>
                <Sun className="h-4 w-4 flex-shrink-0" />
              </p>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full bg-transparent">
              Plan another walk
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
