# Golden hour walk planner agent
This agent helps you get a daily walk in at end of day, telling you the latest you can leave in order to complete your walk before dark, based on your city's sunset time on a given day. It helps you create a plan to walk for a specified duration and tells you the weather forecast based on the city location you specify. An appropriate outfit will be suggested based on the forecast, and then closer to your walk departure time you can check the actual current weather so you'll know if you need to make any adjustment to your outfit. 

## Deployment
Project is live at:
**[https://goldenhourwalker.vercel.app](https://goldenhourwalker.vercel.app/)**

## User flow
1. Specify a city name, e.g. Ottawa
2. If needed, select to confirm city name (if more than one location comes back)
3. Configure walk duration
4. Configure walk date
5. View walk plan, including recommended latest time to leave and suggested outfit
6. Closer to time to leave, check current weather and appropriate outfit

## Agentic features
Initially used agent memory to store the walk plan context, search for real-time weather data using the Open-Meteo API, and provide intelligent clothing recommendations based on temperature, precipitation, wind speed, and weather conditions. After calculating your walk time, the app automatically fetches the weather forecast for your specific location and start time, then suggests appropriate outerwear, footwear, and accessories to ensure you're dressed accordingly for your sunset stroll. With inclusion of MCP server, the system acts as an intelligent agent that continuously monitors weather changes and provides actionable recommendations based on real-time conditions. 

## Frontend interaction elements
- Input text field for city name (city only)
- Optional selection button to confirm intended city name 
- Time selection input fields for hours and minutes
- Calendar picker to select date
- Calculate button to kick off plan calculation and compilation
- Report display including local sunset time, time to leave, time left until departure, weather forecast data, outfit suggestion
- Button to check current weather
- Report display including current actual weather and appropriate outfit check
  
## Backend
- MCP server with weather intelligence tools
- API route that acts as the MCP client and calls the tools
- Logic to compare forecast vs actual and update recommendations

## Architecture
**MCP Server Pattern**
- Weather intelligence server with specialized tools for real-time data fetching and analysis
- API routes act as MCP clients, calling server tools to make intelligent decisions
- Separation of concerns: data fetching (MCP server) vs. business logic (API routes)

**Core Capabilities**
- Weather comparison engine that analyzes forecast vs. actual conditions
- Locale-aware internationalization for temperature and speed units
- Intelligent outfit recommendation system based on weather conditions
- Real-time weather monitoring with actionable updates

**API Structure**
- City search with geocoding and disambiguation
- Walk time calculation with timezone intelligence
- Forecast-based outfit recommendations
- Current weather checking with outfit regeneration

## Implementation Details
**MCP Server Tools**
- `getCurrentConditions`, `compareForecastToActual`, `getGranularWeatherFactors`, `shouldUpdateOutfit`
- Granular factors: temperature, feels-like, wind chill (calculated), humidity, UV index, cloud cover, wind direction/gust

**Decision Thresholds**
- Significant weather changes: >5° temperature, >5 wind speed, >20% precipitation
- Conditional reporting: humidity only for hot weather (>75°F), wind chill only for very cold (<40°F) with ≥3° impact
- Rule-based accessories: umbrella when raining, winter gear (hat/scarf/gloves) below 40°F/4°C

**Locale Handling**
- Automatic Celsius/km/h or Fahrenheit/mph based on country (only US, Liberia, Myanmar use Fahrenheit)
