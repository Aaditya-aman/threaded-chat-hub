import { useState, useCallback, useEffect } from "react";
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
  created_at: string;
  created_by: string | null;
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

export interface JoinRequest {
  id: string;
  room_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

const Index = () => {
  const { user, profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

  // Fetch rooms + membership
  useEffect(() => {
    if (!user) return;
    const fetchRooms = async () => {
      const [{ data: roomData }, { data: memberData }, { data: requestData }] = await Promise.all([
        supabase.from("chat_rooms").select("*, room_members(count)").order("created_at", { ascending: false }),
        supabase.from("room_members").select("room_id").eq("user_id", user.id),
        supabase.from("room_join_requests").select("*").eq("user_id", user.id),
      ]);

      if (memberData) {
        setMemberRoomIds(new Set(memberData.map(m => m.room_id)));
      }
      if (requestData) {
        setJoinRequests(requestData as JoinRequest[]);
      }
      if (roomData) {
        const mapped = roomData.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          created_at: r.created_at,
          created_by: r.created_by,
          memberCount: (r.room_members as any)?.[0]?.count || 0,
        }));
        setRooms(mapped);
        if (!activeRoomId && mapped.length > 0) {
          // Prefer a room user is a member of
          const memberRoom = mapped.find(r => memberData?.some(m => m.room_id === r.id));
          setActiveRoomId(memberRoom?.id || mapped[0].id);
        }
      }
      setLoadingRooms(false);
    };
    fetchRooms();
  }, [user]);

  // Fetch messages for active room (only if member)
  useEffect(() => {
    if (!activeRoomId || !user || !memberRoomIds.has(activeRoomId)) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)")
        .eq("chat_id", activeRoomId)
        .order("created_at", { ascending: true });

      const { data: votes } = await supabase
        .from("votes")
        .select("message_id, value")
        .eq("user_id", user.id);

      const voteMap = new Map<string, number>();
      votes?.forEach(v => voteMap.set(v.message_id, v.value));

      if (msgs) {
        const map = new Map<string, MessageData>();
        const roots: MessageData[] = [];

        msgs.forEach(m => {
          const profileData = Array.isArray((m as any).profiles) ? (m as any).profiles[0] : (m as any).profiles;
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
  }, [activeRoomId, user, memberRoomIds]);

  const handleVote = useCallback(async (messageId: string, vote: 1 | -1) => {
    if (!user) return;
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

    const updateTree = (msgs: MessageData[]): MessageData[] =>
      msgs.map(m => {
        if (m.id === messageId) return { ...m, userVote: newVote, votes_count: m.votes_count + diff };
        return { ...m, children: updateTree(m.children) };
      });
    setMessages(prev => updateTree(prev));

    if (newVote === 0) {
      await supabase.from("votes").delete().eq("message_id", messageId).eq("user_id", user.id);
    } else {
      await supabase.from("votes").upsert({ message_id: messageId, user_id: user.id, value: newVote }, { onConflict: "message_id,user_id" });
    }
  }, [user, messages]);

  const handleReply = useCallback(async (parentId: string, content: string) => {
    if (!user || !activeRoomId) return;
    const { data } = await supabase
      .from("messages")
      .insert({ chat_id: activeRoomId, parent_id: parentId, user_id: user.id, content, votes_count: 1 })
      .select("*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)")
      .single();

    if (data) {
      await supabase.from("votes").insert({ message_id: data.id, user_id: user.id, value: 1 });
      const profileData = Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles;
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
      .select("*, profiles!messages_user_id_profiles_fkey(display_name, username, avatar_url)")
      .single();

    if (data) {
      await supabase.from("votes").insert({ message_id: data.id, user_id: user.id, value: 1 });
      const profileData = Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles;
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

  const handleCreateRoom = useCallback(async (name: string, description: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_rooms")
      .insert({ name, description, created_by: user.id })
      .select()
      .single();

    if (data) {
      await supabase.from("room_members").insert({ room_id: data.id, user_id: user.id });
      const newRoom: RoomData = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        created_at: data.created_at,
        created_by: data.created_by,
        memberCount: 1,
      };
      setRooms(prev => [newRoom, ...prev]);
      setMemberRoomIds(prev => new Set([...prev, data.id]));
      setActiveRoomId(data.id);
    }
  }, [user]);

  const handleRequestJoin = useCallback(async (roomId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("room_join_requests")
      .insert({ room_id: roomId, user_id: user.id })
      .select()
      .single();
    if (data) {
      setJoinRequests(prev => [...prev, data as JoinRequest]);
    }
  }, [user]);

  const handleApproveRequest = useCallback(async (requestId: string, approved: boolean) => {
    const status = approved ? "approved" : "rejected";
    await supabase.from("room_join_requests").update({ status }).eq("id", requestId);

    if (approved) {
      const req = joinRequests.find(r => r.id === requestId) || 
        (await supabase.from("room_join_requests").select("*").eq("id", requestId).single()).data;
      if (req) {
        await supabase.from("room_members").insert({ room_id: (req as any).room_id, user_id: (req as any).user_id });
      }
    }

    // Refresh requests for this room
    setJoinRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
  }, [joinRequests]);

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const isMember = activeRoomId ? memberRoomIds.has(activeRoomId) : false;
  const activeRoomRequest = activeRoomId ? joinRequests.find(r => r.room_id === activeRoomId) : null;

  // Get pending requests for rooms the current user owns
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  useEffect(() => {
    if (!user || !activeRoom) return;
    if (activeRoom.created_by !== user.id) { setPendingRequests([]); return; }
    const fetchPending = async () => {
      const { data } = await supabase
        .from("room_join_requests")
        .select("*")
        .eq("room_id", activeRoom.id)
        .eq("status", "pending");
      setPendingRequests((data as JoinRequest[]) || []);
    };
    fetchPending();
  }, [activeRoom, user, joinRequests]);

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
        memberRoomIds={memberRoomIds}
      />
      <div className="hidden md:flex">
        <RoomSidebar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onCreateRoom={handleCreateRoom}
          profile={profile}
          onSignOut={signOut}
          memberRoomIds={memberRoomIds}
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
          isMember={isMember}
          joinRequest={activeRoomRequest}
          onRequestJoin={() => handleRequestJoin(activeRoom.id)}
          pendingRequests={pendingRequests}
          onApproveRequest={handleApproveRequest}
          isOwner={activeRoom.created_by === user?.id}
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
