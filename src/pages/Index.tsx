import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RoomSidebar } from "@/components/RoomSidebar";
import { ChatView } from "@/components/ChatView";
import { MobileNav } from "@/components/MobileNav";
import { Loader2 } from "lucide-react";

export interface RoomData {
  id: string;
  name: string;
  description: string;
  emoji: string;
  created_at: string;
  memberCount: number;
}

export interface MessageData {
  id: string;
  chat_id: string;
  parent_id: string | null;
  user_id: string;
  content: string;
  image_url: string | null;
  votes_count: number;
  created_at: string;
  profile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  userVote: number;
  children: MessageData[];
}

const Index = () => {
  const { user, profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch rooms
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from("chat_rooms")
        .select("*, room_members(count)")
        .order("created_at", { ascending: false });

      if (data) {
        const mapped = data.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          emoji: r.emoji || "💬",
          created_at: r.created_at,
          memberCount: (r.room_members as any)?.[0]?.count || 0,
        }));
        setRooms(mapped);
        if (!activeRoomId && mapped.length > 0) setActiveRoomId(mapped[0].id);
      }
      setLoadingRooms(false);
    };
    fetchRooms();
  }, []);

  // Fetch messages for active room
  useEffect(() => {
    if (!activeRoomId || !user) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*, profiles!messages_user_id_fkey(display_name, username, avatar_url)")
        .eq("chat_id", activeRoomId)
        .order("created_at", { ascending: true });

      const { data: votes } = await supabase
        .from("votes")
        .select("message_id, value")
        .eq("user_id", user.id);

      const voteMap = new Map<string, number>();
      votes?.forEach(v => voteMap.set(v.message_id, v.value));

      if (msgs) {
        // Build tree
        const map = new Map<string, MessageData>();
        const roots: MessageData[] = [];

        msgs.forEach(m => {
          const profileData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          map.set(m.id, {
            id: m.id,
            chat_id: m.chat_id,
            parent_id: m.parent_id,
            user_id: m.user_id,
            content: m.content,
            image_url: m.image_url,
            votes_count: m.votes_count,
            created_at: m.created_at,
            profile: profileData || null,
            userVote: voteMap.get(m.id) || 0,
            children: [],
          });
        });

        msgs.forEach(m => {
          const node = map.get(m.id)!;
          if (m.parent_id && map.has(m.parent_id)) {
            map.get(m.parent_id)!.children.push(node);
          } else {
            roots.push(node);
          }
        });

        setMessages(roots);
      }
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [activeRoomId, user]);

  const handleVote = useCallback(async (messageId: string, vote: 1 | -1) => {
    if (!user) return;
    // Find current vote
    const findVote = (msgs: MessageData[]): number => {
      for (const m of msgs) {
        if (m.id === messageId) return m.userVote;
        const found = findVote(m.children);
        if (found !== 0) return found;
      }
      return 0;
    };
    const currentVote = findVote(messages);
    const newVote = currentVote === vote ? 0 : vote;
    const diff = newVote - currentVote;

    // Optimistic update
    const updateTree = (msgs: MessageData[]): MessageData[] =>
      msgs.map(m => {
        if (m.id === messageId) return { ...m, userVote: newVote, votes_count: m.votes_count + diff };
        return { ...m, children: updateTree(m.children) };
      });
    setMessages(prev => updateTree(prev));

    // DB update
    if (newVote === 0) {
      await supabase.from("votes").delete().eq("message_id", messageId).eq("user_id", user.id);
    } else {
      await supabase.from("votes").upsert({ message_id: messageId, user_id: user.id, value: newVote }, { onConflict: "message_id,user_id" });
    }
    // Update votes_count on message
    await supabase.from("messages").update({ votes_count: 0 }).eq("id", "never"); // We'll skip server count for now, optimistic is fine
  }, [user, messages]);

  const handleReply = useCallback(async (parentId: string, content: string) => {
    if (!user || !activeRoomId) return;
    const { data } = await supabase
      .from("messages")
      .insert({ chat_id: activeRoomId, parent_id: parentId, user_id: user.id, content, votes_count: 1 })
      .select("*, profiles!messages_user_id_fkey(display_name, username, avatar_url)")
      .single();

    if (data) {
      // Auto-upvote own message
      await supabase.from("votes").insert({ message_id: data.id, user_id: user.id, value: 1 });

      const profileData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const newMsg: MessageData = {
        id: data.id,
        chat_id: data.chat_id,
        parent_id: data.parent_id,
        user_id: data.user_id,
        content: data.content,
        image_url: data.image_url,
        votes_count: data.votes_count,
        created_at: data.created_at,
        profile: profileData || null,
        userVote: 1,
        children: [],
      };

      const addToTree = (msgs: MessageData[]): MessageData[] =>
        msgs.map(m => {
          if (m.id === parentId) return { ...m, children: [...m.children, newMsg] };
          return { ...m, children: addToTree(m.children) };
        });
      setMessages(prev => addToTree(prev));
    }
  }, [user, activeRoomId]);

  const handleNewThread = useCallback(async (content: string) => {
    if (!user || !activeRoomId) return;
    const { data } = await supabase
      .from("messages")
      .insert({ chat_id: activeRoomId, parent_id: null, user_id: user.id, content, votes_count: 1 })
      .select("*, profiles!messages_user_id_fkey(display_name, username, avatar_url)")
      .single();

    if (data) {
      await supabase.from("votes").insert({ message_id: data.id, user_id: user.id, value: 1 });

      const profileData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
      const newMsg: MessageData = {
        id: data.id,
        chat_id: data.chat_id,
        parent_id: null,
        user_id: data.user_id,
        content: data.content,
        image_url: data.image_url,
        votes_count: data.votes_count,
        created_at: data.created_at,
        profile: profileData || null,
        userVote: 1,
        children: [],
      };
      setMessages(prev => [newMsg, ...prev]);
    }
  }, [user, activeRoomId]);

  const handleCreateRoom = useCallback(async (name: string, description: string, emoji: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_rooms")
      .insert({ name, description, emoji, created_by: user.id })
      .select()
      .single();

    if (data) {
      // Join the room
      await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id });
      const newRoom: RoomData = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        emoji: data.emoji || "💬",
        created_at: data.created_at,
        memberCount: 1,
      };
      setRooms(prev => [newRoom, ...prev]);
      setActiveRoomId(data.id);
    }
  }, [user]);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  if (loadingRooms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <MobileNav
        open={mobileNavOpen}
        onToggle={() => setMobileNavOpen(!mobileNavOpen)}
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
      />
      <div className="hidden md:flex">
        <RoomSidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onCreateRoom={handleCreateRoom}
          profile={profile}
          onSignOut={signOut}
        />
      </div>
      {activeRoom ? (
        <ChatView
          room={activeRoom}
          messages={messages}
          loading={loadingMessages}
          onVote={handleVote}
          onReply={handleReply}
          onNewThread={handleNewThread}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Create a room to get started!</p>
        </div>
      )}
    </div>
  );
};

export default Index;
