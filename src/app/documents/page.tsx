"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { getSupabaseClient } from "@/lib/supabaseClient";

type FileType = "PDF" | "DOCX" | "XLSX" | "OTHER";
type SortOption = "newest" | "oldest" | "title";

type DocumentRecord = {
  id: string;
  title: string;
  fileType: FileType;
  storageBucket: string;
  storagePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type DocumentFormData = {
  title: string;
  fileType: FileType;
  tags: string;
  notes: string;
};

const FILE_TYPES: FileType[] = ["PDF", "DOCX", "XLSX", "OTHER"];
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title" },
];
const DEFAULT_BUCKET = "debag-docs";

const EMPTY_FORM: DocumentFormData = {
  title: "",
  fileType: "OTHER",
  tags: "",
  notes: "",
};

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferFileType(file?: File | null): FileType {
  if (!file) return "OTHER";
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".xlsx")) return "XLSX";
  return "OTHER";
}

function monthPath() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatBytes(sizeBytes: number | null) {
  if (!sizeBytes) return "-";
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateCreateForm(form: DocumentFormData, file: File | null) {
  const errors: Partial<Record<keyof DocumentFormData | "file", string>> = {};
  if (!form.title.trim()) {
    errors.title = "Title is required.";
  }
  if (!file) {
    errors.file = "Select a file.";
    return errors;
  }
  if (inferFileType(file) === "OTHER") {
    errors.file = "Only PDF, DOCX, and XLSX are supported.";
  }
  return errors;
}

function validateEditForm(form: DocumentFormData) {
  const errors: Partial<Record<keyof DocumentFormData, string>> = {};
  if (!form.title.trim()) {
    errors.title = "Title is required.";
  }
  return errors;
}

function toEditForm(record: DocumentRecord): DocumentFormData {
  return {
    title: record.title,
    fileType: record.fileType,
    tags: record.tags ?? "",
    notes: record.notes ?? "",
  };
}

function DocumentFields({
  form,
  setForm,
  errors,
  onFileChange,
  selectedFileName,
  disableFilePicker,
}: {
  form: DocumentFormData;
  setForm: Dispatch<SetStateAction<DocumentFormData>>;
  errors: Partial<Record<keyof DocumentFormData | "file", string>>;
  onFileChange: (file: File | null) => void;
  selectedFileName: string;
  disableFilePicker: boolean;
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
        <span className="text-sm font-medium">File *</span>
        <input
          type="file"
          accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-slate-300 p-3"
          disabled={disableFilePicker}
        />
        {selectedFileName ? (
          <p className="text-xs text-slate-600">Selected: {selectedFileName}</p>
        ) : null}
        {errors.file ? <p className="text-xs text-red-600">{errors.file}</p> : null}
      </label>

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
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof DocumentFormData | "file", string>>
  >({});
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [editForm, setEditForm] = useState<DocumentFormData>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof DocumentFormData, string>>>(
    {},
  );

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
    const validationErrors = validateCreateForm(form, fileToUpload);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0 || !fileToUpload) return;

    setUploading(true);
    try {
      const uploadId = createId();
      const sanitized = sanitizeFilename(fileToUpload.name);
      const storagePath = `documents/${monthPath()}/${uploadId}-${sanitized}`;
      const contentType = fileToUpload.type || "application/octet-stream";

      const { error: uploadError } = await getSupabaseClient().storage
        .from(DEFAULT_BUCKET)
        .upload(storagePath, fileToUpload, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          fileType: form.fileType,
          storageBucket: DEFAULT_BUCKET,
          storagePath,
          originalFilename: fileToUpload.name,
          mimeType: contentType,
          sizeBytes: fileToUpload.size,
          tags: form.tags.trim(),
          notes: form.notes.trim(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Unable to save metadata.");
      }
      const created = (await response.json()) as DocumentRecord;
      setRecords((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setFileToUpload(null);
      setFormErrors({});
      setMessage("Upload complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/documents/${id}/signed-url`);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Unable to open document.");
      }
      const payload = (await response.json()) as { signedUrl: string };
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open document.");
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
    const validationErrors = validateEditForm(editForm);
    setEditErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      const response = await fetch(`/api/documents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          fileType: editForm.fileType,
          tags: editForm.tags.trim(),
          notes: editForm.notes.trim(),
        }),
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
              Private file storage for DeBag study documents.
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
        <h2 className="mb-3 text-lg font-semibold">Upload Document</h2>
        <form onSubmit={onCreate} className="space-y-3">
          <DocumentFields
            form={form}
            setForm={setForm}
            errors={formErrors}
            onFileChange={(file) => {
              setFileToUpload(file);
              setForm((prev) => ({ ...prev, fileType: inferFileType(file) }));
            }}
            selectedFileName={fileToUpload?.name || ""}
            disableFilePicker={uploading}
          />
          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-xl bg-blue-700 p-4 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload & Save"}
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
                    <p className="text-xs text-slate-500">
                      {record.originalFilename || "unknown"} - {formatBytes(record.sizeBytes)}
                    </p>
                    {record.tags ? (
                      <p className="mt-1 text-xs text-slate-600">Tags: {record.tags}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => openDocument(record.id)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium hover:bg-slate-50"
                    >
                      Open
                    </button>
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
              <div className="grid gap-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Title *</span>
                  <input
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 p-3"
                  />
                  {editErrors.title ? (
                    <p className="text-xs text-red-600">{editErrors.title}</p>
                  ) : null}
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">File Type</span>
                  <select
                    value={editForm.fileType}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        fileType: event.target.value as FileType,
                      }))
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
                  <span className="text-sm font-medium">Tags</span>
                  <input
                    value={editForm.tags}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, tags: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Notes</span>
                  <textarea
                    value={editForm.notes}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-lg border border-slate-300 p-3"
                  />
                </label>
              </div>
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
