"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "DUMPER" | "UNZIPPER";
type Belt = "DEBAG1" | "DEBAG2";
type ShiftWindow = "EARLY" | "MID" | "LATE";
type FlowCondition = "NORMAL" | "PEAK" | "JAM";

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

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  pin?: string;
};

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
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep default message for empty or non-json responses.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export default function DeBagMetricsApp({ pinRequired }: { pinRequired: boolean }) {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

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
  const [showTimingModal, setShowTimingModal] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timedBagCount, setTimedBagCount] = useState(0);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newEmployeeCode, setNewEmployeeCode] = useState("");

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const today = useMemo(() => formatDateInput(new Date()), []);
  const [reportStart, setReportStart] = useState(today);
  const [reportEnd, setReportEnd] = useState(today);
  const [report, setReport] = useState<ReportResponse | null>(null);

  const canLoad = !pinRequired || Boolean(pin);

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
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
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
      setError("Use the timer and capture at least 1 second.");
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
    const finalSeconds = Math.max(1, elapsedSeconds);
    setBagsTimed(timedBagCount);
    setTotalSeconds(finalSeconds);
    setShowTimingModal(false);
    setTimerStartedAt(null);
    setToast("Timing captured.");
  }

  if (pinRequired && !pin) {
    return (
      <main className="mx-auto min-h-screen max-w-md p-4">
        <h1 className="mb-4 text-2xl font-bold">DeBag Metrics</h1>
        <form
          onSubmit={handleUnlockPin}
          className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm text-gray-600">Enter app PIN to continue.</p>
          <input
            type="password"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-lg"
            placeholder="PIN"
            required
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 p-3 text-lg font-semibold text-white"
          >
            Unlock
          </button>
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-5 p-4 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">DeBag Metrics</h1>
        <p className="text-sm text-gray-600">Time-and-motion capture for UPS DeBag workers.</p>
      </header>

      {toast ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Observation</h2>
          <button
            type="button"
            onClick={() => setShowAddPerson((current) => !current)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"
          >
            {showAddPerson ? "Close" : "Quick Add Person"}
          </button>
        </div>

        {showAddPerson ? (
          <form
            onSubmit={submitQuickAddPerson}
            className="mb-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-3"
          >
            <input
              placeholder="Name (optional)"
              value={newPersonName}
              onChange={(event) => setNewPersonName(event.target.value)}
              className="rounded-lg border border-gray-300 p-3"
            />
            <input
              placeholder="Employee code (optional)"
              value={newEmployeeCode}
              onChange={(event) => setNewEmployeeCode(event.target.value)}
              className="rounded-lg border border-gray-300 p-3"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-900 p-3 text-white md:w-auto"
            >
              Save Person
            </button>
          </form>
        ) : null}

        <form onSubmit={submitObservation} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Person</span>
            <select
              value={personId}
              onChange={(event) => {
                const value = event.target.value;
                setPersonId(value ? Number(value) : "");
              }}
              className="w-full rounded-lg border border-gray-300 p-3 text-base"
              required
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {formatPerson(person)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Belt</span>
            <select
              value={belt}
              onChange={(event) => setBelt(event.target.value as Belt)}
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              {BELT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Shift Window</span>
            <select
              value={shiftWindow}
              onChange={(event) => setShiftWindow(event.target.value as ShiftWindow)}
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              {SHIFT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1 rounded-lg border border-gray-300 p-3">
            <p className="text-sm font-medium">Timed Capture</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-gray-100 p-2">
                <p className="text-gray-600">Bags</p>
                <p className="text-lg font-semibold">{bagsTimed}</p>
              </div>
              <div className="rounded-lg bg-gray-100 p-2">
                <p className="text-gray-600">Seconds</p>
                <p className="text-lg font-semibold">{totalSeconds}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openTimingModal}
              className="mt-3 w-full rounded-lg bg-blue-600 p-3 text-base font-semibold text-white"
            >
              Start Tap Timer
            </button>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium">Flow Condition</span>
            <select
              value={flowCondition}
              onChange={(event) => setFlowCondition(event.target.value as FlowCondition)}
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              {FLOW_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-300 p-3">
            <input
              type="checkbox"
              checked={qualityIssue}
              onChange={(event) => setQualityIssue(event.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">Quality issue</span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-300 p-3">
            <input
              type="checkbox"
              checked={safetyIssue}
              onChange={(event) => setSafetyIssue(event.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">Safety issue</span>
          </label>

          <label className="space-y-1 md:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20 w-full rounded-lg border border-gray-300 p-3"
              placeholder="Optional notes"
            />
          </label>

          <button
            type="submit"
            className="md:col-span-2 lg:col-span-3 rounded-lg bg-blue-600 p-4 text-lg font-semibold text-white"
          >
            Save Observation
          </button>
        </form>
      </section>

      {showTimingModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 md:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-xl font-bold">Timing in progress</h3>
            <p className="mt-1 text-sm text-gray-600">
              Tap each bag as the worker finishes one.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-100 p-3 text-center">
                <p className="text-sm text-gray-600">Elapsed</p>
                <p className="text-3xl font-bold">{formatDuration(elapsedSeconds)}</p>
              </div>
              <div className="rounded-xl bg-gray-100 p-3 text-center">
                <p className="text-sm text-gray-600">Bags counted</p>
                <p className="text-3xl font-bold">{timedBagCount}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTimedBagCount((current) => current + 1)}
              className="mt-4 h-28 w-full rounded-2xl bg-green-600 text-2xl font-bold text-white active:bg-green-700"
            >
              +1 Bag
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTimedBagCount((current) => Math.max(0, current - 1))}
                className="rounded-xl border border-gray-300 p-3 font-semibold"
              >
                Undo Bag
              </button>
              <button
                type="button"
                onClick={applyTimedObservation}
                className="rounded-xl bg-blue-600 p-3 font-semibold text-white"
              >
                Use This Timing
              </button>
            </div>

            <button
              type="button"
              onClick={cancelTimingModal}
              className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Today&apos;s Log</h2>

        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["ALL", ...ROLE_OPTIONS] as const).map((option) => (
              <button
                key={`role-${option}`}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, role: option }))}
                className={`rounded-full px-3 py-1 text-sm ${
                  filters.role === option
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", ...BELT_OPTIONS] as const).map((option) => (
              <button
                key={`belt-${option}`}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, belt: option }))}
                className={`rounded-full px-3 py-1 text-sm ${
                  filters.belt === option
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", ...SHIFT_OPTIONS] as const).map((option) => (
              <button
                key={`shift-${option}`}
                type="button"
                onClick={() =>
                  setFilters((current) => ({ ...current, shiftWindow: option }))
                }
                className={`rounded-full px-3 py-1 text-sm ${
                  filters.shiftWindow === option
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", ...FLOW_OPTIONS] as const).map((option) => (
              <button
                key={`flow-${option}`}
                type="button"
                onClick={() =>
                  setFilters((current) => ({ ...current, flowCondition: option }))
                }
                className={`rounded-full px-3 py-1 text-sm ${
                  filters.flowCondition === option
                    ? "bg-gray-900 text-white"
                    : "border border-gray-300 bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
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
                  <td colSpan={10} className="p-3 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : observations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-3 text-center text-gray-500">
                    No observations yet.
                  </td>
                </tr>
              ) : (
                observations.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="p-2">{new Date(row.createdAt).toLocaleTimeString()}</td>
                    <td className="p-2">{formatPerson(row.person)}</td>
                    <td className="p-2">{row.role}</td>
                    <td className="p-2">{row.belt}</td>
                    <td className="p-2">{row.shiftWindow}</td>
                    <td className="p-2">{row.avgSecondsPerBag.toFixed(2)}</td>
                    <td className="p-2">{row.flowCondition}</td>
                    <td className="p-2">{row.qualityIssue ? "Y" : "N"}</td>
                    <td className="p-2">{row.safetyIssue ? "Y" : "N"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => deleteObservation(row.id)}
                        className="rounded-lg border border-red-300 px-2 py-1 text-red-700"
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

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Reports</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium">Start</span>
            <input
              type="date"
              value={reportStart}
              onChange={(event) => setReportStart(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">End</span>
            <input
              type="date"
              value={reportEnd}
              onChange={(event) => setReportEnd(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-3"
            />
          </label>
          <button
            type="button"
            onClick={generateReport}
            className="rounded-lg bg-gray-900 p-3 text-white"
          >
            Run Report
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-gray-400 p-3"
          >
            Export CSV
          </button>
        </div>

        {report ? (
          <div className="mt-4 space-y-4">
            <div className="text-sm">
              <span className="font-medium">Observations:</span> {report.totals.observations}
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Per Person</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
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
                      <tr key={row.personId} className="border-t border-gray-100">
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
            </div>

            <div>
              <h3 className="mb-2 font-semibold">By Role</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
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
                      <tr key={row.role} className="border-t border-gray-100">
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
          </div>
        ) : null}
      </section>
    </main>
  );
}
