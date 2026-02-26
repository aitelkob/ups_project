"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FileType = "PDF" | "DOCX" | "XLSX" | "OTHER";
type SortOption = "newest" | "oldest" | "title";

type DocumentRecord = {
  id: string;
  title: string;
  fileType: FileType;
  externalUrl: string | null;
  localPathNote: string | null;
  tags: string | null;
  notes: string | null;
  sizeMb: number | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentFormData = {
  title: string;
  fileType: FileType;
  externalUrl: string;
  localPathNote: string;
  tags: string;
  notes: string;
  sizeMb: string;
};

const FILE_TYPES: FileType[] = ["PDF", "DOCX", "XLSX", "OTHER"];
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title" },
];

const EMPTY_FORM: DocumentFormData = {
  title: "",
  fileType: "OTHER",
  externalUrl: "",
  localPathNote: "",
  tags: "",
  notes: "",
  sizeMb: "",
};

function normalizePayload(form: DocumentFormData) {
  return {
    title: form.title.trim(),
    fileType: form.fileType,
    externalUrl: form.externalUrl.trim(),
    localPathNote: form.localPathNote.trim(),
    tags: form.tags.trim(),
    notes: form.notes.trim(),
    sizeMb: form.sizeMb ? Number(form.sizeMb) : undefined,
  };
}

function validateForm(form: DocumentFormData) {
  const errors: Partial<Record<keyof DocumentFormData, string>> = {};
  if (!form.title.trim()) {
    errors.title = "Title is required.";
  }
  if (!form.externalUrl.trim() && !form.localPathNote.trim()) {
    errors.externalUrl = "Add either external URL or local path.";
    errors.localPathNote = "Add either external URL or local path.";
  }
  if (form.externalUrl.trim()) {
    try {
      new URL(form.externalUrl.trim());
    } catch {
      errors.externalUrl = "External URL must be a valid URL.";
    }
  }
  if (form.sizeMb && (!Number.isInteger(Number(form.sizeMb)) || Number(form.sizeMb) <= 0)) {
    errors.sizeMb = "Size MB must be a positive integer.";
  }
  return errors;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function toEditForm(record: DocumentRecord): DocumentFormData {
  return {
    title: record.title,
    fileType: record.fileType,
    externalUrl: record.externalUrl ?? "",
    localPathNote: record.localPathNote ?? "",
    tags: record.tags ?? "",
    notes: record.notes ?? "",
    sizeMb: record.sizeMb ? String(record.sizeMb) : "",
  };
}

function DocumentFields({
  form,
  setForm,
  errors,
}: {
  form: DocumentFormData;
  setForm: Dispatch<SetStateAction<DocumentFormData>>;
  errors: Partial<Record<keyof DocumentFormData, string>>;
}) {
  return (
    <div className="grid gap-3">
      <label className="space-y-1">
        <span className="text-sm font-medium">Title *</span>
        <input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          className="w-full rounded-lg border border-slate-300 p-3"
          placeholder="e.g. Week 3 DeBag Study"
        />
        {errors.title ? <p className="text-xs text-red-600">{errors.title}</p> : null}
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">File Type</span>
        <select
          value={form.fileType}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, fileType: event.target.value as FileType }))
          }
          className="w-full rounded-lg border border-slate-300 p-3"
        >
          {FILE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">External URL</span>
        <input
          value={form.externalUrl}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, externalUrl: event.target.value }))
          }
          className="w-full rounded-lg border border-slate-300 p-3"
          placeholder="https://drive.google.com/..."
        />
        {errors.externalUrl ? <p className="text-xs text-red-600">{errors.externalUrl}</p> : null}
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">Local Path Note</span>
        <input
          value={form.localPathNote}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, localPathNote: event.target.value }))
          }
          className="w-full rounded-lg border border-slate-300 p-3"
          placeholder="DeBag Vault / Week 3 / file.docx"
        />
        {errors.localPathNote ? (
          <p className="text-xs text-red-600">{errors.localPathNote}</p>
        ) : null}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Tags</span>
          <input
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="timing, week3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Size MB</span>
          <input
            type="number"
            value={form.sizeMb}
            onChange={(event) => setForm((prev) => ({ ...prev, sizeMb: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 p-3"
            placeholder="75"
          />
          {errors.sizeMb ? <p className="text-xs text-red-600">{errors.sizeMb}</p> : null}
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-sm font-medium">Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          className="min-h-24 w-full rounded-lg border border-slate-300 p-3"
          placeholder="Any context for this study document..."
        />
      </label>
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | FileType>("ALL");
  const [sort, setSort] = useState<SortOption>("newest");

  const [form, setForm] = useState<DocumentFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DocumentFormData, string>>>({});

  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [editForm, setEditForm] = useState<DocumentFormData>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof DocumentFormData, string>>>({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("query", search.trim());
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    params.set("sort", sort);
    return params.toString();
  }, [search, sort, typeFilter]);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 2500);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/documents?${queryString}`);
        if (response.status === 401) {
          router.replace(`/pin?next=${encodeURIComponent("/documents")}`);
          return;
        }
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Unable to load documents.");
        }
        const data = (await response.json()) as DocumentRecord[];
        setRecords(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load documents.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [queryString, router]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationErrors = validateForm(form);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizePayload(form)),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Unable to create document.");
      }
      setForm(EMPTY_FORM);
      setMessage("Document added.");
      const created = (await response.json()) as DocumentRecord;
      setRecords((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create document.");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this document?")) return;
    setError("");
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Unable to delete document.");
      }
      setRecords((prev) => prev.filter((item) => item.id !== id));
      setMessage("Document deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete document.");
    }
  }

  function beginEdit(record: DocumentRecord) {
    setEditing(record);
    setEditForm(toEditForm(record));
    setEditErrors({});
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    const validationErrors = validateForm(editForm);
    setEditErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const response = await fetch(`/api/documents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizePayload(editForm)),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Unable to update document.");
      }
      const updated = (await response.json()) as DocumentRecord;
      setRecords((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      setMessage("Document updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update document.");
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/pin?next=/documents");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-4 p-3 pb-10 text-slate-900 sm:p-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Documents</h1>
            <p className="text-sm text-slate-600">
              Private metadata vault for study files (links and local notes only).
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add Document</h2>
        <form onSubmit={onCreate} className="space-y-3">
          <DocumentFields form={form} setForm={setForm} errors={formErrors} />
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-700 p-4 text-lg font-semibold text-white hover:bg-blue-800"
          >
            Save Document
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Document Library</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, tags, notes..."
            className="rounded-lg border border-slate-300 p-3"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "ALL" | FileType)}
            className="rounded-lg border border-slate-300 p-3"
          >
            <option value="ALL">All Types</option>
            {FILE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-lg border border-slate-300 p-3"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 p-3 text-center text-slate-500">
            Loading...
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-3 text-center text-slate-500">
            No documents yet.
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-200 p-3 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold">{record.title}</p>
                    <p className="text-xs text-slate-500">
                      {record.fileType} - Created {formatDate(record.createdAt)}
                    </p>
                    {record.tags ? (
                      <p className="mt-1 text-xs text-slate-600">Tags: {record.tags}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    {record.externalUrl ? (
                      <a
                        href={record.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium hover:bg-slate-50"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm text-slate-400">
                        No Link
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => beginEdit(record)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(record.id)}
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {record.localPathNote ? (
                  <p className="mt-2 text-xs text-slate-600">Local path: {record.localPathNote}</p>
                ) : null}
                {record.notes ? (
                  <details className="mt-2 rounded-lg bg-slate-50 p-2">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      Notes
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{record.notes}</p>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold">Edit Document</h3>
            <form onSubmit={onUpdate} className="mt-3 space-y-3">
              <DocumentFields form={editForm} setForm={setEditForm} errors={editErrors} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-slate-300 p-3 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 p-3 font-medium text-white hover:bg-blue-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
