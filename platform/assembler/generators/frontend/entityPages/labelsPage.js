function buildLabelsPage({ entity, entityName, labelsCfg, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const LABELS = ${JSON.stringify(labelsCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}LabelsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dataUrls, setDataUrls] = useState<Record<string, string>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/' + ENTITY_SLUG);
        if (cancelled) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => {
    const set = new Set(selectedIds.map(String));
    return items.filter((it) => set.has(String(it.id)));
  }, [items, selectedIds]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next: Record<string, string> = {};
      for (const it of selected) {
        const raw = it?.[LABELS.value_field] ?? it?.id;
        const value = String(raw ?? '');
        try {
          next[String(it.id)] = await QRCode.toDataURL(value, { margin: 1, width: LABELS.size });
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      setDataUrls(next);
    };
    run();
    return () => { cancelled = true; };
  }, [selected.map((x) => x.id).join('|')]);

  const startScan = async () => {
    if (!LABELS.scan) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Scanner not supported',
        description:
          'Camera scanning is not available in this browser/environment. It usually requires a secure context (https or http://localhost) and camera permission. Try the latest Chrome/Edge (desktop or mobile) and open the app via http://localhost. You can still print labels without scanning.',
        variant: 'warning',
      });
      return;
    }
    try {
      setScannedValue('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const anyWindow: any = window as any;
      const detector = anyWindow.BarcodeDetector ? new anyWindow.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      setScanning(true);

      const tick = async () => {
        if (!videoRef.current) return;
        try {
          if (detector) {
            const res = await detector.detect(videoRef.current);
            if (res && res.length) {
              const value = String(res[0].rawValue || '');
              if (value) {
                setScannedValue(value);
                stopScan();
                return;
              }
            }
          } else if (ctx) {
            const w = videoRef.current.videoWidth || 0;
            const h = videoRef.current.videoHeight || 0;
            if (w && h) {
              if (canvas.width !== w) canvas.width = w;
              if (canvas.height !== h) canvas.height = h;
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code?.data) {
                setScannedValue(String(code.data));
                stopScan();
                return;
              }
            }
          }
        } catch {
          // ignore
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      toast({ title: 'Camera error', description: e?.message || 'Could not access camera', variant: 'error' });
      stopScan();
    }
  };

  const stopScan = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => stopScan();
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QR Labels</h1>
          <p className="text-sm text-slate-600">Print-friendly label sheet. Field: <span className="font-semibold">{LABELS.value_field}</span></p>
        </div>
        <div className="flex gap-2 no-print">
          <button type="button" onClick={() => window.print()} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Print
          </button>
          <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Back
          </Link>
        </div>
      </div>

      <div className="no-print rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select records</label>
          <select
            multiple
            value={selectedIds}
            onChange={(e) => setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
            className="w-full rounded border px-3 py-2 min-h-[120px]"
          >
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
          <div className="mt-1 text-xs text-slate-500">Tip: use Ctrl/⌘ to select multiple.</div>
        </div>

        {LABELS.scan ? (
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Scan (optional)</div>
                <div className="text-xs text-slate-500">Uses your PC camera if supported.</div>
              </div>
              {scanning ? (
                <button type="button" onClick={stopScan} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
                  Stop
                </button>
              ) : (
                <button type="button" onClick={startScan} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
                  Start
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <video ref={videoRef} className="w-full rounded bg-black" playsInline muted />
              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Scanned value</div>
                <div className="mt-1 break-all rounded bg-slate-50 p-2 text-xs">{scannedValue || '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(' + String(LABELS.columns) + ', minmax(0, 1fr))' }}
      >
        {selected.map((it) => (
          <div key={it.id} className="break-inside-avoid rounded-lg border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              {dataUrls[String(it.id)] ? (
                <img src={dataUrls[String(it.id)]} alt="QR" className="h-[96px] w-[96px]" />
              ) : (
                <div className="h-[96px] w-[96px] rounded bg-slate-100" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{getEntityDisplay(ENTITY_SLUG, it)}</div>
                {LABELS.text_fields && LABELS.text_fields.length ? (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {LABELS.text_fields.map((k) => (
                      <div key={k} className="truncate"><span className="font-semibold">{k}:</span> {String(it?.[k] ?? '')}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          Select at least one record to generate labels.
        </div>
      ) : null}
    </div>
  );
}
`;
}

module.exports = { buildLabelsPage };
