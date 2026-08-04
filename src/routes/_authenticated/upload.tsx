import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/queries";
import { UploadCloud, Video as VideoIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

const SPARKS_PER_MB = 3;
/** Whole megabytes only — a 3.9 MB file counts as 3 MB (minimum 1 MB). */
function billedMb(bytes: number) {
  return Math.max(1, Math.floor(bytes / 1048576));
}

function UploadPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const maxMb = me?.max_upload_mb ?? 60;
  const balance = me?.sparks ?? 0;
  const mb = file ? billedMb(file.size) : 0;
  const cost = mb * SPARKS_PER_MB;
  const tooPoor = !!file && cost > balance;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a video");
    if (file.size > maxMb * 1024 * 1024) return toast.error(`Max ${maxMb}MB — unlock 800MB in the Shop`);
    if (tooPoor) return toast.error(`You need ${cost} 💖 to post this (you have ${balance})`);
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      // create_post charges 3 Sparks per whole MB and inserts the post atomically.
      const { error: insErr } = await supabase.rpc("create_post", {
        _video_url: path,
        _caption: caption || null,
        _bytes: file.size,
      });
      if (insErr) {
        await supabase.storage.from("posts").remove([path]);
        throw insErr;
      }
      toast.success(`Posted! −${cost} 💖`);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
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
        <p className="mt-1 text-sm text-muted-foreground">
          Share a short video with everyone. Posting costs <b className="text-primary">3 💖 per MB</b> (rounded down).
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center hover:border-primary">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="space-y-2">
                <VideoIcon className="mx-auto h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · billed as {mb} MB</p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">Choose a video</p>
                <p className="text-xs text-muted-foreground">{`MP4 up to ${maxMb}MB`}</p>
              </div>
            )}
          </label>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">Upload cost</span>
            <span className={`font-bold ${tooPoor ? "text-destructive" : "text-primary"}`}>
              {file ? `${cost} 💖` : "— "}
              <span className="ml-2 text-xs font-normal text-muted-foreground">balance {balance} 💖</span>
            </span>
          </div>

          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} placeholder="Write a caption…"
            className="w-full rounded-lg border border-border bg-input p-3 text-sm outline-none focus:border-primary min-h-24" />
          <button disabled={uploading || !file || tooPoor} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {uploading ? "Uploading…" : tooPoor ? "Not enough Sparks" : file ? `Post for ${cost} 💖` : "Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
