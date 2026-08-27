import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UploadCloud, Video as VideoIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a video");
    if (file.size > 60 * 1024 * 1024) return toast.error("Max 60MB");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("posts").insert({
        author_id: u.user.id, video_url: path, caption: caption || null,
      });
      if (insErr) throw insErr;
      toast.success("Posted!");
      nav({ to: "/feed" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg py-10 px-6">
        <h1 className="text-2xl font-bold">Post a reel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Share a short video with everyone.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center hover:border-primary">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="space-y-2">
                <VideoIcon className="mx-auto h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Choose a video</p>
                <p className="text-xs text-muted-foreground">MP4 up to 60MB</p>
              </div>
            )}
          </label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} placeholder="Write a caption…"
            className="w-full rounded-lg border border-border bg-input p-3 text-sm outline-none focus:border-primary min-h-24" />
          <button disabled={uploading || !file} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {uploading ? "Uploading…" : "Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
