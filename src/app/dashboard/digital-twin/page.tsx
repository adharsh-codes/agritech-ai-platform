"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useLanguage } from "@/components/common/LanguageContext";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { DigitalTwinService } from "@/services/digitalTwinService";
import { TwinModel } from "@/types/digitalTwin";
import TwinRenderer from "@/components/twin/TwinRenderer";
import TwinSidebar from "@/components/twin/TwinSidebar";
import TwinLegend from "@/components/twin/TwinLegend";
import TwinZoneCard from "@/components/twin/TwinZoneCard";
import { TwinProvider, useTwinState } from "@/components/twin/TwinStateManager";
import { TwinIntelligenceService } from "@/services/twinIntelligenceService";
import TwinIntelligenceDashboard from "@/components/twin/TwinIntelligenceDashboard";
import TwinPredictiveDashboard from "@/components/twin/TwinPredictiveDashboard";
import TwinLifecycleDashboard from "@/components/twin/TwinLifecycleDashboard";
import TwinAgentManager from "@/components/twin/TwinAgentManager";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Layers, 
  Sparkles, 
  Calendar, 
  Compass, 
  Search, 
  Grid, 
  TrendingUp, 
  MapPin, 
  TrendingDown, 
  BrainCircuit, 
  LayoutGrid,
  LineChart,
  Clock,
  Bot
} from "lucide-react";

export default function DigitalTwinPage() {
  const [initialTwin, setInitialTwin] = useState<TwinModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        await loadLatestTwin(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadLatestTwin = async (userId: string) => {
    setLoading(true);
    try {
      const data = await DigitalTwinService.getLatestTwin(userId);
      if (data && (!data.intelligence || !data.intelligence.healthScore)) {
        // Auto-analyze and save to Firestore
        const intel = TwinIntelligenceService.analyzeTwin(data);
        data.intelligence = intel;
        if (data.id) {
          await TwinIntelligenceService.saveIntelligence(data.id, intel);
        }
      }
      setInitialTwin(data);
    } catch (err) {
      console.error("Failed to load digital twin data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="max-w-6xl mx-auto py-20 px-6 text-center text-gray-400 space-y-4">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-base font-semibold">Loading Twin</p>
        </main>
      </ProtectedRoute>
    );
  }

  if (!initialTwin) {
    return (
      <ProtectedRoute>
        <main className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-200">
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-gray-150 p-12 text-center text-gray-450 space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-green-50 text-green-700 rounded-full flex items-center justify-center mx-auto">
              <Layers size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-xl text-gray-800">No Digital Twin Generated</h3>
            </div>
            <Link href="/dashboard/terrace-planner" className="inline-block">
              <Button className="bg-green-700 hover:bg-green-800 text-white rounded-xl font-bold px-8 py-4 cursor-pointer">
                Run Terrace Analysis
              </Button>
            </Link>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <TwinProvider initialTwin={initialTwin}>
        <DigitalTwinPageContent uid={uid} onRefresh={() => uid && loadLatestTwin(uid)} />
      </TwinProvider>
    </ProtectedRoute>
  );
}

interface DigitalTwinPageContentProps {
  uid: string | null;
  onRefresh: () => void;
}

function DigitalTwinPageContent({ uid, onRefresh }: DigitalTwinPageContentProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"layout" | "intelligence" | "predictive" | "lifecycle" | "agentic">("layout");
  
  const { 
    twin, 
    activeZoneId, 
    setActiveZoneId, 
    searchQuery, 
    setSearchQuery, 
    filteredZones 
  } = useTwinState();

  if (!twin) return null;

  // In-Memory Metric Calculations (Feature 6: Terrace Summary)
  const totalArea = twin.zones.reduce((sum, z) => sum + (z.area || 0), 0);
  
  const usableArea = twin.zones
    .filter(z => ["crop", "hydroponics", "grow_bags"].includes(z.zoneType))
    .reduce((sum, z) => sum + (z.area || 0), 0);

  const cropCount = twin.zones
    .filter(z => ["crop", "hydroponics", "grow_bags"].includes(z.zoneType) && z.currentCrop && z.currentCrop !== "None" && z.currentCrop !== "")
    .length;

  const growBagsCount = twin.zones.filter(z => z.zoneType === "grow_bags").length;
  const hydroponicsCount = twin.zones.filter(z => z.zoneType === "hydroponics").length;
  const waterSourcesCount = twin.zones.filter(z => z.zoneType === "water_tank").length;

  return (
    <main className="max-w-6xl mx-auto py-10 px-6 space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="text-green-700 animate-pulse" size={32} />
            <span>{t("digitalTwin") || "AI Digital Twin"}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            className="rounded-xl font-bold flex items-center gap-1.5 text-xs border-gray-250 cursor-pointer"
          >
            <Compass size={14} className="text-green-700" />
            <span>Re-align Twin</span>
          </Button>
        </div>
      </div>

      {/* Tabs switcher (SP6.2 / SP6.3 / SP6.4 / SP7.0) */}
      <div className="flex border-b border-gray-100 pb-px shrink-0 select-none overflow-x-auto">
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "layout"
              ? "border-green-700 text-green-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <LayoutGrid size={16} />
          <span>Terrace Layout</span>
        </button>
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "intelligence"
              ? "border-green-700 text-green-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <BrainCircuit size={16} />
          <span>AI Decision Support & Simulator</span>
        </button>
        <button
          onClick={() => setActiveTab("predictive")}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "predictive"
              ? "border-green-700 text-green-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <LineChart size={16} />
          <span>Predictive Planning</span>
        </button>
        <button
          onClick={() => setActiveTab("lifecycle")}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "lifecycle"
              ? "border-green-700 text-green-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Clock size={16} />
          <span>History & Lifecycle</span>
        </button>
        <button
          onClick={() => setActiveTab("agentic")}
          className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "agentic"
              ? "border-green-700 text-green-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Bot size={16} />
          <span>Agentic AI Manager</span>
        </button>
      </div>

      {activeTab === "layout" ? (
        <>
          {/* Summary Metrics (Feature 6: Terrace Summary) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            
            {/* Metric: Total Area */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryTotalArea") || "Total Area"}</span>
              <span className="text-base font-black text-gray-800 block">{totalArea} sq. ft</span>
            </div>

            {/* Metric: Usable Area */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryUsableArea") || "Usable Area"}</span>
              <span className="text-base font-black text-green-700 block">{usableArea} sq. ft</span>
            </div>

            {/* Metric: Crop Count */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryCropCount") || "Crop Count"}</span>
              <span className="text-base font-black text-gray-800 block">{cropCount} Plants</span>
            </div>

            {/* Metric: Grow Bags */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryGrowBags") || "Grow Bags"}</span>
              <span className="text-base font-black text-gray-800 block">{growBagsCount} Zones</span>
            </div>

            {/* Metric: Hydroponics */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryHydroponics") || "Hydroponics"}</span>
              <span className="text-base font-black text-blue-600 block">{hydroponicsCount} Units</span>
            </div>

            {/* Metric: Water Sources */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block">{t("summaryWaterSources") || "Water Sources"}</span>
              <span className="text-base font-black text-sky-600 block">{waterSourcesCount} Sources</span>
            </div>

            {/* Metric: AI Confidence */}
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-center space-y-1 col-span-2 lg:col-span-1">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase block truncate">{t("summaryConfidence") || "Confidence"}</span>
              <span className="text-base font-black text-amber-600 block">{twin.confidence}%</span>
            </div>

          </div>

          {/* Main Interactive Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Columns: Visual Layout and Zone Search */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Search bar & list wrapper */}
              <div className="bg-white border border-gray-150 p-5 rounded-3xl shadow-xs space-y-4">
                
                {/* Search Input Bar (Feature 7) */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchZonesPlaceholder") || "Search by zone name, crop or type..."}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold focus:outline-none focus:border-green-500 placeholder:text-gray-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* In-memory filtered list description */}
                {searchQuery && (
                  <p className="text-xs text-gray-450 font-bold">
                    Found {filteredZones.length} matching zones for "{searchQuery}"
                  </p>
                )}

              </div>

              {/* 2D SVG Blueprint */}
              <div className="space-y-3">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5 px-1">
                  <Grid size={18} className="text-green-700" />
                  <span>Interactive 2D Blueprint Layout</span>
                </h3>
                <TwinRenderer />
              </div>

              {/* Reusable TwinZoneCard list (Feature 9) */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-800 text-sm px-1">
                  {searchQuery ? "Matching Mapped Zones" : "All Mapped Zones"}
                </h4>
                
                {filteredZones.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed rounded-2xl text-gray-400 font-semibold text-xs">
                    No matching zones found. Try searching for a different term.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {filteredZones.map((zone) => (
                      <TwinZoneCard
                        key={zone.zoneId}
                        zone={zone}
                        isActive={activeZoneId === zone.zoneId}
                        onSelect={() => setActiveZoneId(zone.zoneId)}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Zone Diagnostics Sidebar Panel (Feature 2 & 4) */}
            <div>
              <TwinSidebar />
            </div>

          </div>

          {/* Map Legends (Feature 5) */}
          <TwinLegend />
        </>
      ) : activeTab === "intelligence" ? (
        <TwinIntelligenceDashboard />
      ) : activeTab === "predictive" ? (
        <TwinPredictiveDashboard />
      ) : activeTab === "lifecycle" ? (
        <TwinLifecycleDashboard />
      ) : (
        <TwinAgentManager />
      )}

    </main>
  );
}
