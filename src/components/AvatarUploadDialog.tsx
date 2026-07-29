import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { X, Upload, ZoomIn, RotateCcw } from "lucide-react";

const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const OUT_SIZE = 512;

type Fit = "cover" | "contain";

export function validateAvatarFile(file: File): string | null {
  const type = file.type;
  const nameOk = /\.(png|jpe?g|svg)$/i.test(file.name);
  if (!(ACCEPTED as readonly string[]).includes(type) && !nameOk) {
    return "Only PNG, JPG or SVG files are allowed.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`;
  }
  return null;
}

export function AvatarUploadDialog({
  open,
  onOpenChange,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fit, setFit] = useState<Fit>("cover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isSvg = file?.type === "image/svg+xml" || /\.svg$/i.test(file?.name ?? "");

  const reset = useCallback(() => {
    setFile(null);
    setImg(null);
    setSrc((s) => {
      if (s) URL.revokeObjectURL(s);
      return null;
    });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setFit("cover");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function accept(f: File | undefined | null) {
    if (!f) return;
    const err = validateAvatarFile(f);
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    setError(null);
    const url = URL.createObjectURL(f);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.onerror = () => setError("That image could not be read. Try another file.");
    image.src = url;
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setFile(f);
  }

  // draw preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    ctx.clearRect(0, 0, OUT_SIZE, OUT_SIZE);
    const iw = img.naturalWidth || OUT_SIZE;
    const ih = img.naturalHeight || OUT_SIZE;
    const base = fit === "cover" ? Math.max(OUT_SIZE / iw, OUT_SIZE / ih) : Math.min(OUT_SIZE / iw, OUT_SIZE / ih);
    const scale = base * zoom;
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(img, (OUT_SIZE - w) / 2 + offset.x, (OUT_SIZE - h) / 2 + offset.y, w, h);
  }, [img, zoom, offset, fit]);

  // drag to reposition
  useEffect(() => {
    const el = dropRef.current;
    if (!el || !img) return;
    let start: { x: number; y: number; ox: number; oy: number } | null = null;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const k = OUT_SIZE / el.clientWidth;
      setOffset({ x: start.ox + (e.clientX - start.x) * k, y: start.oy + (e.clientY - start.y) * k });
    };
    const up = () => {
      start = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [img, offset]);

  async function save() {
    if (!file) return;
    setBusy(true);
    try {
      let blob: Blob = file;
      let ext = isSvg ? "svg" : "png";
      let contentType = isSvg ? "image/svg+xml" : "image/png";
      if (!isSvg) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Preview not ready");
        blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not render the crop"))), "image/png", 0.92),
        );
      }
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (dbErr) throw dbErr;
      toast.success("Profile picture updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Profile picture</h2>
          <button onClick={() => onOpenChange(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!file && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              accept(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <Upload className="h-7 w-7 text-primary" />
            <p className="text-sm font-semibold">Drop an image or click to browse</p>
            <p className="text-xs text-muted-foreground">PNG, JPG or SVG · max 5 MB</p>
          </div>
        )}

        {file && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div
                ref={dropRef}
                className="relative h-48 w-48 touch-none overflow-hidden rounded-full border border-border bg-muted"
                style={{ cursor: isSvg ? "default" : "grab" }}
              >
                {isSvg ? (
                  <img src={src ?? ""} alt="Avatar preview" className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
                ) : (
                  <canvas ref={canvasRef} className="h-full w-full" />
                )}
              </div>
            </div>

            {!isSvg && (
              <>
                <p className="text-center text-xs text-muted-foreground">Drag the image to reposition</p>
                <div className="flex items-center gap-3">
                  <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-primary"
                    aria-label="Zoom"
                  />
                  <button
                    onClick={() => {
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="shrink-0 rounded-lg border border-border p-2"
                    aria-label="Reset crop"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2">
              {(["cover", "contain"] as Fit[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFit(f)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${
                    fit === f ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {f === "cover" ? "Fill" : "Fit"}
                </button>
              ))}
            </div>

            <p className="truncate text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024).toFixed(0)} KB{isSvg && " · SVG is saved as-is"}
            </p>

            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
                Change
              </button>
              <button
                onClick={save}
                disabled={busy || !!error}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save picture"}
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            accept(f);
          }}
        />
      </div>
    </div>
  );
}
