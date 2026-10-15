"use client";

import { useEffect, useState } from "react";
import { 
  IotTelemetryData, 
  deriveDeviceStatus, 
  deriveMoistureStatus, 
  derivePhStatus,
  deriveWaterLevelStatus,
  DerivedDeviceStatus 
} from "@/types/iot";
import { iotService } from "@/services/iotService";
import { 
  Cpu, 
  Droplets, 
  Thermometer, 
  Sun, 
  Wind, 
  Gauge, 
  Activity, 
  Wifi, 
  WifiOff,
  FlaskConical,
  Zap,
  Waves,
  Sprout
} from "lucide-react";

export default function HardwareTelemetryPanel() {
  const [devices, setDevices] = useState<IotTelemetryData[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("esp32_zone_01");
  const [activeTelemetry, setActiveTelemetry] = useState<IotTelemetryData | null>(null);
  
  // Subscribe to all telemetry devices
  useEffect(() => {
    const unsubAll = iotService.subscribeToAllTelemetry((allDevices) => {
      setDevices(allDevices);
    });

    return () => {
      unsubAll();
    };
  }, []);

  // Subscribe to active selected device telemetry
  useEffect(() => {
    if (!selectedDeviceId) return;

    const unsubDevice = iotService.subscribeToTelemetry(selectedDeviceId, (data) => {
      setActiveTelemetry(data);
    });

    return () => {
      unsubDevice();
    };
  }, [selectedDeviceId]);

  const currentStatus: DerivedDeviceStatus = deriveDeviceStatus(activeTelemetry);
  const activeFarmingMode = activeTelemetry?.farmingMode || (selectedDeviceId.toLowerCase().includes("hydro") ? "hydroponics" : "soil");

  // Status Badge derivations
  const moistureStatus = activeTelemetry ? (activeTelemetry.soilMoistureStatus || deriveMoistureStatus(activeTelemetry.soilMoisture ?? 50)) : "optimal";
  const phStatus = activeTelemetry ? (activeTelemetry.phStatus || derivePhStatus(activeTelemetry.ph ?? 6.2)) : "optimal";
  const waterLevelStatus = activeTelemetry ? (activeTelemetry.waterLevelStatus || deriveWaterLevelStatus(activeTelemetry.waterLevel ?? 80)) : "optimal";

  const defaultDevices = [
    { id: "esp32_zone_01", label: "Zone 1 (Soil Terrace)", mode: "soil" },
    { id: "esp32_zone_02", label: "Zone 2 (Soil Beds)", mode: "soil" },
    { id: "hydro_zone_01", label: "Hydro Zone 1 (NFT Racks)", mode: "hydroponics" }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${
            activeFarmingMode === "hydroponics"
              ? "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
              : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          }`}>
            {activeFarmingMode === "hydroponics" ? <FlaskConical className="w-6 h-6" /> : <Cpu className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Hardware Telemetry ({activeFarmingMode === "hydroponics" ? "Hydroponics System" : "Soil Farming"})
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Live ESP32 telemetry feeds for soil & hydroponic farming modes
            </p>
          </div>
        </div>

        {/* Status Badges & Controls */}
        <div className="flex items-center space-x-3">
          {/* Mode Tag */}
          <span className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1 ${
            activeFarmingMode === "hydroponics"
              ? "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
          }`}>
            {activeFarmingMode === "hydroponics" ? <FlaskConical className="w-3.5 h-3.5" /> : <Sprout className="w-3.5 h-3.5" />}
            <span>{activeFarmingMode === "hydroponics" ? "HYDROPONICS" : "SOIL FARMING"}</span>
          </span>

          {/* Connection Status Badge */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: currentStatus === "online" 
                ? "rgba(16, 185, 129, 0.1)" 
                : currentStatus === "simulated" 
                ? "rgba(99, 102, 241, 0.1)" 
                : "rgba(245, 158, 11, 0.1)",
              borderColor: currentStatus === "online" 
                ? "rgba(16, 185, 129, 0.3)" 
                : currentStatus === "simulated" 
                ? "rgba(99, 102, 241, 0.3)" 
                : "rgba(245, 158, 11, 0.3)",
              color: currentStatus === "online" 
                ? "#059669" 
                : currentStatus === "simulated" 
                ? "#4f46e5" 
                : "#d97706"
            }}
          >
            {currentStatus === "online" && <Wifi className="w-3.5 h-3.5 animate-pulse text-emerald-600" />}
            {currentStatus === "simulated" && <Activity className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
            {currentStatus === "offline" && <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
            <span className="capitalize font-semibold">
              {currentStatus === "online" ? "ESP32 Live Online" : currentStatus === "simulated" ? "Simulated Stream" : "Offline / Stale"}
            </span>
          </div>


        </div>
      </div>

      {/* Device Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {defaultDevices.map((dev) => {
          const matchedDoc = devices.find(d => d.deviceId === dev.id);
          const devStatus = deriveDeviceStatus(matchedDoc || null);
          const isSelected = selectedDeviceId === dev.id;

          return (
            <button
              key={dev.id}
              onClick={() => {
                setSelectedDeviceId(dev.id);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                isSelected
                  ? dev.mode === "hydroponics"
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {dev.mode === "hydroponics" ? <FlaskConical className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
              <span>{dev.label}</span>
              <span className={`w-2 h-2 rounded-full ${
                devStatus === "online" ? "bg-emerald-400" : devStatus === "simulated" ? "bg-indigo-400" : "bg-amber-400"
              }`} />
            </button>
          );
        })}
      </div>

      {/* Sensor Metric Cards Grid */}
      {activeFarmingMode === "hydroponics" ? (
        /* HYDROPONICS METRICS GRID */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {/* Water Reservoir Level */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Water Level</span>
              <Waves className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTelemetry?.waterLevel !== undefined ? `${activeTelemetry.waterLevel}%` : "--"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                waterLevelStatus === "low" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                waterLevelStatus === "optimal" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              }`}>
                {waterLevelStatus}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-cyan-500 h-full transition-all duration-500"
                style={{ width: `${activeTelemetry?.waterLevel ?? 0}%` }}
              />
            </div>
          </div>

          {/* pH Level */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>pH Level</span>
              <FlaskConical className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTelemetry?.ph !== undefined ? activeTelemetry.ph : "--"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                phStatus === "low" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                phStatus === "optimal" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}>
                {phStatus}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Optimal range: 5.5 - 6.8</p>
          </div>

          {/* EC / TDS */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>EC / TDS</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTelemetry?.ec !== undefined ? `${activeTelemetry.ec}` : "--"}
              </span>
              <span className="text-xs text-gray-500">mS/cm</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 font-mono">
              TDS: {activeTelemetry?.tds !== undefined ? `${activeTelemetry.tds} ppm` : "--"}
            </p>
          </div>

          {/* Water Temperature */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Water Temp</span>
              <Thermometer className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry?.waterTemperature !== undefined ? `${activeTelemetry.waterTemperature}°C` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Optimal range: 18 - 24°C</p>
          </div>

          {/* Air Temperature */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Air Temp</span>
              <Thermometer className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.temperature}°C` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-mono">Ambient</p>
          </div>

          {/* Air Humidity */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Air Humidity</span>
              <Wind className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.humidity}%` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Relative</p>
          </div>

          {/* Light Lux */}
          <div className="bg-cyan-50/50 dark:bg-cyan-950/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/40">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Sunlight</span>
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.lightLux} lux` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">PAR Sensor</p>
          </div>
        </div>
      ) : (
        /* SOIL FARMING METRICS GRID */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Soil Moisture */}
          <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Soil Moisture</span>
              <Droplets className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTelemetry?.soilMoisture !== undefined ? `${activeTelemetry.soilMoisture}%` : "--"}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                moistureStatus === "dry" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                moistureStatus === "optimal" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              }`}>
                {moistureStatus}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  moistureStatus === "dry" ? "bg-amber-500" : moistureStatus === "optimal" ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${activeTelemetry?.soilMoisture ?? 0}%` }}
              />
            </div>
          </div>

          {/* Water Tank Level */}
          <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Water Tank</span>
              <Gauge className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry?.waterTankLevel !== undefined ? `${activeTelemetry.waterTankLevel}%` : "--"}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${activeTelemetry?.waterTankLevel ?? 0}%` }}
              />
            </div>
          </div>

          {/* Air Temperature */}
          <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Temperature</span>
              <Thermometer className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.temperature}°C` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Optimal range: 20-32°C</p>
          </div>

          {/* Air Humidity */}
          <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Air Humidity</span>
              <Wind className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.humidity}%` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Relative Humidity</p>
          </div>

          {/* Sunlight Lux */}
          <div className="bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Sunlight</span>
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {activeTelemetry ? `${activeTelemetry.lightLux} lux` : "--"}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Ambient LDR Sensor</p>
          </div>
        </div>
      )}

      {/* Timestamp Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-1">
        <span>Active Node ID: <strong className="font-mono text-gray-600 dark:text-gray-300">{selectedDeviceId}</strong></span>
        <span>
          Last Telemetry: {activeTelemetry?.updatedAtFormatted || activeTelemetry?.timestamp || "No telemetry received yet"}
        </span>
      </div>


    </div>
  );
}
