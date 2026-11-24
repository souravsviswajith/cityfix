export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  trashed?: boolean;
}

export interface GoogleDocDetail {
  documentId: string;
  title: string;
  bodyText: string;
  endIndex: number;
  revisionId?: string;
}

export class WorkspaceAuthExpiredError extends Error {
  constructor(message = 'Google Workspace access token expired or missing. Please reconnect with Google.') {
    super(message);
    this.name = 'WorkspaceAuthExpiredError';
  }
}

async function parseGoogleResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (res.status === 401) {
    throw new WorkspaceAuthExpiredError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const apiErr =
      typeof data?.error?.message === 'string' ? data.error.message : fallbackMsg;
    throw new Error(apiErr);
  }
  return data as T;
}

export async function listDriveFiles(
  accessToken: string,
  options?: { query?: string; filter?: 'all' | 'docs' | 'files'; pageSize?: number }
): Promise<DriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];
  if (options?.filter === 'docs') {
    clauses.push("mimeType = 'application/vnd.google-apps.document'");
  } else if (options?.filter === 'files') {
    clauses.push("mimeType != 'application/vnd.google-apps.document'");
  }
  if (options?.query && options.query.trim()) {
    const safeQ = options.query.trim().replace(/['\\]/g, '\\$&');
    clauses.push(`name contains '${safeQ}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: String(options?.pageSize ?? 25),
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,trashed)',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await parseGoogleResponse<{ files?: DriveFileItem[] }>(
    res,
    'Unable to list Google Drive files.'
  );
  return data.files ?? [];
}

export async function uploadFileToDrive(
  accessToken: string,
  file: File,
  customName?: string
): Promise<DriveFileItem> {
  const metadata = {
    name: customName?.trim() || file.name,
    mimeType: file.type || 'application/octet-stream',
  };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  return parseGoogleResponse<DriveFileItem>(res, 'Unable to upload file to Google Drive.');
}

export async function renameDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<DriveFileItem> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,size,webViewLink`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName.trim() }),
    }
  );
  return parseGoogleResponse<DriveFileItem>(res, 'Unable to rename Google Drive file.');
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (res.status === 401) {
    throw new WorkspaceAuthExpiredError();
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Unable to delete Google Drive file.');
  }
}

interface DocsStructuralElement {
  endIndex?: number;
  paragraph?: {
    elements?: Array<{
      textRun?: { content?: string };
    }>;
  };
}

export async function getGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<GoogleDocDetail> {
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const raw = await parseGoogleResponse<{
    documentId: string;
    title: string;
    revisionId?: string;
    body?: { content?: DocsStructuralElement[] };
  }>(res, 'Unable to read Google Doc.');

  const elements = raw.body?.content ?? [];
  let text = '';
  let maxEndIndex = 1;
  for (const el of elements) {
    if (typeof el.endIndex === 'number' && el.endIndex > maxEndIndex) {
      maxEndIndex = el.endIndex;
    }
    if (el.paragraph?.elements) {
      for (const pEl of el.paragraph.elements) {
        if (pEl.textRun?.content) {
          text += pEl.textRun.content;
        }
      }
    }
  }

  return {
    documentId: raw.documentId,
    title: raw.title,
    revisionId: raw.revisionId,
    bodyText: text,
    endIndex: Math.max(1, maxEndIndex - 1),
  };
}

export async function createGoogleDoc(
  accessToken: string,
  title: string,
  bodyText: string
): Promise<{ documentId: string; title: string; webViewLink: string }> {
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title.trim() || 'CityFix Civic Document' }),
  });
  const created = await parseGoogleResponse<{
    documentId: string;
    title: string;
  }>(createRes, 'Unable to create Google Doc.');

  if (bodyText.trim()) {
    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `${bodyText.trim()}\n`,
              },
            },
          ],
        }),
      }
    );
    await parseGoogleResponse(updateRes, 'Created Google Doc, but failed to write body text.');
  }

  return {
    documentId: created.documentId,
    title: created.title,
    webViewLink: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

export async function appendGoogleDocText(
  accessToken: string,
  documentId: string,
  addition: string
): Promise<GoogleDocDetail> {
  const current = await getGoogleDoc(accessToken, documentId);
  const insertIdx = Math.max(1, current.endIndex);
  const prefix = current.bodyText.endsWith('\n') || current.bodyText === '' ? '' : '\n';

  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertIdx },
              text: `${prefix}${addition.trim()}\n`,
            },
          },
        ],
      }),
    }
  );
  await parseGoogleResponse(res, 'Unable to update Google Doc.');
  return getGoogleDoc(accessToken, documentId);
}

export function formatCivicReportDocContent(report: {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  address: string;
  wardName: string;
  district: string;
  latitude: number;
  longitude: number;
  citizenName: string;
  citizenContact: string;
  createdAt: string;
  evidenceHash?: string;
  description: string;
  draftSubject: string;
  draftBody: string;
}): { title: string; bodyText: string } {
  const title = `${report.id} — ${report.title}`;
  const bodyText = [
    `CITYFIX CIVIC ACCOUNTABILITY & COMPLAINT RECORD`,
    `================================================`,
    `Report ID: ${report.id}`,
    `Status: ${report.status}`,
    `Category: ${report.category} | Severity: ${report.severity}`,
    `Location: ${report.address}`,
    `Jurisdiction: ${report.wardName} (${report.district})`,
    `Coordinates: ${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`,
    `Submitted By: ${report.citizenName} (${report.citizenContact})`,
    `Filed At: ${new Date(report.createdAt).toLocaleString()}`,
    report.evidenceHash ? `Evidence SHA-256: ${report.evidenceHash}` : null,
    ``,
    `FIELD OBSERVATION`,
    `-----------------`,
    report.description,
    ``,
    `FORMAL COMPLAINT BRIEF`,
    `----------------------`,
    `Subject: ${report.draftSubject}`,
    ``,
    report.draftBody,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return { title, bodyText };
}

