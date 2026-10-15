"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/common/LanguageContext";
import { Droplets, Activity, ThermometerSun, Zap, Waves, FlaskConical } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { iotService } from "@/services/iotService";
import { IotTelemetryData, deriveDeviceStatus, derivePhStatus, deriveEcStatus, deriveWaterLevelStatus } from "@/types/iot";

export default function HydroponicsPage() {
  const { t } = useLanguage();
  const [telemetry, setTelemetry] = useState<IotTelemetryData | null>(null);

  useEffect(() => {
    // Subscribe to live Hydroponics telemetry device hydro_zone_01
    const unsubscribe = iotService.subscribeToTelemetry("hydro_zone_01", (data) => {
      if (data) {
        setTelemetry(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const deviceStatus = deriveDeviceStatus(telemetry);
  const phVal = telemetry?.ph !== undefined ? telemetry.ph : 6.2;
  const phStatus = telemetry?.phStatus || derivePhStatus(phVal);

  const waterLevelVal = telemetry?.waterLevel !== undefined ? `${telemetry.waterLevel}%` : "78%";
  const ecVal = telemetry?.ec !== undefined ? `${telemetry.ec} mS/cm` : "1.4 mS/cm";
  const waterTempVal = telemetry?.waterTemperature !== undefined ? `${telemetry.waterTemperature}°C` : "23.5°C";

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
            <span className="p-2 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 rounded-2xl">
              <FlaskConical size={32} />
            </span>
            {t("hydroponics")} Smart Monitoring
          </h1>
        </div>

        {/* Live Hydroponics Connection Badge */}
        <div className="flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold border shadow-sm"
          style={{
            backgroundColor: deviceStatus === "online" 
              ? "rgba(16, 185, 129, 0.1)" 
              : deviceStatus === "simulated" 
              ? "rgba(99, 102, 241, 0.1)" 
              : "rgba(245, 158, 11, 0.1)",
            borderColor: deviceStatus === "online" 
              ? "rgba(16, 185, 129, 0.3)" 
              : deviceStatus === "simulated" 
              ? "rgba(99, 102, 241, 0.3)" 
              : "rgba(245, 158, 11, 0.3)",
            color: deviceStatus === "online" 
              ? "#059669" 
              : deviceStatus === "simulated" 
              ? "#4f46e5" 
              : "#d97706"
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full animate-ping"
            style={{
              backgroundColor: deviceStatus === "online" ? "#10b981" : deviceStatus === "simulated" ? "#6366f1" : "#f59e0b"
            }}
          />
          <span className="capitalize">
            {deviceStatus === "online" ? "Hydroponics Node Online" : deviceStatus === "simulated" ? "Simulated Stream Active" : "Sensor Offline"}
          </span>
        </div>
      </div>

      {/* Live Real-Time StatCards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="pH Level"
          value={`${phVal} (${phStatus.toUpperCase()})`}
          icon={Activity}
        />
        <StatCard
          title="Reservoir Water Level"
          value={waterLevelVal}
          icon={Waves}
        />
        <StatCard
          title="Nutrient EC / TDS"
          value={ecVal}
          icon={Zap}
        />
        <StatCard
          title="Nutrient Solution Temp"
          value={waterTempVal}
          icon={ThermometerSun}
        />
      </div>

      {/* Hydroponic Parameter Optimal Reference Guide Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
            <Droplets size={22} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Hydroponics Target Operating Ranges
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Optimal pH Range</span>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">5.5 – 6.5 pH</span>
          </div>

          <div className="p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Target EC Concentration</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">1.2 – 2.0 mS/cm</span>
          </div>

          <div className="p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Water Temperature</span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">18 – 24°C</span>
          </div>

          <div className="p-3.5 bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">Minimum Water Level</span>
            <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">&gt; 35%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
