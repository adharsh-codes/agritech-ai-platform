"use client";

import {
  Leaf,
  Droplets,
  Thermometer,
  Brain,
} from "lucide-react";

import StatCard from "@/components/dashboard/StatCard";
import QuickActions from "@/components/dashboard/QuickActions";
import WeatherCard from "@/components/dashboard/WeatherCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import LiveCameraMonitoring from "@/components/dashboard/LiveCameraMonitoring";
import HardwareTelemetryPanel from "@/components/dashboard/HardwareTelemetryPanel";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { iotService } from "@/services/iotService";
import { IotTelemetryData } from "@/types/iot";

export default function Dashboard() {
  const [profile, setProfile] = useState<{ name: string } | null>(null);
  const [greeting, setGreeting] = useState("Welcome Back");
  const [telemetry, setTelemetry] = useState<IotTelemetryData | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists()) {
            setProfile({ name: docSnap.data().name || "Farmer" });
          } else {
            setProfile({ name: user.displayName || "Farmer" });
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    const unsubscribeIot = iotService.subscribeToTelemetry("esp32_zone_01", (data) => {
      setTelemetry(data);
    });

    const hours = new Date().getHours();
    if (hours < 12) {
      setGreeting("Good Morning");
    } else if (hours < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }

    return () => {
      unsubscribeAuth();
      unsubscribeIot();
    };
  }, []);

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-4xl font-bold">
          {greeting}, {profile?.name || "Farmer"} 🌱
        </h1>
        <p className="text-gray-500">
          Welcome back to your AI Farming Assistant.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Plants"
          value="48"
          icon={Leaf}
        />
        <StatCard
          title="Water Tank"
          value={telemetry ? `${telemetry.waterTankLevel}%` : "82%"}
          icon={Droplets}
        />
        <StatCard
          title="Temperature"
          value={telemetry ? `${telemetry.temperature}°C` : "29°C"}
          icon={Thermometer}
        />
        <StatCard
          title="AI Health"
          value="94%"
          icon={Brain}
        />
      </div>

      {/* Hardware Telemetry (ESP32 Data Pipeline) */}
      <HardwareTelemetryPanel />

      {/* Live Camera Monitoring Section */}
      <LiveCameraMonitoring />

      <QuickActions />

      <div className="grid lg:grid-cols-2 gap-6">
        <WeatherCard />
        <RecentActivity />
      </div>
    </div>
  );
}