import { useState, useCallback } from "react";
import { ChatRoom, Message } from "@/types/replychain";
import { chatRooms as initialRooms, messagesByRoom as initialMessages, currentUser } from "@/data/mockData";
import { RoomSidebar } from "@/components/RoomSidebar";
import { ChatView } from "@/components/ChatView";
import { MobileNav } from "@/components/MobileNav";

// Helper to recursively update vote in message tree
const updateVoteInTree = (messages: Message[], messageId: string, vote: 1 | -1): Message[] => {
  return messages.map(msg => {
    if (msg.id === messageId) {
      const newVote = msg.userVote === vote ? 0 : vote;
      const diff = newVote - msg.userVote;
      return { ...msg, userVote: newVote as 1 | -1 | 0, votesCount: msg.votesCount + diff };
    }
    if (msg.children.length > 0) {
      return { ...msg, children: updateVoteInTree(msg.children, messageId, vote) };
    }
    return msg;
  });
};

// Helper to add reply in message tree
const addReplyInTree = (messages: Message[], parentId: string, reply: Message): Message[] => {
  return messages.map(msg => {
    if (msg.id === parentId) {
      return { ...msg, children: [...msg.children, reply] };
    }
    if (msg.children.length > 0) {
      return { ...msg, children: addReplyInTree(msg.children, parentId, reply) };
    }
    return msg;
  });
};

// Flatten all messages from the tree for the flat array
const flattenMessages = (msgs: Message[]): Message[] => {
  const result: Message[] = [];
  const walk = (m: Message) => { result.push(m); m.children.forEach(walk); };
  msgs.forEach(walk);
  return result;
};

const Index = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms);
  const [activeRoomId, setActiveRoomId] = useState(initialRooms[0].id);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>(initialMessages);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeRoom = rooms.find(r => r.id === activeRoomId)!;
  const roomMessages = allMessages[activeRoomId] || [];
  

  const handleVote = useCallback((messageId: string, vote: 1 | -1) => {
    setAllMessages(prev => ({
      ...prev,
      [activeRoomId]: updateVoteInTree(prev[activeRoomId] || [], messageId, vote),
    }));
  }, [activeRoomId]);

  const handleReply = useCallback((parentId: string, content: string) => {
    const reply: Message = {
      id: `m${Date.now()}`,
      chatId: activeRoomId,
      parentId,
      userId: currentUser.id,
      user: currentUser,
      content,
      votesCount: 1,
      userVote: 1,
      createdAt: new Date(),
      children: [],
    };
    setAllMessages(prev => ({
      ...prev,
      [activeRoomId]: addReplyInTree(prev[activeRoomId] || [], parentId, reply),
    }));
  }, [activeRoomId]);

  const handleNewThread = useCallback((content: string) => {
    const msg: Message = {
      id: `m${Date.now()}`,
      chatId: activeRoomId,
      parentId: null,
      userId: currentUser.id,
      user: currentUser,
      content,
      votesCount: 1,
      userVote: 1,
      createdAt: new Date(),
      children: [],
    };
    setAllMessages(prev => ({
      ...prev,
      [activeRoomId]: [msg, ...(prev[activeRoomId] || [])],
    }));
  }, [activeRoomId]);

  const handleCreateRoom = useCallback((name: string, description: string, emoji: string) => {
    const newRoom: ChatRoom = {
      id: `r${Date.now()}`,
      name,
      description: description || "New room",
      emoji,
      memberCount: 1,
      lastActivity: new Date(),
      unreadCount: 0,
    };
    setRooms(prev => [newRoom, ...prev]);
    setAllMessages(prev => ({ ...prev, [newRoom.id]: [] }));
    setActiveRoomId(newRoom.id);
  }, []);

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
        />
      </div>
      <ChatView
        room={activeRoom}
        messages={flatMessages}
        onVote={handleVote}
        onReply={handleReply}
        onNewThread={handleNewThread}
      />
    </div>
  );
};

export default Index;
