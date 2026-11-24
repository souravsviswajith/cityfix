import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  WorkspaceAuthExpiredError,
  appendGoogleDocText,
  createGoogleDoc,
  deleteDriveFile,
  formatCivicReportDocContent,
  getGoogleDoc,
  listDriveFiles,
  renameDriveFile,
  uploadFileToDrive,
  type DriveFileItem,
  type GoogleDocDetail,
} from '../lib/workspaceClient';
import { sanitizeExternalHref } from '../lib/securityValidation';
import type { CivicReport } from '../types/civic';
import { GoogleSignInButton } from './GoogleSignInButton';

interface WorkspaceDocsViewProps {
  reports: CivicReport[];
}

type PendingMutation =
  | {
      kind: 'rename';
      fileId: string;
      currentName: string;
      newName: string;
    }
  | {
      kind: 'delete';
      fileId: string;
      fileName: string;
    }
  | {
      kind: 'append';
      documentId: string;
      documentTitle: string;
      addition: string;
    };

export const WorkspaceDocsView: React.FC<WorkspaceDocsViewProps> = ({ reports }) => {
  const { workspaceAccessToken, connectWorkspace, clearWorkspaceToken, session } = useAuth();

  const [authBusy, setAuthBusy] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'docs' | 'files'>('all');

  const [selectedDoc, setSelectedDoc] = useState<GoogleDocDetail | null>(null);
  const [selectedDocLink, setSelectedDocLink] = useState<string>('');
  const [docLoading, setDocLoading] = useState(false);

  const [selectedReportId, setSelectedReportId] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocBody, setNewDocBody] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [appendInput, setAppendInput] = useState('');
  const [renameDraftId, setRenameDraftId] = useState<string | null>(null);
  const [renameDraftName, setRenameDraftName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingMutation | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);

  const [statusNotice, setStatusNotice] = useState<{
    message: string;
    link?: string;
    linkLabel?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleWorkspaceError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof WorkspaceAuthExpiredError) {
        clearWorkspaceToken();
        setErrorMsg(err.message);
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : fallback);
    },
    [clearWorkspaceToken]
  );

  const fetchDriveFiles = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride ?? workspaceAccessToken;
      if (!token) return;
      setFilesLoading(true);
      setErrorMsg(null);
      try {
        const items = await listDriveFiles(token, {
          query: searchQuery,
          filter: filterMode,
          pageSize: 25,
        });
        setFiles(items);
      } catch (err) {
        handleWorkspaceError(err, 'Unable to fetch Google Drive files.');
      } finally {
        setFilesLoading(false);
      }
    },
    [workspaceAccessToken, searchQuery, filterMode, handleWorkspaceError]
  );

  useEffect(() => {
    if (workspaceAccessToken) {
      fetchDriveFiles(workspaceAccessToken);
    } else {
      setFiles([]);
      setSelectedDoc(null);
    }
  }, [workspaceAccessToken, filterMode, fetchDriveFiles]);

  const handleConnect = async () => {
    setErrorMsg(null);
    setStatusNotice(null);
    setAuthBusy(true);
    try {
      const tok = await connectWorkspace();
      if (!tok) {
        setErrorMsg(
          'Google sign-in completed, but no Workspace access token was granted. Please approve Google Drive & Docs permissions in the consent popup.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to authorize Google Drive & Docs.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleOpenDoc = async (file: DriveFileItem) => {
    if (!workspaceAccessToken) return;
    setDocLoading(true);
    setErrorMsg(null);
    try {
      const detail = await getGoogleDoc(workspaceAccessToken, file.id);
      setSelectedDoc(detail);
      setSelectedDocLink(
        file.webViewLink ?? `https://docs.google.com/document/d/${file.id}/edit`
      );
      setAppendInput('');
    } catch (err) {
      handleWorkspaceError(err, 'Unable to open Google Doc.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !workspaceAccessToken) return;

    setUploadingFile(true);
    setErrorMsg(null);
    setStatusNotice(null);
    try {
      const uploaded = await uploadFileToDrive(workspaceAccessToken, file);
      setStatusNotice({
        message: `Uploaded "${uploaded.name}" to Google Drive.`,
        link: uploaded.webViewLink,
        linkLabel: 'Open in Google Drive',
      });
      await fetchDriveFiles();
    } catch (err) {
      handleWorkspaceError(err, 'Failed to upload file to Google Drive.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSelectReportTemplate = (reportId: string) => {
    setSelectedReportId(reportId);
    const found = reports.find((r) => r.id === reportId);
    if (!found) return;
    const formatted = formatCivicReportDocContent(found);
    setNewDocTitle(formatted.title);
    setNewDocBody(formatted.bodyText);
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceAccessToken) return;
    if (!newDocTitle.trim()) {
      setErrorMsg('Enter a title for the new Google Doc.');
      return;
    }

    setCreatingDoc(true);
    setErrorMsg(null);
    setStatusNotice(null);
    try {
      const created = await createGoogleDoc(workspaceAccessToken, newDocTitle, newDocBody);
      setStatusNotice({
        message: `Created Google Doc "${created.title}".`,
        link: created.webViewLink,
        linkLabel: 'Open in Google Docs',
      });
      const detail = await getGoogleDoc(workspaceAccessToken, created.documentId);
      setSelectedDoc(detail);
      setSelectedDocLink(created.webViewLink);
      setNewDocTitle('');
      setNewDocBody('');
      setSelectedReportId('');
      await fetchDriveFiles();
    } catch (err) {
      handleWorkspaceError(err, 'Unable to create Google Doc.');
    } finally {
      setCreatingDoc(false);
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingAction || !workspaceAccessToken) return;
    setMutationBusy(true);
    setErrorMsg(null);
    setStatusNotice(null);

    try {
      if (pendingAction.kind === 'rename') {
        const updated = await renameDriveFile(
          workspaceAccessToken,
          pendingAction.fileId,
          pendingAction.newName
        );
        setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        if (selectedDoc?.documentId === updated.id) {
          setSelectedDoc((prev) => (prev ? { ...prev, title: updated.name } : prev));
        }
        setRenameDraftId(null);
        setRenameDraftName('');
        setStatusNotice({
          message: `Renamed file to "${updated.name}".`,
          link: updated.webViewLink,
          linkLabel: 'Open in Google Drive',
        });
      } else if (pendingAction.kind === 'delete') {
        await deleteDriveFile(workspaceAccessToken, pendingAction.fileId);
        setFiles((prev) => prev.filter((f) => f.id !== pendingAction.fileId));
        if (selectedDoc?.documentId === pendingAction.fileId) {
          setSelectedDoc(null);
          setSelectedDocLink('');
        }
        setStatusNotice({
          message: `Deleted "${pendingAction.fileName}" from Google Drive.`,
        });
      } else if (pendingAction.kind === 'append') {
        const updatedDoc = await appendGoogleDocText(
          workspaceAccessToken,
          pendingAction.documentId,
          pendingAction.addition
        );
        setSelectedDoc(updatedDoc);
        setAppendInput('');
        setStatusNotice({
          message: `Appended field update to "${updatedDoc.title}".`,
          link: `https://docs.google.com/document/d/${updatedDoc.documentId}/edit`,
          linkLabel: 'Open in Google Docs',
        });
        await fetchDriveFiles();
      }
      setPendingAction(null);
    } catch (err) {
      setPendingAction(null);
      handleWorkspaceError(err, 'Google Workspace operation failed.');
    } finally {
      setMutationBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Google Drive & Docs Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Archive civic evidence in Google Drive, generate formal complaint Google Docs, and
            append verified field updates directly from CityFix.
          </p>
        </div>

        {workspaceAccessToken && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConnect}
              disabled={authBusy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Consent
            </button>
            <button
              type="button"
              onClick={() => {
                clearWorkspaceToken();
                setStatusNotice(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect Session Token
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-700" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="rounded p-0.5 text-red-600 hover:bg-red-100"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>{statusNotice.message}</span>
          </div>
          {sanitizeExternalHref(statusNotice.link) && (
            <a
              href={sanitizeExternalHref(statusNotice.link)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline whitespace-nowrap"
            >
              {statusNotice.linkLabel ?? 'Open'}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {!workspaceAccessToken ? (
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center max-w-2xl mx-auto space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-[#0f4c81]">
            <FolderOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-slate-900">
              Connect Google Drive & Google Docs
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Authorize CityFix to access your Google Drive files and Google Docs. Export civic
              reports into editable Google Docs, upload field evidence, and manage case files.
              Access tokens remain strictly in memory for your active browser session.
            </p>
            {session?.email && (
              <p className="text-xs text-slate-500">
                Signed-in Firebase identity: <span className="font-mono">{session.email}</span>
              </p>
            )}
          </div>
          <div className="pt-2 flex justify-center">
            <GoogleSignInButton
              onClick={handleConnect}
              disabled={authBusy}
              label={authBusy ? 'Authorizing...' : 'Sign in with Google'}
            />
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Drive Explorer */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Google Drive Explorer
                </h2>
                <p className="text-xs text-slate-500">
                  Browse, upload, rename, or remove documents in your Google Drive
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={uploadInputRef}
                  type="file"
                  onChange={handleUploadChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchDriveFiles()}
                  disabled={filesLoading}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  aria-label="Refresh Google Drive files"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${filesLoading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchDriveFiles();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Drive by file name..."
                  className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={filesLoading}
                className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0c3d68] whitespace-nowrap"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'All Drive Items' },
                  { id: 'docs', label: 'Google Docs Only' },
                  { id: 'files', label: 'Other Files' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    filterMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filesLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-16 animate-pulse rounded-md border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                <p className="text-xs font-medium text-slate-700">
                  No Google Drive files matched your current query.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Create a new Google Doc on the right or upload an evidence file.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto pr-1">
                {files.map((file) => {
                  const isDoc = file.mimeType === 'application/vnd.google-apps.document';
                  const isSelected = selectedDoc?.documentId === file.id;
                  const isRenaming = renameDraftId === file.id;

                  return (
                    <div
                      key={file.id}
                      className={`py-3 first:pt-0 last:pb-0 space-y-2 ${
                        isSelected ? 'bg-sky-50/50 -mx-2 px-2 rounded-md' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={renameDraftName}
                                onChange={(e) => setRenameDraftName(e.target.value)}
                                aria-label="New file name"
                                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-[#0f4c81] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!renameDraftName.trim()) return;
                                  setPendingAction({
                                    kind: 'rename',
                                    fileId: file.id,
                                    currentName: file.name,
                                    newName: renameDraftName.trim(),
                                  });
                                }}
                                className="rounded bg-[#0f4c81] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0c3d68]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameDraftId(null);
                                  setRenameDraftName('');
                                }}
                                className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {file.name}
                            </p>
                          )}

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span
                              className={`font-medium ${
                                isDoc ? 'text-[#0f4c81]' : 'text-slate-600'
                              }`}
                            >
                              {isDoc
                                ? 'Google Doc'
                                : file.mimeType.split('/').pop()?.toUpperCase() || 'FILE'}
                            </span>
                            {file.modifiedTime && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {new Date(file.modifiedTime).toLocaleDateString()}
                                </span>
                              </>
                            )}
                            {file.size && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {(Number(file.size) / 1024).toFixed(1)} KB
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isDoc && (
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(file)}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <FileText className="h-3 w-3" />
                              Inspect
                            </button>
                          )}
                          {sanitizeExternalHref(file.webViewLink) && (
                            <a
                              href={sanitizeExternalHref(file.webViewLink)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${file.name} in Google`}
                              className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setRenameDraftId(file.id);
                              setRenameDraftName(file.name);
                            }}
                            aria-label={`Rename ${file.name}`}
                            className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                kind: 'delete',
                                fileId: file.id,
                                fileName: file.name,
                              })
                            }
                            aria-label={`Delete ${file.name}`}
                            className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Google Docs Studio */}
          <div className="space-y-6 lg:col-span-6">
            {/* Create Google Doc */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-[#0f4c81]" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Create Complaint or Brief in Google Docs
                  </h2>
                  <p className="text-xs text-slate-500">
                    Start from an existing CityFix report or write a custom civic document
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateDoc} className="space-y-3">
                {reports.length > 0 && (
                  <div>
                    <label
                      htmlFor="doc-report-prefill"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Pre-fill from Civic Report (Optional)
                    </label>
                    <select
                      id="doc-report-prefill"
                      value={selectedReportId}
                      onChange={(e) => handleSelectReportTemplate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#0f4c81] focus:outline-none"
                    >
                      <option value="">-- Select a report to pre-populate --</option>
                      {reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id} · {r.title} ({r.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="new-doc-title"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Document Title
                  </label>
                  <input
                    id="new-doc-title"
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="e.g. Ward-01 Road Collapse Inspection Brief"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-doc-body"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Document Body
                  </label>
                  <textarea
                    id="new-doc-body"
                    rows={5}
                    value={newDocBody}
                    onChange={(e) => setNewDocBody(e.target.value)}
                    placeholder="Enter field observations, coordinates, SHA-256 evidence digest, or formal complaint text..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingDoc}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0c3d68] disabled:opacity-60 whitespace-nowrap"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    {creatingDoc ? 'Creating Doc...' : 'Create Google Doc'}
                  </button>
                </div>
              </form>
            </section>

            {/* Inspect & Append Google Doc */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Google Doc Inspector & Field Addendum
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select any Google Doc on the left to inspect text and append verified updates
                  </p>
                </div>
                {selectedDoc && sanitizeExternalHref(selectedDocLink) && (
                  <a
                    href={sanitizeExternalHref(selectedDocLink)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    Open Doc
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {docLoading ? (
                <div className="h-32 animate-pulse rounded-md border border-slate-200 bg-slate-50" />
              ) : !selectedDoc ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
                  Click <strong>Inspect</strong> on any Google Doc in your Drive list to view its
                  contents and append notes.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{selectedDoc.title}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 break-all">
                      ID: {selectedDoc.documentId}
                    </p>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedDoc.bodyText.trim() || '(Empty Google Doc)'}
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label
                      htmlFor="append-doc-text"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Append Field Update / Addendum
                    </label>
                    <textarea
                      id="append-doc-text"
                      rows={3}
                      value={appendInput}
                      onChange={(e) => setAppendInput(e.target.value)}
                      placeholder="Add timestamped inspection update, responder notes, or resolution verification..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!appendInput.trim()}
                        onClick={() => {
                          if (!appendInput.trim()) return;
                          setPendingAction({
                            kind: 'append',
                            documentId: selectedDoc.documentId,
                            documentTitle: selectedDoc.title,
                            addition: appendInput.trim(),
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#0c3d68] disabled:opacity-50 whitespace-nowrap"
                      >
                        Append to Google Doc
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Mandatory Custom Confirmation Modal for Mutating/Destructive Workspace Actions */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workspace-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 id="workspace-confirm-title" className="text-sm font-semibold text-slate-900">
                {pendingAction.kind === 'delete'
                  ? 'Confirm Google Drive Deletion'
                  : pendingAction.kind === 'rename'
                  ? 'Confirm Google Drive Rename'
                  : 'Confirm Google Doc Update'}
              </h3>
              <button
                type="button"
                onClick={() => !mutationBusy && setPendingAction(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close confirmation dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
              {pendingAction.kind === 'delete' && (
                <>
                  <p>
                    Are you sure you want to permanently delete{' '}
                    <strong className="text-slate-900">{pendingAction.fileName}</strong> from
                    your Google Drive?
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 break-all">
                    File ID: {pendingAction.fileId}
                  </p>
                </>
              )}

              {pendingAction.kind === 'rename' && (
                <>
                  <p>
                    Confirm renaming{' '}
                    <strong className="text-slate-900">{pendingAction.currentName}</strong> to{' '}
                    <strong className="text-slate-900">{pendingAction.newName}</strong>.
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 break-all">
                    File ID: {pendingAction.fileId}
                  </p>
                </>
              )}

              {pendingAction.kind === 'append' && (
                <>
                  <p>
                    Confirm appending the following text to Google Doc{' '}
                    <strong className="text-slate-900">{pendingAction.documentTitle}</strong>:
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 whitespace-pre-wrap">
                    {pendingAction.addition}
                  </div>
                  <p className="font-mono text-[11px] text-slate-500 break-all">
                    Document ID: {pendingAction.documentId}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
              <button
                type="button"
                disabled={mutationBusy}
                onClick={() => setPendingAction(null)}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutationBusy}
                onClick={handleConfirmMutation}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-60 ${
                  pendingAction.kind === 'delete'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#0f4c81] hover:bg-[#0c3d68]'
                }`}
              >
                {mutationBusy
                  ? 'Applying...'
                  : pendingAction.kind === 'delete'
                  ? 'Delete File'
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDocsView;
