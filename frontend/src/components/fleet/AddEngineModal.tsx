"use client";

import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Search,
  Check,
  Plane,
  Database,
  Cpu,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { getJSON, postJSON, faultLabel, type AvailableEngine } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEngineAdded: () => void;
  currentFleetUids: string[];
}

// Fallback curated dataset engines if backend list is empty or offline
const FALLBACK_AVAILABLE: AvailableEngine[] = [
  { uid: "DS01-005-d-u1", split: "dev", fault_class: "FAULT_HPT_THERMAL", is_virtual: false, cycles: 100, active: false },
  { uid: "DS01-005-d-u2", split: "dev", fault_class: "FAULT_HPT_THERMAL", is_virtual: false, cycles: 75, active: false },
  { uid: "DS01-005-d-u3", split: "dev", fault_class: "FAULT_HPT_THERMAL", is_virtual: false, cycles: 100, active: false },
  { uid: "DS02-006-d-u16", split: "dev", fault_class: "FAULT_LPT", is_virtual: false, cycles: 63, active: false },
  { uid: "DS02-006-d-u18", split: "dev", fault_class: "FAULT_LPT", is_virtual: false, cycles: 71, active: false },
  { uid: "DS02-006-d-u20", split: "dev", fault_class: "FAULT_LPT", is_virtual: false, cycles: 66, active: false },
  { uid: "DS01-005-d-u4-drift0", split: "dev", fault_class: "FAULT_SENSOR_DRIFT", is_virtual: true, cycles: 37, active: false },
  { uid: "DS01-005-d-u6-drift0", split: "dev", fault_class: "FAULT_SENSOR_DRIFT", is_virtual: true, cycles: 24, active: false },
];

export default function AddEngineModal({
  isOpen,
  onClose,
  onEngineAdded,
  currentFleetUids,
}: Props) {
  const [tab, setTab] = useState<"dataset" | "custom">("dataset");
  const [available, setAvailable] = useState<AvailableEngine[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Custom tail synthesis state
  const [customTail, setCustomTail] = useState("");
  const [customFault, setCustomFault] = useState("FAULT_HPT_THERMAL");
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    getJSON<AvailableEngine[]>("/fleet/available")
      .then((data) => {
        if (data && data.length > 0) {
          setAvailable(data);
        } else {
          setAvailable(FALLBACK_AVAILABLE);
        }
      })
      .catch(() => {
        setAvailable(FALLBACK_AVAILABLE);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const activeSet = new Set(currentFleetUids);

  const filtered = available.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.uid.toLowerCase().includes(q) ||
      e.fault_class.toLowerCase().includes(q) ||
      e.split.toLowerCase().includes(q)
    );
  });

  const handleAddDatasetEngine = async (uid: string) => {
    setAddingUid(uid);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await postJSON("/fleet/add", { uid });
      setSuccessMsg(`Engine ${uid} successfully commissioned into the active flight fleet!`);
      // Update local state
      setAvailable((prev) =>
        prev.map((e) => (e.uid === uid ? { ...e, active: true } : e))
      );
      onEngineAdded();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to add engine. Is the backend running?");
    } finally {
      setAddingUid(null);
    }
  };

  const handleSynthesizeCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTail.trim()) return;

    setIsSynthesizing(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const tail = customTail.trim().toUpperCase();
      await postJSON("/fleet/add", {
        tail_number: tail,
        fault_class: customFault,
      });
      setSuccessMsg(`Aircraft tail ${tail} successfully registered and deployed to fleet rotation!`);
      setCustomTail("");
      onEngineAdded();
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to deploy custom tail.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
                <Plane className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-lg font-bold tracking-tight text-fg">
                Commission Aero-Engine to Fleet
              </h2>
            </div>
            <p className="mt-1 text-xs text-fg-3">
              Add empirical engines from the NASA N-CMAPSS dataset or register a custom aircraft tail number for real-time monitoring.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-1 text-fg-3 hover:text-fg hover:bg-elevated transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-line gap-4 text-xs font-semibold">
          <button
            onClick={() => setTab("dataset")}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              tab === "dataset"
                ? "border-brand-graphic text-brand"
                : "border-transparent text-fg-3 hover:text-fg"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            NASA Ground-Truth Engines ({available.length})
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              tab === "custom"
                ? "border-brand-graphic text-brand"
                : "border-transparent text-fg-3 hover:text-fg"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Custom Airframe Tail Registration
          </button>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="rounded-control border border-ok/30 bg-ok-fill/10 p-3 text-xs text-ok flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-control border border-crit/30 bg-crit-fill/10 p-3 text-xs text-crit flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: NASA DATASET ENGINES */}
        {tab === "dataset" && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search engine UID or fault type (e.g. DS01, LPT, HPT, drift)..."
                className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-3 text-xs text-fg placeholder:text-fg-3 focus:border-brand-graphic focus:outline-none"
              />
            </div>

            {/* Engine List Container */}
            <div className="max-h-[340px] overflow-y-auto rounded-card border border-line divide-y divide-line/60">
              {loading ? (
                <div className="p-8 text-center text-xs text-fg-3 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-brand" />
                  <span>Loading available ground-truth engines...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-fg-3">
                  No engines match your search query.
                </div>
              ) : (
                filtered.map((eng) => {
                  const isActive = eng.active || activeSet.has(eng.uid);
                  const isBusy = addingUid === eng.uid;

                  return (
                    <div
                      key={eng.uid}
                      className="flex items-center justify-between p-3 text-xs hover:bg-elevated/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-fg">{eng.uid}</span>
                          <span className="rounded bg-elevated border border-line/60 px-1.5 py-0.2 text-[10px] uppercase text-fg-3">
                            {eng.split}
                          </span>
                        </div>
                        <div className="text-[11px] text-fg-3">
                          {faultLabel(eng.fault_class)} · {eng.cycles} cycles
                        </div>
                      </div>

                      <div>
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-chip bg-ok-fill/15 border border-ok/30 px-2.5 py-1 text-xs font-medium text-ok">
                            <Check className="h-3 w-3" />
                            Active in Fleet
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddDatasetEngine(eng.uid)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1 rounded-control bg-brand px-3 py-1 text-xs font-semibold text-brand-on hover:bg-brand-hover shadow-sm transition-colors disabled:opacity-60"
                          >
                            {isBusy ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            <span>{isBusy ? "Adding..." : "Commission"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOM AIRFRAME SIMULATOR */}
        {tab === "custom" && (
          <form onSubmit={handleSynthesizeCustom} className="space-y-4 text-xs">
            <div className="rounded-control border border-line bg-elevated/30 p-4 space-y-3">
              <div>
                <label className="block font-semibold text-fg mb-1">
                  Aircraft Tail / Engine Serial Number
                </label>
                <input
                  type="text"
                  required
                  value={customTail}
                  onChange={(e) => setCustomTail(e.target.value)}
                  placeholder="e.g. VT-VXM-09, CFM56-7B-891, A320-ENG-2"
                  className="h-9 w-full rounded-control border border-line bg-surface px-3 font-mono text-xs uppercase placeholder:normal-case placeholder:text-fg-3 focus:border-brand-graphic focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-fg-3">
                  Assign an operational tail registration for this simulated turbofan powerplant.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-fg mb-1">
                  Operating Degradation Profile / Fault Scenario
                </label>
                <select
                  value={customFault}
                  onChange={(e) => setCustomFault(e.target.value)}
                  className="h-9 w-full rounded-control border border-line bg-surface px-3 text-xs text-fg focus:border-brand-graphic focus:outline-none"
                >
                  <option value="FAULT_HPT_THERMAL">
                    High-Pressure Turbine (HPT) Thermal Distress
                  </option>
                  <option value="FAULT_LPT">
                    Low-Pressure Turbine (LPT) Blade Rubbing & Seal Leakage
                  </option>
                  <option value="FAULT_SENSOR_DRIFT">
                    Instrumentation Transducer / Thermocouple Drift
                  </option>
                  <option value="NOMINAL">
                    Healthy Operational Baseline (Nominal Thrust Envelope)
                  </option>
                </select>
                <p className="mt-1 text-[11px] text-fg-3">
                  The engine will be seeded with corresponding high-dimensional sensor telemetry and temporal features.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSynthesizing || !customTail.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-xs font-semibold text-brand-on hover:bg-brand-hover shadow-sm transition-colors disabled:opacity-60"
            >
              {isSynthesizing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>{isSynthesizing ? "Deploying Airframe..." : "Deploy to Active Fleet"}</span>
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11px] text-fg-3">
            Engines immediately appear in the priority triage queue with full RUL & cost telemetry.
          </span>
          <button
            onClick={onClose}
            className="rounded-control bg-elevated hover:bg-line px-4 py-1.5 text-xs font-medium text-fg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
