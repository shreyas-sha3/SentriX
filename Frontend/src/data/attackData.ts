export type ThreatLevel = "Low" | "Medium" | "High" | "Critical";
export type AttackType =
  | "DDoS"
  | "Malware"
  | "Phishing"
  | "Ransomware"
  | "Data Breach"
  | "Volumetric Flood"
  | "Brute Force";
export type AttackStatus = "Active" | "Detected" | "Mitigated";

export interface CyberAttack {
  id: string;
  source: string;
  sourceCoords: { lat: number; lon: number };
  target: string;
  targetCoords: { lat: number; lon: number };
  attackType: AttackType;
  threatLevel: ThreatLevel;
  timestamp: string;
  status: AttackStatus;
  confidence?: number;
}

// --- ADAPTER: Converts Python API data to Frontend format ---
export function createLiveAttack(apiData: any): CyberAttack {
  const now = new Date();

  // Map Python confidence (e.g. "95%") to Threat Level
  const conf = parseInt(apiData.confidence) || 0;
  let level: ThreatLevel = "Low";
  if (conf > 50) level = "Medium";
  if (conf > 80) level = "High";
  if (conf > 90) level = "Critical";

  // Map Python attack types to TS types
  let type: AttackType = "DDoS";
  const rawType = (apiData.type || "").toUpperCase();
  if (rawType.includes("FLOOD")) type = "Volumetric Flood";
  if (rawType.includes("BRUTE")) type = "Brute Force";
  if (rawType.includes("SCAN")) type = "Data Breach"; // Mapping scans to breach attempts

  return {
    id: `LIVE-${Date.now()}`,
    source: apiData.source === "Unknown" ? "External Threat" : apiData.source,
    // Since we don't have GeoIP, we randomize the SOURCE location on the globe
    sourceCoords: {
      lat: Math.random() * 160 - 80,
      lon: Math.random() * 360 - 180,
    },
    target: "SENTRIX SYSTEM",
    targetCoords: { lat: 12.9716, lon: 77.5946 }, // Your Location (e.g. Bangalore)
    attackType: type,
    threatLevel: level,
    timestamp: now.toISOString(),
    status: "Active",
    confidence: conf,
  };
}

export function getThreatColorHex(level: ThreatLevel): number {
  switch (level) {
    case "Low":
      return 0xffaa00;
    case "Medium":
      return 0xff4444;
    case "High":
      return 0xff0044;
    case "Critical":
      return 0xff0022;
  }
}

export function getThreatColor(level: ThreatLevel): string {
  switch (level) {
    case "Low":
      return "#ffaa00";
    case "Medium":
      return "#ff4444";
    case "High":
      return "#ff0044";
    case "Critical":
      return "#ff0022";
  }
}

export const GLOBE_RADIUS = 2;

export function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}
