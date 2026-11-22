"use client";

import { useMemo } from "react";
import {
  Thermometer,
  Gauge,
  Activity,
  Flame,
  Wind,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import type { Station } from "@/lib/stations";

interface SensorDetail {
  id: string;
  name: string;
  unit: string;
  nominal: number;
  deltaMax: number; // max deviation at 100% degradation
  direction: "up" | "down";
  desc: string;
}

interface StationPhysics {
  id: Station;
  code: string;
  title: string;
  role: string;
  failureMode: string;
  physicsExplanation: string;
  ammTask: string;
  sensors: SensorDetail[];
}

const STATION_PHYSICS_DATA: Record<Station, StationPhysics> = {
  hpt: {
    id: "hpt",
    code: "Station 4.8",
    title: "High-Pressure Turbine (HPT)",
    role: "Extracts high-enthalpy gas energy immediately downstream of the combustor to drive the High-Pressure Compressor (HPC) shaft.",
    failureMode: "Thermal creep, nozzle guide vane (NGV) oxidation, thermal barrier coating (TBC) spallation.",
    physicsExplanation:
      "As blade trailing edges erode and throat area widens, expansion efficiency drops. The FADEC increases fuel flow to maintain core shaft speed, driving inter-turbine temperature (T48) significantly above normal operating regimes.",
    ammTask: "AMM 72-41-00: Boroscope Inspection of HPT Stage 1 Nozzle Guide Vanes & Rotor Blades.",
    sensors: [
      {
        id: "T48",
        name: "Inter-Turbine Total Temperature",
        unit: "°R",
        nominal: 1842,
        deltaMax: 68,
        direction: "up",
        desc: "Primary indicator of turbine thermal distress and thermal creep acceleration.",
      },
      {
        id: "P40",
        name: "Combustor Exit / HPT Inlet Pressure",
        unit: "psia",
        nominal: 538.5,
        deltaMax: -24.2,
        direction: "down",
        desc: "Measures expansion ratio across Stage 1 nozzle guide vanes.",
      },
    ],
  },
  hpc: {
    id: "hpc",
    code: "Station 3.0",
    title: "High-Pressure Compressor (HPC)",
    role: "Provides high-pressure adiabatic compression (~28:1 overall pressure ratio) delivering dense core airflow to the combustor.",
    failureMode: "Aerodynamic blade fouling, tip clearance opening, blade erosion.",
    physicsExplanation:
      "Compressor blade boundary layer separation reduces polytropic efficiency. To maintain pressure ratio, the core spool speed (Nc) must elevate, shifting compressor discharge temperature (T30) higher while static pressure (Ps30) shows localized drop.",
    ammTask: "AMM 72-31-00: Compressor Gas-Path Wash & Boroscope Tip Clearance Verification.",
    sensors: [
      {
        id: "Ps30",
        name: "Compressor Discharge Static Pressure",
        unit: "psia",
        nominal: 554.2,
        deltaMax: -38.6,
        direction: "down",
        desc: "Direct measure of pressure compression efficiency into the burner.",
      },
      {
        id: "T30",
        name: "HPC Exit Total Temperature",
        unit: "°R",
        nominal: 1584,
        deltaMax: 46,
        direction: "up",
        desc: "Elevates as mechanical work converts into excess parasitic aerodynamic heat.",
      },
      {
        id: "Nc",
        name: "Core High-Pressure Spool Speed",
        unit: "rpm",
        nominal: 9062,
        deltaMax: 145,
        direction: "up",
        desc: "Core shaft rotational speed monitored by magnetic reluctance pick-offs.",
      },
    ],
  },
  lpt: {
    id: "lpt",
    code: "Station 5.0",
    title: "Low-Pressure Turbine (LPT)",
    role: "Multi-stage low-speed turbine extracting residual thermal enthalpy to drive the massive front bypass fan and LPC booster.",
    failureMode: "Blade tip shroud seal wear, uncontained gas leakage, aerodynamic rubbing.",
    physicsExplanation:
      "Degraded LPT stage efficiency prevents complete expansion, elevating exhaust gas temperature (T50) while reducing low-pressure shaft mechanical torque delivered to the front fan.",
    ammTask: "AMM 72-51-00: Low Pressure Turbine Case Boroscopy & Exhaust Nozzle Telemetry Calibration.",
    sensors: [
      {
        id: "T50",
        name: "LPT Exhaust Gas Temperature (EGT)",
        unit: "°R",
        nominal: 1324,
        deltaMax: 54,
        direction: "up",
        desc: "Critical flight line EGT margin indicator for engine overhaul scheduling.",
      },
      {
        id: "P50",
        name: "LPT Exhaust Total Pressure",
        unit: "psia",
        nominal: 14.85,
        deltaMax: -1.45,
        direction: "down",
        desc: "Core exhaust expansion pressure prior to propelling nozzle exit.",
      },
    ],
  },
  fan: {
    id: "fan",
    code: "Station 1.0 - 2.1",
    title: "Front Bypass Fan & Casing",
    role: "Large single-stage titanium-alloy fan delivering ~80% of total cruise propulsive thrust via cold bypass duct airflow.",
    failureMode: "Foreign object damage (FOD), leading edge pitting, acoustic liner vibration.",
    physicsExplanation:
      "Disturbed intake airflow or fan blade untwist degrades bypass pressure ratio (P21/P2) and induces low-pressure spool rotational harmonics, triggering sensor anomalies on bypass pressure transducers.",
    ammTask: "AMM 72-21-00: Fan Blade Visual Inspection, Acoustic Shroud & Leading Edge Blend.",
    sensors: [
      {
        id: "Nf",
        name: "Fan Low-Pressure Spool Speed",
        unit: "rpm",
        nominal: 2388,
        deltaMax: -52,
        direction: "down",
        desc: "Direct low-pressure shaft tachometer readout.",
      },
      {
        id: "P21",
        name: "Fan Duct Total Discharge Pressure",
        unit: "psia",
        nominal: 21.65,
        deltaMax: -2.1,
        direction: "down",
        desc: "Measures bypass stream cold thrust generation capacity.",
      },
      {
        id: "P15",
        name: "Bypass Annulus Static Pressure",
        unit: "psia",
        nominal: 16.2,
        deltaMax: -1.2,
        direction: "down",
        desc: "Monitors duct boundary layer and acoustic liner flow resistance.",
      },
    ],
  },
  lpc: {
    id: "lpc",
    code: "Station 2.4",
    title: "Low-Pressure Compressor (Booster)",
    role: "Intermediate multi-stage booster compressor supercharging core air before entry into the high-pressure spool.",
    failureMode: "Core air ingestion erosion, stator vane misalignment, booster seal leakage.",
    physicsExplanation:
      "Booster stage leakage shifts the LPC working line closer to the surge boundary, elevating stage discharge temperature (T24) while lowering inter-compressor matching pressure (P24).",
    ammTask: "AMM 72-30-00: LPC Variable Bleed Valve (VBV) Schedule Verification & Boroscope.",
    sensors: [
      {
        id: "T24",
        name: "LPC Booster Exit Temperature",
        unit: "°R",
        nominal: 642,
        deltaMax: 24,
        direction: "up",
        desc: "Intermediate core temperature before high-pressure compression.",
      },
      {
        id: "P24",
        name: "LPC Booster Exit Pressure",
        unit: "psia",
        nominal: 23.4,
        deltaMax: -1.8,
        direction: "down",
        desc: "Core intake pressure feed into the HPC inlet guide vanes.",
      },
    ],
  },
  combustor: {
    id: "combustor",
    code: "Station 4.0",
    title: "Annular Combustor / Burner",
    role: "Atomizes Jet-A fuel with compressed core air, generating peak combustion gas enthalpy at stoichiometric temperatures.",
    failureMode: "Fuel nozzle carbon coking, liner thermal crack, circumferential temperature distortion.",
    physicsExplanation:
      "Coked fuel spray nozzles distort the circumferential burner profile. The engine control system (FADEC) compensates with higher total fuel flow (Wf) to meet thrust demand, accelerating downstream turbine damage.",
    ammTask: "AMM 73-11-00: Fuel Spray Nozzle Flow Calibration & Combustor Liner Boroscopy.",
    sensors: [
      {
        id: "Wf",
        name: "Fuel Mass Flow Rate",
        unit: "lbm/s",
        nominal: 3.92,
        deltaMax: 0.45,
        direction: "up",
        desc: "Mass flow meter readout from the hydromechanical fuel metering unit (HMU).",
      },
    ],
  },
  nozzle: {
    id: "nozzle",
    code: "Station 8.0",
    title: "Exhaust Propelling Nozzle",
    role: "Accelerates core and bypass exhaust gases to ambient atmosphere to maximize momentum thrust.",
    failureMode: "Thermal acoustic fatigue, mixer petal cracking, boundary layer stagnation.",
    physicsExplanation:
      "Exhaust nozzle throat area governs downstream backpressure on the low-pressure turbine and bypass fan.",
    ammTask: "AMM 78-11-00: Exhaust Nozzle Fairing & Acoustic Petal Structural Inspection.",
    sensors: [],
  },
};

interface Props {
  selectedStation: Station | null;
  onSelectStation: (s: Station) => void;
  riskScore: number; // 0..1
  degradationLevel: number; // 0..1
}

export default function StationTelemetryInspector({
  selectedStation,
  onSelectStation,
  riskScore,
  degradationLevel,
}: Props) {
  const stationId = selectedStation ?? "hpt";
  const data = STATION_PHYSICS_DATA[stationId] ?? STATION_PHYSICS_DATA.hpt;

  // Compute live sensor telemetry values based on degradation level
  const sensorReadouts = useMemo(() => {
    return data.sensors.map((s) => {
      const delta = (s.direction === "up" ? 1 : -1) * (s.deltaMax * degradationLevel);
      const current = s.nominal + delta;
      const pctDelta = ((delta / s.nominal) * 100).toFixed(2);
      const isSevere = Math.abs(delta / s.nominal) > 0.035;
      const isModerate = Math.abs(delta / s.nominal) > 0.015;

      return {
        ...s,
        current: current.toFixed(s.nominal < 50 ? 2 : 1),
        deltaStr: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`,
        pctDelta: `${delta >= 0 ? "+" : ""}${pctDelta}%`,
        status: isSevere ? "CRITICAL" : isModerate ? "ELEVATED" : "NOMINAL",
      };
    });
  }, [data, degradationLevel]);

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card space-y-5">
      {/* Station Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
              {data.code}
            </span>
            <h3 className="text-base font-bold tracking-tight text-fg">{data.title}</h3>
          </div>
          <p className="text-xs text-fg-3 mt-1">{data.role}</p>
        </div>

        {/* Quick Station Switcher Tabs */}
        <div className="flex flex-wrap gap-1" role="group" aria-label="Select engine station">
          {(["fan", "lpc", "hpc", "combustor", "hpt", "lpt"] as Station[]).map((s) => (
            <button
              key={s}
              onClick={() => onSelectStation(s)}
              className={`rounded-chip border px-2.5 py-1 text-xs font-medium uppercase tracking-wider transition-all ${
                stationId === s
                  ? "border-brand-graphic bg-brand/15 text-brand shadow-sm font-semibold"
                  : "border-line bg-surface text-fg-2 hover:bg-elevated hover:text-fg"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor Readouts Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
            <Activity className="h-4 w-4 text-brand" />
            <span>Thermodynamic Gas-Path Sensor Channels</span>
          </div>
          <span className="text-[11px] font-mono text-fg-3">
            Simulated at {Math.round(degradationLevel * 100)}% Degradation
          </span>
        </div>

        {sensorReadouts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sensorReadouts.map((sensor) => (
              <div
                key={sensor.id}
                className={`rounded-control border p-3 transition-colors ${
                  sensor.status === "CRITICAL"
                    ? "border-crit/40 bg-crit-fill/5"
                    : sensor.status === "ELEVATED"
                    ? "border-warn/40 bg-warn-fill/5"
                    : "border-line bg-elevated/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-fg flex items-center gap-1">
                    {sensor.unit === "°R" ? (
                      <Thermometer className="h-3.5 w-3.5 text-crit" />
                    ) : sensor.unit === "psia" ? (
                      <Gauge className="h-3.5 w-3.5 text-info" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-brand" />
                    )}
                    {sensor.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-mono font-semibold ${
                      sensor.status === "CRITICAL"
                        ? "bg-crit-fill/20 text-crit"
                        : sensor.status === "ELEVATED"
                        ? "bg-warn-fill/20 text-warn"
                        : "bg-ok-fill/15 text-ok"
                    }`}
                  >
                    {sensor.status}
                  </span>
                </div>

                <div className="text-[11px] text-fg-3 mt-1 truncate" title={sensor.name}>
                  {sensor.name}
                </div>

                <div className="mt-2 flex items-baseline justify-between border-t border-line/60 pt-2">
                  <div className="font-mono text-lg font-bold text-fg">
                    {sensor.current}{" "}
                    <span className="text-[11px] font-normal text-fg-3">{sensor.unit}</span>
                  </div>
                  <div
                    className={`flex items-center font-mono text-xs font-medium ${
                      sensor.direction === "up" ? "text-crit" : "text-warn"
                    }`}
                  >
                    {sensor.direction === "up" ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {sensor.pctDelta}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px] text-fg-3 font-mono">
                  <span>Nominal: {sensor.nominal} {sensor.unit}</span>
                  <span>Δ: {sensor.deltaStr}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-line bg-elevated/30 p-4 text-xs text-fg-3 text-center">
            No active sensor instruments installed directly at this exhaust station. Telemetry is governed by upstream LPT exit conditions.
          </div>
        )}
      </div>

      {/* Aerodynamic Physics & AMM Maintenance Mapping */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Thermodynamic Degradation Mechanics */}
        <div className="rounded-control border border-line bg-elevated/30 p-4 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <Flame className="h-4 w-4 text-brand" />
            <span>Thermodynamic Failure Mode & Physics</span>
          </div>
          <div className="space-y-1 text-fg-2 leading-relaxed">
            <p>
              <strong className="text-fg">Primary Degradation:</strong> {data.failureMode}
            </p>
            <p className="text-[11px] text-fg-3 pt-1 border-t border-line/50">
              {data.physicsExplanation}
            </p>
          </div>
        </div>

        {/* Mapped Airworthiness AMM Maintenance Procedure */}
        <div className="rounded-control border border-line bg-elevated/30 p-4 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-fg">
            <Wrench className="h-4 w-4 text-info" />
            <span>Aircraft Maintenance Manual (AMM) Action</span>
          </div>
          <div className="space-y-1 text-fg-2 leading-relaxed">
            <p>
              <strong className="text-fg">Mandated Task:</strong> {data.ammTask}
            </p>
            <p className="text-[11px] text-fg-3 pt-1 border-t border-line/50">
              Standard maintenance protocol prescribed by the Original Equipment Manufacturer (OEM) when multi-sensor threshold departures trigger Tier 1/2 PHM triage alerts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
