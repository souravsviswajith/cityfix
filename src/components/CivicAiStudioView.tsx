import React, { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  Film,
  Globe,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { SEED_IMAGE_ASSETS } from '../data/civicMedia';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  webSources?: Array<{ title: string; uri: string }>;
  mapsSources?: Array<{ title: string; uri: string; snippets: string[] }>;
}

function pcmFloat32ToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PcmToAudioBuffer(
  ctx: AudioContext,
  base64: string
): AudioBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
  audioBuffer.copyToChannel(float32, 0);
  return audioBuffer;
}

export const CivicAiStudioView: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'chat' | 'voice' | 'video'>('chat');

  // === Multi-turn Chat + Search/Maps Grounding ===
  const [chatModel, setChatModel] = useState('gemini-4-hydrogen');
  const [groundingMode, setGroundingMode] = useState<'none' | 'search' | 'maps'>('none');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Ask CityFix Civic Assistant about ward accountability escalation, municipal repair codes, live public notices (Search Grounding), or nearby emergency shelters and hospitals (Maps Grounding).',
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);

  // === Audio Transcription (gemini-3.5-transcribe) ===
  const [recordingTranscribe, setRecordingTranscribe] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // === Real-Time Voice Conversation (gemini-3.8-live) ===
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState('Disconnected');
  const [liveTranscripts, setLiveTranscripts] = useState<
    Array<{ who: 'Citizen' | 'Assistant'; text: string }>
  >([]);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // === Animate Image into Video (gemini-omni-1.2-flash) ===
  const [selectedPresetKey, setSelectedPresetKey] = useState<'pothole' | 'streetlight' | 'waste' | 'custom'>('pothole');
  const [customImageBase64, setCustomImageBase64] = useState('');
  const [customImageMime, setCustomImageMime] = useState('image/jpeg');
  const [customPreviewUrl, setCustomPreviewUrl] = useState('');
  const [videoPrompt, setVideoPrompt] = useState(
    'Smooth inspection camera push showing the damaged municipal road surface and passing traffic hazards for city council review.'
  );
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);

    let latLng: { latitude: number; longitude: number } | undefined;
    if (groundingMode === 'maps' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        );
        latLng = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      } catch {
        latLng = { latitude: 12.9716, longitude: 77.5946 };
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          groundingMode,
          latLng,
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'model',
            text: `Error: ${data.error || 'Unable to generate response.'}`,
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            text: data.reply || 'No response returned.',
            modelUsed: data.modelUsed,
            webSources: data.webSources,
            mapsSources: data.mapsSources,
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Network error while reaching AI chat endpoint.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleTranscribeMic = async () => {
    if (recordingTranscribe) {
      mediaRecorderRef.current?.stop();
      setRecordingTranscribe(false);
      return;
    }

    setTranscribeStatus(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setTranscribeStatus('Microphone access not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setTranscribeStatus('Transcribing with gemini-3.5-transcribe...');
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const base64 = dataUrl.split(',')[1] ?? '';
          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: blob.type || 'audio/webm',
              }),
            });
            const data = await res.json();
            if (res.ok && data.transcript) {
              setChatInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
              setTranscribeStatus('Audio transcribed into prompt box.');
            } else {
              setTranscribeStatus(data.error || 'Transcription failed.');
            }
          } catch {
            setTranscribeStatus('Network error during audio transcription.');
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingTranscribe(true);
      setTranscribeStatus('Recording... click Mic again to transcribe.');
    } catch {
      setTranscribeStatus('Microphone permission denied.');
    }
  };

  const stopLiveSession = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore stopped sources
      }
    });
    activeSourcesRef.current = [];
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;
    nextStartTimeRef.current = 0;
    setLiveConnected(false);
    setLiveStatus('Disconnected');
  };

  const startLiveSession = async () => {
    setLiveStatus('Connecting to Gemini 3.8 Live...');
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
          setLiveConnected(true);
          setLiveStatus('Live Voice Active (16kHz in / 24kHz out)');
        }
        if (msg.error) {
          setLiveStatus(`Live Error: ${msg.error}`);
        }
        if (msg.inputTranscript) {
          setLiveTranscripts((prev) => [
            ...prev.slice(-18),
            { who: 'Citizen', text: msg.inputTranscript },
          ]);
        }
        if (msg.outputTranscript) {
          setLiveTranscripts((prev) => [
            ...prev.slice(-18),
            { who: 'Assistant', text: msg.outputTranscript },
          ]);
        }
        if (msg.interrupted) {
          activeSourcesRef.current.forEach((s) => {
            try {
              s.stop();
            } catch {
              // Ignore
            }
          });
          activeSourcesRef.current = [];
          nextStartTimeRef.current = outputCtx.currentTime;
        }
        if (msg.audio && outputCtxRef.current) {
          const buffer = base64PcmToAudioBuffer(outputCtxRef.current, msg.audio);
          const source = outputCtxRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(outputCtxRef.current.destination);
          const startAt = Math.max(
            outputCtxRef.current.currentTime,
            nextStartTimeRef.current
          );
          source.start(startAt);
          nextStartTimeRef.current = startAt + buffer.duration;
          activeSourcesRef.current.push(source);
        }
      };

      ws.onclose = () => {
        setLiveConnected(false);
        setLiveStatus('Session Ended');
      };

      const micSource = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      micSource.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (ev) => {
        if (ws.readyState === WebSocket.OPEN) {
          const base64 = pcmFloat32ToBase64(ev.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };
    } catch (err) {
      setLiveStatus(
        err instanceof Error ? err.message : 'Unable to start microphone Live stream.'
      );
      stopLiveSession();
    }
  };

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      setSelectedPresetKey('custom');
      setCustomPreviewUrl(res);
      setCustomImageBase64(res.split(',')[1] ?? '');
      setCustomImageMime(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVideo = async () => {
    setVideoError(null);
    setVideoLoading(true);
    try {
      let base64 = customImageBase64;
      let mime = customImageMime;

      if (selectedPresetKey !== 'custom') {
        const assetUrl = SEED_IMAGE_ASSETS[selectedPresetKey];
        const resp = await fetch(assetUrl);
        const blob = await resp.blob();
        mime = blob.type || 'image/jpeg';
        base64 = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => {
            const s = typeof r.result === 'string' ? r.result : '';
            resolve(s.split(',')[1] ?? '');
          };
          r.readAsDataURL(blob);
        });
      }

      const res = await fetch('/api/animate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mime,
          prompt: videoPrompt,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoError(data.error || 'Video animation failed.');
      } else if (data.videoBase64) {
        setGeneratedVideoUrl(`data:${data.mimeType || 'video/mp4'};base64,${data.videoBase64}`);
      }
    } catch {
      setVideoError('Network error during evidence video generation.');
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            CityFix AI Assistant, Voice Dispatch & Evidence Video Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Multi-turn grounded civic Q&A, real-time Gemini Live voice dispatch, audio
            transcription, and evidence-to-video briefing clips.
          </p>
        </div>

        <div className="inline-flex rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveMode('chat')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeMode === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Grounded Chat & Mic
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('voice')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeMode === 'voice'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Live Voice Dispatch
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('video')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activeMode === 'video'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            Animate Evidence Video
          </button>
        </div>
      </div>

      {activeMode === 'chat' && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Model:</label>
              <select
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                disabled={groundingMode !== 'none'}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 disabled:opacity-60"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Balanced + Grounding)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Triage)</option>
                <option value="gemini-4-neon">gemini-4-neon (Complex Policy)</option>
                <option value="gemini-4-carbon">gemini-4-carbon (Deep Civic Audit)</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 p-0.5">
              <button
                type="button"
                onClick={() => setGroundingMode('none')}
                className={`rounded px-2.5 py-1 text-[11px] font-medium ${
                  groundingMode === 'none'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Standard Chat
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode('search')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium ${
                  groundingMode === 'search'
                    ? 'bg-white text-[#0f4c81] shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <Globe className="h-3 w-3" />
                Google Search Data
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode('maps')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium ${
                  groundingMode === 'maps'
                    ? 'bg-white text-[#0f4c81] shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                <MapPin className="h-3 w-3" />
                Google Maps Data
              </button>
            </div>
          </div>

          <div className="h-96 overflow-y-auto p-5 space-y-4 bg-white">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0f4c81] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-900'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                  {msg.webSources && msg.webSources.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-2 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-600">
                        Google Search Sources:
                      </p>
                      {msg.webSources.map((s, idx) => (
                        <a
                          key={`${s.uri}-${idx}`}
                          href={s.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-[#0f4c81] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{s.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {msg.mapsSources && msg.mapsSources.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-600">
                        Google Maps Grounded Places:
                      </p>
                      {msg.mapsSources.map((m, idx) => (
                        <div key={`${m.uri}-${idx}`} className="text-xs">
                          <a
                            href={m.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#0f4c81] hover:underline"
                          >
                            <MapPin className="h-3 w-3 shrink-0" />
                            {m.title}
                          </a>
                          {m.snippets.map((sn, i) => (
                            <p key={i} className="text-[11px] text-slate-600 pl-4">
                              “{sn}”
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <p className="text-xs font-mono text-slate-500">Generating civic response...</p>
            )}
          </div>

          <form
            onSubmit={handleSendChat}
            className="border-t border-slate-200 bg-slate-50 p-3 space-y-2"
          >
            {transcribeStatus && (
              <p className="text-[11px] text-slate-600 px-1">{transcribeStatus}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTranscribeMic}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  recordingTranscribe
                    ? 'border-red-300 bg-red-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                title="Dictate via gemini-3.5-transcribe"
              >
                {recordingTranscribe ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  groundingMode === 'maps'
                    ? 'Ask about nearby hospitals, shelters, or ward offices...'
                    : groundingMode === 'search'
                    ? 'Ask about recent municipal advisories, flood alerts, or ordinances...'
                    : 'Ask about complaint drafting, official escalation, or safety...'
                }
                className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0f4c81] focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0f4c81] px-4 py-2 text-xs font-medium text-white hover:bg-[#0c3d68] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {activeMode === 'voice' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Real-Time Voice Dispatch (Gemini 3.8 Live API)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Status: <strong className="font-mono text-slate-800">{liveStatus}</strong>
              </p>
            </div>
            {liveConnected ? (
              <button
                type="button"
                onClick={stopLiveSession}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                <PhoneOff className="h-4 w-4" />
                End Live Voice Session
              </button>
            ) : (
              <button
                type="button"
                onClick={startLiveSession}
                className="inline-flex items-center gap-2 rounded-md bg-[#0f4c81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0c3d68]"
              >
                <PhoneCall className="h-4 w-4" />
                Start Live Voice Conversation
              </button>
            )}
          </div>

          <div className="h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
            {liveTranscripts.length === 0 ? (
              <p className="text-xs text-slate-500">
                Start a Live Voice session and speak directly to walk through incident reporting,
                jurisdiction escalation, or emergency guidance hands-free.
              </p>
            ) : (
              liveTranscripts.map((t, idx) => (
                <div key={idx} className="text-xs leading-relaxed">
                  <span className="font-mono font-semibold text-slate-700">{t.who}: </span>
                  <span className="text-slate-900">{t.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeMode === 'video' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Animate Civic Evidence Image into Video (Omni Flash Interactions API)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transform an evidence photograph into a 16:9 or 9:16 video briefing clip using{' '}
                <code className="font-mono">gemini-omni-1.2-flash</code>.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              Upload Photo
              <input
                type="file"
                accept="image/*"
                onChange={handleVideoImageUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['pothole', 'streetlight', 'waste'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedPresetKey(k)}
                    className={`rounded border px-2.5 py-1 text-xs font-medium capitalize ${
                      selectedPresetKey === k
                        ? 'border-[#0f4c81] bg-sky-50 text-[#0f4c81]'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                <img
                  src={
                    selectedPresetKey === 'custom'
                      ? customPreviewUrl
                      : SEED_IMAGE_ASSETS[selectedPresetKey]
                  }
                  alt="Selected civic evidence source frame"
                  className="h-48 w-full object-cover"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-700">Aspect Ratio:</label>
                {(['16:9', '9:16'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`rounded border px-2.5 py-1 font-mono text-xs ${
                      aspectRatio === ratio
                        ? 'border-[#0f4c81] bg-[#0f4c81] text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />

              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={videoLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#0f4c81] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0c3d68] disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {videoLoading ? 'Animating Video (~30-90s)...' : 'Animate Evidence into Video'}
              </button>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-center rounded-md border border-slate-200 bg-slate-50 p-4">
              {videoError && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800 mb-3">
                  {videoError}
                </div>
              )}
              {generatedVideoUrl ? (
                <div className="space-y-3">
                  <video
                    src={generatedVideoUrl}
                    controls
                    className="w-full max-h-80 rounded border border-slate-200 bg-black"
                  />
                  <a
                    href={generatedVideoUrl}
                    download="cityfix-evidence-brief.mp4"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Download MP4 Clip
                  </a>
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500">
                  Generated civic inspection video will render here for council & agency briefs.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
