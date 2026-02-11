import { useState, useEffect, useCallback } from "react";
import { GlobeCanvas } from "@/components/sentrix/GlobeCanvas";
import { IntroOverlay } from "@/components/sentrix/IntroOverlay";
import { IntelligencePanel } from "@/components/sentrix/IntelligencePanel";
import { HudOverlay } from "@/components/sentrix/HudOverlay";
import { FeatureSections } from "@/components/sentrix/FeatureSections";
import { CyberAttack, createLiveAttack } from "@/data/attackData";
import { Switch } from "@/components/ui/switch"; // Ensure you have this, or remove if using raw HTML

const MAX_ATTACKS = 20;

const Index = () => {
  const [introComplete, setIntroComplete] = useState(false);
  const [attacks, setAttacks] = useState<CyberAttack[]>([]);
  const [selectedAttack, setSelectedAttack] = useState<CyberAttack | null>(
    null,
  );
  const [lastTimestamp, setLastTimestamp] = useState<string>("");

  // NEW: Toggle state for auto-opening the panel
  const [autoPopup, setAutoPopup] = useState(true);

  /* -------------------------------
     REAL-TIME POLLING ENGINE
  --------------------------------*/
  useEffect(() => {
    if (!introComplete) return;

    const checkForAttack = async () => {
      try {
        const res = await fetch("http://localhost:5050/api/status");
        const data = await res.json();

        if (data.status === "ATTACK") {
          // Prevent duplicates
          if (data.timestamp === lastTimestamp) return;

          setLastTimestamp(data.timestamp);

          console.log("🚨 ATTACK CONFIRMED! Creating Object...");
          const newAttack = createLiveAttack(data);

          setAttacks((prev) => {
            const updated = [...prev, newAttack];
            return updated.length > MAX_ATTACKS
              ? updated.slice(-MAX_ATTACKS)
              : updated;
          });

          // --- CONDITIONAL POPUP LOGIC ---
          // Only open the panel if Auto-Popup is enabled
          if (autoPopup) {
            setSelectedAttack(newAttack);
          }
        }
      } catch (err) {
        console.error("❌ POLLING ERROR:", err);
      }
    };

    const interval = setInterval(checkForAttack, 500);
    return () => clearInterval(interval);
  }, [introComplete, lastTimestamp, autoPopup]); // Added autoPopup to dependencies

  /* -------------------------------
     HANDLERS
  --------------------------------*/
  const handleAttackClick = useCallback((attack: CyberAttack) => {
    setSelectedAttack(attack);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAttack(null);
  }, []);

  const handleManualTest = () => {
    const fakeData = {
      status: "ATTACK",
      type: "TEST FLOOD",
      source: "1.2.3.4",
      confidence: "99",
      timestamp: Date.now(),
    };
    const attack = createLiveAttack(fakeData);
    setAttacks((prev) => [...prev, attack]);

    // Respect the toggle even for manual tests
    if (autoPopup) {
      setSelectedAttack(attack);
    }
  };

  /* -------------------------------
     UI RENDER
  --------------------------------*/
  return (
    <div className="bg-background text-foreground relative">
      <IntroOverlay onComplete={() => setIntroComplete(true)} />

      <section className="h-screen w-full relative overflow-hidden">
        <GlobeCanvas
          attacks={attacks}
          onAttackClick={handleAttackClick}
          selectedAttackId={selectedAttack?.id ?? null}
          visible={introComplete}
        />

        {/* CONTROLS OVERLAY */}
        {introComplete && (
          <div className="absolute top-6 right-6 z-50 flex flex-col gap-3 items-end">
            {/* 1. STATUS INDICATOR */}
            <div className="flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-red-500/30 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 tracking-wider">
                LIVE NIDS CONNECTED
              </span>
            </div>

            {/* 2. DASHBOARD / ALERT TOGGLE */}
            <div
              className="flex items-center gap-3 bg-black/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md cursor-pointer hover:bg-black/80 transition-all"
              onClick={() => setAutoPopup(!autoPopup)}
            >
              <span
                className={`text-xs font-bold transition-colors ${!autoPopup ? "text-blue-400" : "text-gray-500"}`}
              >
                📊 DASHBOARD
              </span>

              {/* Custom Toggle Switch UI (No dependencies needed) */}
              <div
                className={`w-8 h-4 rounded-full p-0.5 transition-colors ${autoPopup ? "bg-red-600" : "bg-blue-600"}`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${autoPopup ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>

              <span
                className={`text-xs font-bold transition-colors ${autoPopup ? "text-red-400" : "text-gray-500"}`}
              >
                🔔 ALERTS
              </span>
            </div>

            {/* 3. TEST BUTTON */}
            <button
              onClick={handleManualTest}
              className="text-xs bg-white/5 hover:bg-white/10 text-white/70 px-3 py-1 rounded border border-white/10 transition-all"
            >
              Test Attack
            </button>
          </div>
        )}

        <HudOverlay visible={introComplete} attackCount={attacks.length} />

        <IntelligencePanel attack={selectedAttack} onClose={handleClosePanel} />
      </section>

      <FeatureSections />
    </div>
  );
};

export default Index;
