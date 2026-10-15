"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CloudSun, Droplets, Wind, RefreshCw } from "lucide-react";
import { fetchWeather, WeatherData } from "@/services/weatherService";

export default function WeatherCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWeather = async (lat?: number, lon?: number) => {
    setLoading(true);
    const data = await fetchWeather(lat, lon);
    setWeather(data);
    setLoading(false);
  };

  const handleRefresh = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loadWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          loadWeather(); // fallback
        }
      );
    } else {
      loadWeather();
    }
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  const formatLastUpdated = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-md min-h-[220px] flex items-center justify-center bg-white border border-gray-100">
          <p className="text-gray-600 text-base font-semibold animate-pulse">Loading weather</p>
      </Card>
    );
  }

  if (!weather) return null;

  return (
    <Card className="rounded-2xl shadow-md relative overflow-hidden bg-white border border-gray-100">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-gray-800">Today's Weather</h2>
          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-green-600 transition p-1 rounded-full hover:bg-gray-50 focus:outline-none cursor-pointer"
            title="Refresh weather"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            <h3 className="text-4xl font-extrabold text-gray-800">
              {weather.temperature}°C
            </h3>
            <p className="text-gray-500 font-medium mt-1">
              📍 {weather.location}
            </p>
            <p className="text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full inline-block font-semibold mt-2 capitalize border border-green-100">
              {weather.condition}
            </p>
          </div>
          <CloudSun size={56} className="text-yellow-500 animate-bounce duration-1000" />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100 text-sm">
          <div className="flex flex-col items-center text-center">
            <Droplets className="text-blue-500 mb-1" size={20} />
            <span className="text-sm text-gray-600 font-semibold">Humidity</span>
            <span className="font-bold text-gray-700 mt-0.5">{weather.humidity}%</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <CloudSun className="text-indigo-500 mb-1" size={20} />
            <span className="text-sm text-gray-600 font-semibold">Rain</span>
            <span className="font-bold text-gray-700 mt-0.5">{weather.rainProbability}%</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <Wind className="text-green-600 mb-1" size={20} />
          <span className="text-sm text-gray-600 font-semibold">Wind</span>
            <span className="font-bold text-gray-700 mt-0.5">{weather.windSpeed} km/h</span>
          </div>
        </div>

        <div className="text-right mt-6 text-sm text-gray-600 font-semibold">
          Updated {formatLastUpdated(weather.timestamp)}
        </div>
      </CardContent>
    </Card>
  );
}
