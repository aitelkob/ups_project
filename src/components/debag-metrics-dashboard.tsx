"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "DUMPER" | "UNZIPPER";
type Belt = "DEBAG1" | "DEBAG2";
type ShiftWindow = "EARLY" | "MID" | "LATE";
type FlowCondition = "NORMAL" | "PEAK" | "JAM";
type MainTab = "OPERATIONS" | "REPORTS";

type Person = {
  id: number;
  name: string | null;
  employeeCode: string | null;
  active: boolean;
  createdAt: string;
};

type Observation = {
  id: number;
  personId: number;
  role: Role;
  belt: Belt;
  shiftWindow: ShiftWindow;
  bagsTimed: number;
  totalSeconds: number;
  avgSecondsPerBag: number;
  flowCondition: FlowCondition;
  qualityIssue: boolean;
  safetyIssue: boolean;
  notes: string | null;
  createdAt: string;
  person: Person;
};

type ReportResponse = {
  range: { start: string; end: string };
  totals: { observations: number };
  perPerson: Array<{
    personId: number;
    personName: string;
    observations: number;
    avgSecondsPerBag: number;
    qualityIssueRate: number;
    safetyIssueRate: number;
  }>;
  byRole: Array<{
    role: Role;
    observations: number;
    avgSecondsPerBag: number;
    qualityIssueRate: number;
    safetyIssueRate: number;
  }>;
};

type Filters = {
  role: Role | "ALL";
  belt: Belt | "ALL";
  shiftWindow: ShiftWindow | "ALL";
  flowCondition: FlowCondition | "ALL";
};

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  pin?: string;
};

const DEFAULT_FILTERS: Filters = {
  role: "ALL",
  belt: "ALL",
  shiftWindow: "ALL",
  flowCondition: "ALL",
};

const ROLE_OPTIONS: Array<Role> = ["DUMPER", "UNZIPPER"];
const BELT_OPTIONS: Array<Belt> = ["DEBAG1", "DEBAG2"];
const SHIFT_OPTIONS: Array<ShiftWindow> = ["EARLY", "MID", "LATE"];
const FLOW_OPTIONS: Array<FlowCondition> = ["NORMAL", "PEAK", "JAM"];

function formatPerson(person: Person) {
  return person.name || person.employeeCode || `ID ${person.id}`;
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function flowBadge(flow: FlowCondition) {
  if (flow === "JAM") return "bg-red-100 text-red-700 border-red-200";
  if (flow === "PEAK") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function speedPill(avg: number) {
  if (avg <= 5) return "bg-emerald-100 text-emerald-800";
  if (avg <= 8) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: HeadersInit = {};
  if (options.pin) headers["x-app-pin"] = options.pin;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Keep default message if response is not json.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export default function DeBagMetricsDashboard({
  pinRequired,
}: {
  pinRequired: boolean;
}) {
  const [tab, setTab] = useState<MainTab>("OPERATIONS");
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [personSearch, setPersonSearch] = useState("");
  const [personId, setPersonId] = useState<number | "">("");
  const [role, setRole] = useState<Role>("DUMPER");
  const [belt, setBelt] = useState<Belt>("DEBAG1");
  const [shiftWindow, setShiftWindow] = useState<ShiftWindow>("EARLY");
  const [bagsTimed, setBagsTimed] = useState<number>(10);
  const [totalSeconds, setTotalSeconds] = useState<number>(0);
  const [flowCondition, setFlowCondition] = useState<FlowCondition>("NORMAL");
  const [qualityIssue, setQualityIssue] = useState(false);
  const [safetyIssue, setSafetyIssue] = useState(false);
  const [notes, setNotes] = useState("");

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newEmployeeCode, setNewEmployeeCode] = useState("");

  const [showTimingModal, setShowTimingModal] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timedBagCount, setTimedBagCount] = useState(0);

  const [jamOnly, setJamOnly] = useState(false);
  const [logPersonFilter, setLogPersonFilter] = useState("");

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const today = useMemo(() => formatDateInput(new Date()), []);
  const [reportStart, setReportStart] = useState(today);
  const [reportEnd, setReportEnd] = useState(today);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const canLoad = !pinRequired || Boolean(pin);

  const filteredPeople = useMemo(() => {
    const query = personSearch.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) =>
      `${person.name || ""} ${person.employeeCode || ""}`.toLowerCase().includes(query),
    );
  }, [people, personSearch]);

  const frequentPeople = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of observations) {
      counts.set(row.personId, (counts.get(row.personId) ?? 0) + 1);
    }
    return [...people]
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
      .slice(0, 4)
      .filter((person) => (counts.get(person.id) ?? 0) > 0);
  }, [observations, people]);

  const displayedObservations = useMemo(() => {
    const personQuery = logPersonFilter.trim().toLowerCase();
    return observations.filter((row) => {
      if (jamOnly && row.flowCondition !== "JAM") return false;
      if (!personQuery) return true;
      return formatPerson(row.person).toLowerCase().includes(personQuery);
    });
  }, [observations, jamOnly, logPersonFilter]);

  useEffect(() => {
    const saved = window.localStorage.getItem("debags_pin") || "";
    if (saved) {
      setPin(saved);
      setPinInput(saved);
    }
  }, []);

  useEffect(() => {
    if (!canLoad) return;
    const loadPeople = async () => {
      try {
        const data = await requestJson<Person[]>("/api/people", { pin });
        setPeople(data);
        if (data.length > 0 && personId === "") {
          setPersonId(data[0].id);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Unable to load people.");
      }
    };
    void loadPeople();
  }, [canLoad, pin, personId]);

  useEffect(() => {
    if (!canLoad) return;
    const loadObservations = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (filters.role !== "ALL") query.set("role", filters.role);
        if (filters.belt !== "ALL") query.set("belt", filters.belt);
        if (filters.shiftWindow !== "ALL") query.set("shiftWindow", filters.shiftWindow);
        if (filters.flowCondition !== "ALL") query.set("flowCondition", filters.flowCondition);
        query.set("limit", "50");

        const data = await requestJson<Observation[]>(
          `/api/observations?${query.toString()}`,
          { pin },
        );
        setObservations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load observations.");
      } finally {
        setLoading(false);
      }
    };
    void loadObservations();
  }, [canLoad, filters, pin]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!showTimingModal || timerStartedAt === null) return;
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000));
      setElapsedSeconds(seconds);
    }, 250);
    return () => window.clearInterval(interval);
  }, [showTimingModal, timerStartedAt]);

  async function handleUnlockPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await requestJson<Person[]>("/api/people", { pin: pinInput.trim() });
      setPin(pinInput.trim());
      setAuthError("");
      window.localStorage.setItem("debags_pin", pinInput.trim());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Invalid PIN.");
    }
  }

  async function refreshObservations() {
    const query = new URLSearchParams();
    if (filters.role !== "ALL") query.set("role", filters.role);
    if (filters.belt !== "ALL") query.set("belt", filters.belt);
    if (filters.shiftWindow !== "ALL") query.set("shiftWindow", filters.shiftWindow);
    if (filters.flowCondition !== "ALL") query.set("flowCondition", filters.flowCondition);
    query.set("limit", "50");

    const data = await requestJson<Observation[]>(`/api/observations?${query.toString()}`, {
      pin,
    });
    setObservations(data);
  }

  function openTimingModal() {
    if (personId === "") {
      setError("Select a person before starting timer.");
      return;
    }
    setError("");
    setElapsedSeconds(0);
    setTimedBagCount(0);
    setTimerStartedAt(Date.now());
    setShowTimingModal(true);
  }

  function cancelTimingModal() {
    setShowTimingModal(false);
    setTimerStartedAt(null);
    setElapsedSeconds(0);
    setTimedBagCount(0);
  }

  function applyTimedObservation() {
    if (timedBagCount < 1) {
      setError("Tap at least one bag before finishing timing.");
      return;
    }
    setBagsTimed(timedBagCount);
    setTotalSeconds(Math.max(1, elapsedSeconds));
    setShowTimingModal(false);
    setTimerStartedAt(null);
    setToast("Timing captured.");
  }

  async function submitObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (personId === "") {
      setError("Select a person before submitting.");
      return;
    }
    if (bagsTimed < 1) {
      setError("Bags timed must be at least 1.");
      return;
    }
    if (totalSeconds < 1) {
      setError("Tap Start Timer and capture timing first.");
      return;
    }

    try {
      await requestJson<Observation>("/api/observations", {
        method: "POST",
        pin,
        body: {
          personId,
          role,
          belt,
          shiftWindow,
          bagsTimed,
          totalSeconds,
          flowCondition,
          qualityIssue,
          safetyIssue,
          notes,
        },
      });

      setBagsTimed(10);
      setTotalSeconds(0);
      setFlowCondition("NORMAL");
      setQualityIssue(false);
      setSafetyIssue(false);
      setNotes("");
      setToast("Observation saved.");
      await refreshObservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save observation.");
    }
  }

  async function submitQuickAddPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const person = await requestJson<Person>("/api/people", {
        method: "POST",
        pin,
        body: {
          name: newPersonName,
          employeeCode: newEmployeeCode,
          active: true,
        },
      });
      setPeople((current) => [...current, person]);
      setPersonId(person.id);
      setPersonSearch(person.name || person.employeeCode || "");
      setNewPersonName("");
      setNewEmployeeCode("");
      setShowAddPerson(false);
      setToast("Person added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add person.");
    }
  }

  async function deleteObservation(id: number) {
    const confirmed = window.confirm("Delete this observation?");
    if (!confirmed) return;
    try {
      await requestJson<null>(`/api/observations/${id}`, {
        method: "DELETE",
        pin,
      });
      setToast("Observation deleted.");
      await refreshObservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function generateReport() {
    setError("");
    try {
      const data = await requestJson<ReportResponse>(
        `/api/reports?start=${reportStart}&end=${reportEnd}`,
        { pin },
      );
      setReport(data);
      setTab("REPORTS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build report.");
    }
  }

  async function exportCsv() {
    setError("");
    try {
      const headers: HeadersInit = {};
      if (pin) headers["x-app-pin"] = pin;
      const response = await fetch(
        `/api/observations/export?start=${reportStart}&end=${reportEnd}`,
        { headers },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Export failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `debags_${reportStart}_to_${reportEnd}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      setToast("CSV exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  if (pinRequired && !pin) {
    return (
      <main className="mx-auto min-h-screen max-w-md p-4">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">DeBag Metrics</h1>
        <form
          onSubmit={handleUnlockPin}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm text-slate-600">Enter app PIN to continue.</p>
          <input
            type="password"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-lg"
            placeholder="PIN"
            required
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 p-3 text-lg font-semibold text-white hover:bg-slate-800"
          >
            Unlock
          </button>
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 pb-10 text-slate-900">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">DeBag Metrics</h1>
            <p className="text-sm text-slate-600">
              Time-and-motion capture for UPS DeBag operations.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("OPERATIONS")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === "OPERATIONS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Operations
            </button>
            <button
              type="button"
              onClick={() => setTab("REPORTS")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                tab === "REPORTS"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Reports
            </button>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {tab === "OPERATIONS" ? (
        <div className="grid gap-4 xl:grid-cols-12">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Input - Add Observation</h2>
              <button
                type="button"
                onClick={() => setShowAddPerson((current) => !current)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {showAddPerson ? "Close" : "Quick Add Person"}
              </button>
            </div>

            {showAddPerson ? (
              <form
                onSubmit={submitQuickAddPerson}
                className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <input
                  placeholder="Name (optional)"
                  value={newPersonName}
                  onChange={(event) => setNewPersonName(event.target.value)}
                  className="rounded-lg border border-slate-300 p-3"
                />
                <input
                  placeholder="Employee code (optional)"
                  value={newEmployeeCode}
                  onChange={(event) => setNewEmployeeCode(event.target.value)}
                  className="rounded-lg border border-slate-300 p-3"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 p-3 text-white hover:bg-slate-800"
                >
                  Save Person
                </button>
              </form>
            ) : null}

            <form onSubmit={submitObservation} className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Person</p>
                <input
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Search person or employee code"
                />
                <select
                  value={personId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPersonId(value ? Number(value) : "");
                  }}
                  className="w-full rounded-lg border border-slate-300 p-3"
                  required
                >
                  <option value="">Select person</option>
                  {filteredPeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {formatPerson(person)}
                    </option>
                  ))}
                </select>
                {frequentPeople.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {frequentPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setPersonId(person.id)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        {formatPerson(person)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-lg p-3 text-sm font-semibold ${
                      role === item
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Belt</span>
                  <select
                    value={belt}
                    onChange={(event) => setBelt(event.target.value as Belt)}
                    className="w-full rounded-lg border border-slate-300 p-3"
                  >
                    {BELT_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Shift</span>
                  <select
                    value={shiftWindow}
                    onChange={(event) => setShiftWindow(event.target.value as ShiftWindow)}
                    className="w-full rounded-lg border border-slate-300 p-3"
                  >
                    {SHIFT_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-900 p-4 text-white shadow-inner">
                <p className="text-xs uppercase tracking-wide text-slate-300">Timed Capture</p>
                <div className="mt-2 text-center">
                  <p className="text-5xl font-bold tabular-nums">{formatDuration(totalSeconds)}</p>
                  <p className="mt-1 text-sm text-slate-300">Captured Time</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white/10 p-2">
                    <p className="text-xs text-slate-300">Bags</p>
                    <p className="text-2xl font-semibold">{bagsTimed}</p>
                  </div>
                  <div className="rounded-lg bg-white/10 p-2">
                    <p className="text-xs text-slate-300">Avg sec/bag</p>
                    <p className="text-2xl font-semibold">
                      {bagsTimed > 0 && totalSeconds > 0
                        ? (totalSeconds / bagsTimed).toFixed(2)
                        : "--"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openTimingModal}
                  className="mt-3 w-full rounded-xl bg-white p-3 text-base font-bold text-slate-900 hover:bg-slate-100"
                >
                  Start Tap Timer
                </button>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium">Flow Condition</span>
                <select
                  value={flowCondition}
                  onChange={(event) => setFlowCondition(event.target.value as FlowCondition)}
                  className="w-full rounded-lg border border-slate-300 p-3"
                >
                  {FLOW_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-semibold">Flag Issues</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQualityIssue((value) => !value)}
                    className={`rounded-lg border p-3 text-sm font-semibold ${
                      qualityIssue
                        ? "border-amber-300 bg-amber-100 text-amber-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Quality {qualityIssue ? "ON" : "OFF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSafetyIssue((value) => !value)}
                    className={`rounded-lg border p-3 text-sm font-semibold ${
                      safetyIssue
                        ? "border-red-300 bg-red-100 text-red-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Safety {safetyIssue ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="min-h-20 w-full rounded-lg border border-slate-300 p-3"
                  placeholder="Optional notes"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-700 p-4 text-lg font-bold text-white hover:bg-blue-800"
              >
                Save Observation
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-7">
            <h2 className="mb-3 text-lg font-semibold">Real-Time Monitoring - Today&apos;s Log</h2>

            <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setJamOnly((value) => !value)}
                className={`rounded-lg p-3 text-sm font-semibold ${
                  jamOnly
                    ? "bg-red-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {jamOnly ? "Showing JAM only" : "Show only JAM"}
              </button>
              <input
                value={logPersonFilter}
                onChange={(event) => setLogPersonFilter(event.target.value)}
                className="rounded-lg border border-slate-300 p-3"
                placeholder="Quick filter by person"
              />
            </div>

            <div className="mb-3 grid gap-2 md:grid-cols-5">
              <select
                value={filters.role}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, role: event.target.value as Filters["role"] }))
                }
                className="rounded-lg border border-slate-300 p-2"
              >
                <option value="ALL">Role: All</option>
                {ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Role: {item}
                  </option>
                ))}
              </select>
              <select
                value={filters.belt}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, belt: event.target.value as Filters["belt"] }))
                }
                className="rounded-lg border border-slate-300 p-2"
              >
                <option value="ALL">Belt: All</option>
                {BELT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Belt: {item}
                  </option>
                ))}
              </select>
              <select
                value={filters.shiftWindow}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    shiftWindow: event.target.value as Filters["shiftWindow"],
                  }))
                }
                className="rounded-lg border border-slate-300 p-2"
              >
                <option value="ALL">Shift: All</option>
                {SHIFT_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Shift: {item}
                  </option>
                ))}
              </select>
              <select
                value={filters.flowCondition}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    flowCondition: event.target.value as Filters["flowCondition"],
                  }))
                }
                className="rounded-lg border border-slate-300 p-2"
              >
                <option value="ALL">Flow: All</option>
                {FLOW_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Flow: {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setJamOnly(false);
                  setLogPersonFilter("");
                }}
                className="rounded-lg border border-slate-300 p-2 font-medium hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>
                    <th className="p-2">Time</th>
                    <th className="p-2">Person</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Belt</th>
                    <th className="p-2">Shift</th>
                    <th className="p-2">Avg sec/bag</th>
                    <th className="p-2">Flow</th>
                    <th className="p-2">Quality</th>
                    <th className="p-2">Safety</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-3 text-center text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : displayedObservations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-3 text-center text-slate-500">
                        No observations yet.
                      </td>
                    </tr>
                  ) : (
                    displayedObservations.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="p-2">{new Date(row.createdAt).toLocaleTimeString()}</td>
                        <td className="p-2">{formatPerson(row.person)}</td>
                        <td className="p-2">{row.role}</td>
                        <td className="p-2">{row.belt}</td>
                        <td className="p-2">{row.shiftWindow}</td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${speedPill(row.avgSecondsPerBag)}`}
                          >
                            {row.avgSecondsPerBag.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${flowBadge(row.flowCondition)}`}
                          >
                            {row.flowCondition}
                          </span>
                        </td>
                        <td className="p-2">{row.qualityIssue ? "Y" : "N"}</td>
                        <td className="p-2">{row.safetyIssue ? "Y" : "N"}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => deleteObservation(row.id)}
                            className="rounded-lg border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Analytics - Reports</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">Start</span>
              <input
                type="date"
                value={reportStart}
                onChange={(event) => setReportStart(event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">End</span>
              <input
                type="date"
                value={reportEnd}
                onChange={(event) => setReportEnd(event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3"
              />
            </label>
            <button
              type="button"
              onClick={generateReport}
              className="rounded-lg bg-slate-900 p-3 text-white hover:bg-slate-800"
            >
              Run Report
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-slate-400 p-3 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>

          {report ? (
            <div className="mt-4 space-y-4">
              <div className="text-sm">
                <span className="font-medium">Observations:</span> {report.totals.observations}
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2">Person</th>
                      <th className="p-2">Obs</th>
                      <th className="p-2">Avg sec/bag</th>
                      <th className="p-2">Quality %</th>
                      <th className="p-2">Safety %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.perPerson.map((row) => (
                      <tr key={row.personId} className="border-t border-slate-100">
                        <td className="p-2">{row.personName}</td>
                        <td className="p-2">{row.observations}</td>
                        <td className="p-2">{row.avgSecondsPerBag.toFixed(2)}</td>
                        <td className="p-2">{row.qualityIssueRate.toFixed(2)}%</td>
                        <td className="p-2">{row.safetyIssueRate.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2">Role</th>
                      <th className="p-2">Obs</th>
                      <th className="p-2">Avg sec/bag</th>
                      <th className="p-2">Quality %</th>
                      <th className="p-2">Safety %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byRole.map((row) => (
                      <tr key={row.role} className="border-t border-slate-100">
                        <td className="p-2">{row.role}</td>
                        <td className="p-2">{row.observations}</td>
                        <td className="p-2">{row.avgSecondsPerBag.toFixed(2)}</td>
                        <td className="p-2">{row.qualityIssueRate.toFixed(2)}%</td>
                        <td className="p-2">{row.safetyIssueRate.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Run a date-range report to view person and role performance trends.
            </p>
          )}
        </section>
      )}

      {showTimingModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-3 md:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-xl font-bold">Tap Timer</h3>
            <p className="mt-1 text-sm text-slate-600">Tap +1 each time a bag is completed.</p>

            <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-center text-white">
              <p className="text-xs uppercase tracking-wide text-slate-300">Elapsed</p>
              <p className="text-6xl font-bold tabular-nums">{formatDuration(elapsedSeconds)}</p>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-sm text-slate-600">Bags Counted</p>
              <p className="text-5xl font-bold">{timedBagCount}</p>
            </div>

            <button
              type="button"
              onClick={() => setTimedBagCount((current) => current + 1)}
              className="mt-3 h-28 w-full rounded-2xl bg-emerald-600 text-2xl font-bold text-white hover:bg-emerald-700"
            >
              +1 Bag
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTimedBagCount((current) => Math.max(0, current - 1))}
                className="rounded-xl border border-slate-300 p-3 font-semibold hover:bg-slate-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={applyTimedObservation}
                className="rounded-xl bg-blue-700 p-3 font-semibold text-white hover:bg-blue-800"
              >
                Use Timing
              </button>
            </div>

            <button
              type="button"
              onClick={cancelTimingModal}
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
