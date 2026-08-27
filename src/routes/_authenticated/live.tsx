import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Radio, Video, MonitorUp, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/live")({
  component: LivePage,
});

type LiveRow = {
  id: string; host_id: string; title: string | null; started_at: string;
  profiles: { username: string; display_name: string | null } | null;
};

function LivePage() {
  const nav = useNavigate();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: streams = [], refetch } = useQuery<LiveRow[]>({
    queryKey: ["streams"],
    queryFn: async () => {
      const { data } = await supabase.from("live_streams").select("*, profiles!live_streams_host_id_fkey(username, display_name)").order("started_at", { ascending: false });
      return (data ?? []) as unknown as LiveRow[];
    },
    refetchInterval: 5000,
  });

  const myStream = streams.find((s) => s.host_id === me?.id);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState<"camera" | "screen">("camera");
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    // cleanup on unmount
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function goLive() {
    if (!me) return;
    setStarting(true);
    try {
      const stream = source === "camera"
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
      const { error } = await supabase.from("live_streams").upsert({ host_id: me.id, title: title || `${me.username} is live` });
      if (error) throw error;
      toast.success("You're live!");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start stream");
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } finally {
      setStarting(false);
    }
  }

  async function stopLive() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (me) await supabase.from("live_streams").delete().eq("host_id", me.id);
    toast.success("Stream ended");
    refetch();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold">Live</h1>
        <p className="text-sm text-muted-foreground">Go live to your circle or watch friends stream.</p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Go live</h2>
          {myStream ? (
            <div className="mt-4 space-y-3">
              <div className="aspect-video overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/20 px-3 py-1 text-xs font-semibold text-destructive">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> LIVE
                </span>
                <span className="text-sm">{myStream.title}</span>
                <button onClick={stopLive} className="ml-auto flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">
                  <StopCircle className="h-4 w-4" /> End stream
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: this MVP shows your own preview and marks you as live to your friends. Full multi-viewer streaming needs a media server — coming next.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Stream title (optional)"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="flex gap-2">
                <button onClick={() => setSource("camera")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm ${source === "camera" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  <Video className="h-4 w-4" /> Webcam
                </button>
                <button onClick={() => setSource("screen")} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm ${source === "screen" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  <MonitorUp className="h-4 w-4" /> Screen
                </button>
              </div>
              <button onClick={goLive} disabled={starting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
                <Radio className="h-4 w-4" /> {starting ? "Starting…" : "Go live"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Now live</h2>
          {streams.filter((s) => s.host_id !== me?.id).length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No one is live right now.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {streams.filter((s) => s.host_id !== me?.id).map((s) => (
                <Link key={s.id} to="/profile/$username" params={{ username: s.profiles?.username ?? "" }}
                  className="group rounded-xl border border-border bg-card p-4 hover:border-primary/50">
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-transparent">
                    <Radio className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs font-semibold uppercase text-destructive">Live</span>
                    <span className="text-sm">@{s.profiles?.username}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{s.title}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
