import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { ArrowLeft, Edit2, Save, X, Loader2, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

type Profile = Tables<"profiles">;

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { profile: myProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [postCount, setPostCount] = useState(0);

  const isOwner = myProfile?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .single();
      setProfile(data);

      if (data) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("user_id", data.user_id);
        setPostCount(count || 0);
      }
      setLoading(false);
    };
    if (username) fetchProfile();
  }, [username]);

  const startEdit = () => {
    if (!profile) return;
    setEditName(profile.display_name || "");
    setEditBio(profile.bio || "");
    setEditUsername(profile.username || "");
    setEditing(true);
    setError("");
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");

    const { error: err } = await supabase
      .from("profiles")
      .update({
        display_name: editName.trim(),
        bio: editBio.trim(),
        username: editUsername.trim().toLowerCase(),
      })
      .eq("user_id", profile.user_id);

    if (err) {
      setError(err.message.includes("unique") ? "Username already taken" : err.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setProfile(prev => prev ? { ...prev, display_name: editName.trim(), bio: editBio.trim(), username: editUsername.trim().toLowerCase() } : null);
    setEditing(false);
    setSaving(false);

    if (editUsername.trim().toLowerCase() !== username) {
      navigate(`/profile/${editUsername.trim().toLowerCase()}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">User not found</p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">Go home</button>
      </div>
    );
  }

  const initials = (profile.display_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)} placeholder="Username" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Display name" className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Bio" rows={3} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none" />
                  {error && <p className="text-destructive text-xs">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-bold text-foreground">{profile.display_name || profile.username}</h1>
                    {isOwner && (
                      <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  {profile.bio && <p className="text-sm text-foreground/80 mt-2">{profile.bio}</p>}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {postCount} posts</span>
                    <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
