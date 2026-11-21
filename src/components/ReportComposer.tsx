import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  evaluateAuthorityVerification,
  getResponsibleOfficials,
  identifyJurisdiction,
} from '../data/civicDirectory';
import { SEED_IMAGE_ASSETS } from '../data/civicMedia';
import type {
  CitizenSession,
  CivicReport,
  ComplaintFormat,
  IssueCategory,
  LocalDraftReport,
  SeverityLevel,
  VerificationStatus,
} from '../types/civic';
import { WardMapPicker } from './WardMapPicker';

interface ReportComposerProps {
  session: CitizenSession | null;
  initialDraft?: LocalDraftReport | null;
  onRequireAuth: () => void;
  onReportSubmitted: (report: CivicReport) => void;
  onSaveLocalDraft: (draft: LocalDraftReport) => void;
}

const SAMPLE_EVIDENCE_PRESETS: {
  id: 'pothole' | 'streetlight' | 'waste';
  label: string;
  category: IssueCategory;
  severity: SeverityLevel;
  title: string;
  description: string;
  address: string;
  wardId: string;
  lat: number;
  lng: number;
}[] = [
  {
    id: 'pothole',
    label: 'Sample: Road Pothole',
    category: 'roads',
    severity: 'Urgent',
    title: 'Collapsed asphalt trench and deep puddle near curb',
    description:
      'Large water-filled pothole measuring roughly 1.2m across at the eastbound lane edge. Vehicles and cyclists are forced to swerve abruptly around the depression.',
    address: '214 Market Street, Civic Center',
    wardId: 'ward-01',
    lat: 12.9724,
    lng: 77.5951,
  },
  {
    id: 'streetlight',
    label: 'Sample: Broken Streetlight',
    category: 'lighting',
    severity: 'Urgent',
    title: 'Unlit municipal lamp post above pedestrian crosswalk',
    description:
      'Crosswalk luminaire at Pine Street & 4th Avenue has failed completely after dusk, leaving pedestrians in darkness near turning traffic.',
    address: 'Pine Street & 4th Ave Crosswalk',
    wardId: 'ward-02',
    lat: 12.9908,
    lng: 77.5991,
  },
  {
    id: 'waste',
    label: 'Sample: Overflowing Waste',
    category: 'waste',
    severity: 'Moderate',
    title: 'Overflowing dual municipal waste & recycling receptacles',
    description:
      'Corner waste and recycling bins have exceeded capacity for over 48 hours, with bags and cardboard spilling onto the pedestrian sidewalk.',
    address: '88 Station Plaza, Eastwood',
    wardId: 'ward-03',
    lat: 12.9746,
    lng: 77.6238,
  },
];

const VERIFICATION_STYLES: Record<
  VerificationStatus,
  { label: string; colorClass: string }
> = {
  VERIFIED: { label: 'Verified Official', colorClass: 'text-emerald-700' },
  PARTIALLY_VERIFIED: { label: 'Partially Verified', colorClass: 'text-amber-700' },
  STALE: { label: 'Cached / Stale', colorClass: 'text-slate-600' },
  UNAVAILABLE: { label: 'Unavailable', colorClass: 'text-red-700' },
};

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

export const ReportComposer: React.FC<ReportComposerProps> = ({
  session,
  initialDraft,
  onRequireAuth,
  onReportSubmitted,
  onSaveLocalDraft,
}) => {
  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [category, setCategory] = useState<IssueCategory>(
    initialDraft?.category ?? 'roads'
  );
  const [severity, setSeverity] = useState<SeverityLevel>(
    initialDraft?.severity ?? 'Moderate'
  );
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [address, setAddress] = useState(initialDraft?.address ?? '');
  const [latitude, setLatitude] = useState(initialDraft?.latitude ?? 12.9716);
  const [longitude, setLongitude] = useState(initialDraft?.longitude ?? 77.5946);
  const [explicitWardId, setExplicitWardId] = useState<string | undefined>(
    initialDraft?.wardId ?? 'ward-01'
  );

  // Evidence state with SHA-256 hash integrity
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'none'>('none');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string>('');
  const [seedImageKey, setSeedImageKey] = useState<
    'pothole' | 'streetlight' | 'waste' | undefined
  >(undefined);
  const [evidenceHash, setEvidenceHash] = useState<string>(
    initialDraft?.evidenceHash ?? ''
  );
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Multi-format Draft & Submission state
  const [complaintFormat, setComplaintFormat] = useState<ComplaintFormat>(
    initialDraft?.complaintFormat ?? 'FORMAL_LETTER'
  );
  const [draftSubject, setDraftSubject] = useState(initialDraft?.draftSubject ?? '');
  const [draftBody, setDraftBody] = useState(initialDraft?.draftBody ?? '');
  const [recommendedChannel, setRecommendedChannel] = useState('');
  const [urgencySummary, setUrgencySummary] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  const selectedWard = useMemo(
    () => identifyJurisdiction(latitude, longitude, explicitWardId),
    [latitude, longitude, explicitWardId]
  );

  const verifiedAuthorities = useMemo(() => {
    const raw = getResponsibleOfficials(selectedWard.id, category);
    return raw.map((official) =>
      evaluateAuthorityVerification(official, selectedWard.id, category)
    );
  }, [selectedWard.id, category]);

  const handleLocationChange = (lat: number, lng: number, wardOverride?: string) => {
    setLatitude(lat);
    setLongitude(lng);
    setExplicitWardId(wardOverride);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSeedImageKey(undefined);
    const arrayBuffer = await file.arrayBuffer();
    const sha256 = await computeSha256Hex(arrayBuffer);
    setEvidenceHash(sha256);

    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setMediaType('video');
      setMediaPreviewUrl(url);
      setImageBase64('');
      setImageMimeType('');
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        setMediaType('image');
        setMediaPreviewUrl(result);
        const commaIndex = result.indexOf(',');
        if (commaIndex !== -1) {
          setImageBase64(result.slice(commaIndex + 1));
          setImageMimeType(file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera capture is not supported in this browser. Use file upload instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraError(
        'Camera permission denied or unavailable. Please upload an image or video file.'
      );
    }
  };

  const handleCaptureSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const hash = await computeSha256Hex(await blob.arrayBuffer());
        setEvidenceHash(hash);
      }
    }, 'image/jpeg');
    setSeedImageKey(undefined);
    setMediaType('image');
    setMediaPreviewUrl(dataUrl);
    setImageBase64(dataUrl.split(',')[1] ?? '');
    setImageMimeType('image/jpeg');
    stopCamera();
  };

  const loadSamplePreset = async (preset: (typeof SAMPLE_EVIDENCE_PRESETS)[number]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setSeverity(preset.severity);
    setDescription(preset.description);
    setAddress(preset.address);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setExplicitWardId(preset.wardId);
    setMediaType('image');
    setSeedImageKey(preset.id);
    const assetUrl = SEED_IMAGE_ASSETS[preset.id];
    setMediaPreviewUrl(assetUrl);

    try {
      const resp = await fetch(assetUrl);
      const blob = await resp.blob();
      const sha256 = await computeSha256Hex(await blob.arrayBuffer());
      setEvidenceHash(sha256);

      const reader = new FileReader();
      reader.onload = () => {
        const resStr = typeof reader.result === 'string' ? reader.result : '';
        const idx = resStr.indexOf(',');
        if (idx !== -1) {
          setImageBase64(resStr.slice(idx + 1));
          setImageMimeType(blob.type || 'image/jpeg');
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setImageBase64('');
    }
  };

  const handleGenerateAiDraft = async () => {
    setDraftError(null);
    if (!title.trim() || !description.trim()) {
      setDraftError('Enter an issue title and description before generating a formal draft.');
      return;
    }

    setDraftLoading(true);
    try {
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          severity,
          description,
          address:
            address ||
            `${selectedWard.name} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          latitude,
          longitude,
          wardName: selectedWard.name,
          district: selectedWard.district,
          officials: verifiedAuthorities.map((v) => v.official),
          citizenName: session?.name ?? 'Verified Citizen',
          citizenContact: session?.contact ?? 'Mobile / WhatsApp Verified',
          mediaDescription:
            mediaType === 'image'
              ? 'Geotagged photograph attached by citizen.'
              : mediaType === 'video'
              ? 'Geotagged video recording attached by citizen.'
              : 'Written field observation submitted without visual media.',
          evidenceHash: evidenceHash || undefined,
          format: complaintFormat,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftError(data.error || 'Could not generate AI complaint draft.');
      } else if (data.draft) {
        setDraftSubject(data.draft.subject ?? '');
        setDraftBody(data.draft.body ?? '');
        setRecommendedChannel(data.draft.recommendedChannel ?? '');
        setUrgencySummary(data.draft.urgencySummary ?? '');
      }
    } catch {
      setDraftError('Network error while contacting AI complaint drafting service.');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleBuildTemplateDraft = () => {
    setDraftError(null);
    const catObj = ISSUE_CATEGORIES.find((c) => c.id === category);
    const authorityBlock = verifiedAuthorities
      .map(({ official }) => {
        const contact = [official.email, official.phone].filter(Boolean).join(' | ');
        return `- ${official.designation} (${official.name}) — ${official.department}${
          contact ? ` [${contact}]` : ''
        }`;
      })
      .join('\n');

    const evidenceLine =
      mediaType === 'none'
        ? 'No photographic or video attachments included.'
        : `Attached ${mediaType} evidence${
            evidenceHash ? ` | Integrity SHA-256: ${evidenceHash.slice(0, 16)}...` : ''
          }`;

    const subject = `Civic Infrastructure Complaint: ${catObj?.label ?? category} — ${selectedWard.name} (${selectedWard.code})`;
    setDraftSubject(subject);

    const locText = `${address || selectedWard.name}\nGPS Coordinates: ${latitude.toFixed(
      5
    )}, ${longitude.toFixed(5)}\nWard: ${selectedWard.code} — ${selectedWard.name} (${
      selectedWard.localBodyName
    })`;

    if (complaintFormat === 'OFFICIAL_EMAIL') {
      setDraftBody(
        `Dear Official / Representative,\n\nPlease find below a documented civic grievance requiring attention from ${
          catObj?.department ?? 'Municipal Engineering'
        }:\n\n• Issue Headline: ${title || 'Municipal Issue'}\n• Category: ${
          catObj?.label ?? category
        } (${severity})\n• Location: ${address || selectedWard.name} (GPS: ${latitude.toFixed(
          5
        )}, ${longitude.toFixed(5)})\n• Jurisdiction: ${selectedWard.code} — ${
          selectedWard.name
        }\n\nDetails:\n${
          description || '[Describe observed issue and public impact]'
        }\n\nEvidence Manifest:\n${evidenceLine}\n\nAddressed Authorities:\n${authorityBlock}\n\nRequesting timely field inspection and remediation.\n\nRegards,\n${
          session?.name ?? 'Concerned Citizen'
        }\n${session?.contact ?? ''}`
      );
    } else if (complaintFormat === 'CIVIC_CONCERN_REPORT') {
      setDraftBody(
        `=== CIVIC CONCERN FIELD REPORT ===\nCategory: ${
          catObj?.label ?? category
        } (${severity})\nTitle: ${
          title || 'Civic Issue'
        }\nLocation:\n${locText}\n\nField Observation:\n${
          description || '[Describe observed issue]'
        }\n\nIdentified Authorities & Provenance:\n${authorityBlock}\n\nEvidence Integrity:\n${evidenceLine}`
      );
    } else {
      setDraftBody(
        `To,\n${authorityBlock}\n\nSubject: ${subject}\n\nRespected Sir/Madam,\n\nI am writing as a resident to formally bring to your urgent attention a ${severity.toLowerCase()} civic infrastructure issue regarding ${
          catObj?.label.toLowerCase() ?? 'municipal services'
        } in our locality.\n\n1. ISSUE DESCRIPTION:\n${
          description || '[Describe observed issue and public impact]'
        }\n\n2. EXACT LOCATION & JURISDICTION:\n${locText}\n\n3. SUPPORTING EVIDENCE:\n${evidenceLine}\n\n4. REQUESTED CORRECTIVE ACTION:\nKindly inspect the site at the earliest and initiate necessary repair/remediation work. Please share an acknowledgment or grievance reference number for tracking.\n\nYours faithfully,\n${
          session?.name ?? 'Concerned Citizen'
        }\n${session?.contact ?? ''}`
      );
    }
    setRecommendedChannel('Official Municipal Email + Ward WhatsApp Desk');
  };

  const handleSaveOfflineDraft = () => {
    onSaveLocalDraft({
      localId: initialDraft?.localId ?? `DRAFT-${Date.now()}`,
      title: title || 'Untitled Civic Draft',
      category,
      severity,
      description,
      address,
      latitude,
      longitude,
      wardId: selectedWard.id,
      complaintFormat,
      draftSubject,
      draftBody,
      evidenceHash: evidenceHash || undefined,
      savedAt: new Date().toISOString(),
    });
    setDraftSavedNotice(true);
    setTimeout(() => setDraftSavedNotice(false), 2500);
  };

  const handleCopyDraft = async () => {
    const fullText = `Subject: ${draftSubject}\n\n${draftBody}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleDownloadDraft = () => {
    const recipientEmails = verifiedAuthorities
      .map((v) => v.official.email)
      .filter(Boolean)
      .join(', ');
    const content = `To: ${recipientEmails}\nSubject: ${draftSubject}\nWard: ${selectedWard.code} (${selectedWard.name})\nCoordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\nEvidence SHA-256: ${evidenceHash || 'None'}\n\n${draftBody}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cityfix-complaint-${selectedWard.code.toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!title.trim() || !description.trim()) {
      setSubmitError('Please provide both an issue title and description.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          severity,
          description,
          address,
          latitude,
          longitude,
          wardId: selectedWard.id,
          mediaType,
          mediaUrl: seedImageKey ? undefined : mediaPreviewUrl || undefined,
          seedImageKey,
          evidenceHash: evidenceHash || undefined,
          complaintFormat,
          citizenName: session?.name ?? 'Unverified Citizen',
          citizenContact: session?.contact ?? 'Guest Session',
          authChannel: session?.channel ?? 'Mobile SMS',
          draftSubject:
            draftSubject ||
            `[${severity.toUpperCase()}] ${title} (${selectedWard.code})`,
          draftBody: draftBody || description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitError(data.error || 'Failed to submit civic report.');
      } else if (data.report) {
        onReportSubmitted(data.report);
      }
    } catch {
      setSubmitError('Network error while submitting civic report.');
    } finally {
      setSubmitting(false);
    }
  };

  const mailtoHref = useMemo(() => {
    const to = verifiedAuthorities
      .map((v) => v.official.email)
      .filter(Boolean)
      .join(',');
    const subject = encodeURIComponent(
      draftSubject || `Civic Issue Report: ${title} (${selectedWard.code})`
    );
    const body = encodeURIComponent(draftBody || description);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [verifiedAuthorities, draftSubject, title, selectedWard.code, draftBody, description]);

  return (
    <form onSubmit={handleSubmitReport} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Report Civic Issue & Draft Formal Complaint
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Capture SHA-256 hashed visual evidence, lock ward jurisdiction, verify responsible
            authorities, and generate a formal complaint.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SAMPLE_EVIDENCE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => loadSamplePreset(preset)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {!session?.authenticated && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
          <div className="text-xs text-amber-950">
            <strong>Citizen Verification Recommended:</strong> Sign in with your mobile phone or
            WhatsApp number so authorities can follow up directly on your complaint.
          </div>
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-50 whitespace-nowrap shrink-0"
          >
            Verify Mobile / WhatsApp
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column */}
        <div className="space-y-6 xl:col-span-7">
          {/* 01. Visual Evidence */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                01. Visual Evidence & SHA-256 Integrity Hash
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Camera
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {cameraError && <p className="text-xs text-amber-700">{cameraError}</p>}

            {cameraOpen && (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-950 p-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 rounded object-cover"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0c3d68]"
                  >
                    Capture Evidence Photo
                  </button>
                </div>
              </div>
            )}

            {mediaPreviewUrl ? (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  {mediaType === 'video' ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      className="w-full max-h-64 object-cover"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl}
                      alt="Uploaded civic issue evidence"
                      referrerPolicy="no-referrer"
                      className="w-full max-h-64 object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaType('none');
                      setMediaPreviewUrl('');
                      setSeedImageKey(undefined);
                      setEvidenceHash('');
                      setImageBase64('');
                      setImageMimeType('');
                    }}
                    aria-label="Remove attached media"
                    className="absolute right-2 top-2 rounded-md bg-slate-900/75 p-1.5 text-white hover:bg-slate-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {evidenceHash && (
                  <p className="font-mono text-[11px] text-slate-500 break-all">
                    Original SHA-256 Digest: {evidenceHash}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/70 py-8 px-4 text-center transition-colors hover:border-[#0f4c81] hover:bg-sky-50/30"
              >
                <div className="flex items-center gap-2 text-slate-500">
                  <Camera className="h-5 w-5" />
                  <Video className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-slate-700">
                  Upload a photograph or short video of the municipal problem
                </p>
                <p className="text-xs text-slate-500">
                  Computes a local SHA-256 evidentiary hash automatically
                </p>
              </button>
            )}
          </section>

          {/* 02. Issue Details */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              02. Issue Details & Classification
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="issue-category"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Problem Category
                </label>
                <select
                  id="issue-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0f4c81] focus:outline-none"
                >
                  {ISSUE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="issue-severity"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Severity Level
                </label>
                <select
                  id="issue-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0f4c81] focus:outline-none"
                >
                  <option value="Low">Low — Minor Maintenance</option>
                  <option value="Moderate">Moderate — Service Disruption</option>
                  <option value="Urgent">Urgent — Public Safety Risk</option>
                  <option value="Critical">Critical — Immediate Hazard</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="issue-title"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Issue Headline
              </label>
              <input
                id="issue-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Collapsed storm drain grate at Elm St & 5th Ave"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="issue-address"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Street Address or Nearest Landmark
              </label>
              <input
                id="issue-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Opposite Central Library entrance, Market Street"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="issue-desc"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Observed Details & Community Impact
              </label>
              <textarea
                id="issue-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe exact dimensions, duration of the issue, safety risks to pedestrians or vehicles, and nearby landmarks..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
              />
            </div>
          </section>

          {/* 03. Geotagging */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              03. Automatic Geotagging & Jurisdiction Lock
            </h2>
            <p className="text-xs text-slate-500">
              {selectedWard.localBodyName} · {selectedWard.assemblyConstituency} ·{' '}
              {selectedWard.parliamentaryConstituency}
            </p>
            <WardMapPicker
              latitude={latitude}
              longitude={longitude}
              selectedWard={selectedWard}
              onLocationChange={handleLocationChange}
            />
          </section>
        </div>

        {/* Right Column: Authority Verification + Multi-Format Draft & Review */}
        <div className="space-y-6 xl:col-span-5">
          {/* 04. Authority Verification Engine Output */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  04. Verified Responsible Authorities ({selectedWard.code})
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Political & administrative officials evaluated for {selectedWard.name}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                {verifiedAuthorities.length} matched
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {verifiedAuthorities.map(
                ({ official, status, verificationReasons, freshnessLabel }) => {
                  const verStyle = VERIFICATION_STYLES[status];
                  return (
                    <div key={official.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {official.name}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${verStyle.colorClass}`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {verStyle.label}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-[#0f4c81]">
                        {official.designation}
                      </p>
                      <p className="text-xs text-slate-500">
                        {official.branch === 'POLITICAL' ? 'Political' : 'Administrative'} ·{' '}
                        {official.department} · {freshnessLabel}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        {official.email && (
                          <a
                            href={`mailto:${official.email}`}
                            className="inline-flex items-center gap-1 font-mono hover:text-[#0f4c81] hover:underline"
                          >
                            <Mail className="h-3 w-3 text-slate-400" />
                            {official.email}
                          </a>
                        )}
                        {official.phone && (
                          <a
                            href={`tel:${official.phone.replace(/[^+\d]/g, '')}`}
                            className="inline-flex items-center gap-1 font-mono tabular-nums hover:text-[#0f4c81] hover:underline"
                          >
                            <Phone className="h-3 w-3 text-slate-400" />
                            {official.phone}
                          </a>
                        )}
                        {official.sourceUrl && (
                          <a
                            href={official.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-[#0f4c81] hover:underline"
                          >
                            Source
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500">
                        {verificationReasons.slice(0, 2).join(' · ')}
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* 05. Multi-Format Draft Generator & Review */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  05. Formal Complaint Draft & Review
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose a document format, generate with AI or template, and review before
                  dispatch.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBuildTemplateDraft}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Template
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={draftLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0c3d68] disabled:opacity-60 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {draftLoading ? 'Drafting...' : 'AI Draft'}
                </button>
              </div>
            </div>

            {/* Format Segmented Control */}
            <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1">
              {(
                [
                  { id: 'FORMAL_LETTER', label: 'Formal Letter' },
                  { id: 'OFFICIAL_EMAIL', label: 'Official Email' },
                  { id: 'CIVIC_CONCERN_REPORT', label: 'Field Report' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setComplaintFormat(fmt.id)}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    complaintFormat === fmt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            {draftError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">AI Drafting Notice</p>
                  <p className="mt-0.5">{draftError}</p>
                </div>
              </div>
            )}

            {(recommendedChannel || urgencySummary) && (
              <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-950 space-y-1">
                {recommendedChannel && (
                  <p>
                    <strong>Recommended Channel:</strong> {recommendedChannel}
                  </p>
                )}
                {urgencySummary && (
                  <p>
                    <strong>Assessment:</strong> {urgencySummary}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="draft-subject"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Email / Complaint Subject Line
              </label>
              <input
                id="draft-subject"
                type="text"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="Generated subject line will appear here..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="draft-body"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Editable Formal Letter Body
              </label>
              <textarea
                id="draft-body"
                rows={10}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Click 'AI Draft' or 'Template' to synthesize your description, coordinates, SHA-256 evidence digest, and official addressees..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Note: CityFix prepares this structured complaint for your review. Sending via email
              or post does not automatically register a ticket in internal municipal ERPs unless
              acknowledged by the authority.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveOfflineDraft}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  {draftSavedNotice ? 'Saved Locally' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyDraft}
                  disabled={!draftBody && !draftSubject}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDraft}
                  disabled={!draftBody && !draftSubject}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  .txt
                </button>
                <a
                  href={mailtoHref}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0c3d68] disabled:opacity-60 whitespace-nowrap"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit Official Report'}
              </button>
            </div>

            {submitError && <p className="text-xs text-red-700">{submitError}</p>}
          </section>
        </div>
      </div>
    </form>
  );
};
