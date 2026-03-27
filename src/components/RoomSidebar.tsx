import { useState } from "react";
import { ChatRoom } from "@/types/replychain";
import { Search, Plus, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

interface RoomSidebarProps {
  rooms: ChatRoom[];
  activeRoomId: string;
  onSelectRoom: (id: string) => void;
  onCreateRoom: (name: string, description: string, emoji: string) => void;
}

export const RoomSidebar = ({ rooms, activeRoomId, onSelectRoom, onCreateRoom }: RoomSidebarProps) => {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const filtered = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (newName.trim()) {
      const emojis = ["💬", "🎯", "🌟", "🔥", "⚡", "🎨", "🧪"];
      onCreateRoom(newName.trim(), newDesc.trim(), emojis[Math.floor(Math.random() * emojis.length)]);
      setNewName("");
      setNewDesc("");
      setCreating(false);
    }
  };

  const timeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <div className="w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-6 h-6 text-primary" />
          <h1 className="font-display text-lg font-bold text-sidebar-accent-foreground">ReplyChain</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rooms..."
            className="w-full bg-sidebar-accent rounded-md pl-9 pr-3 py-2 text-sm text-sidebar-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {filtered.map(room => (
          <motion.button
            key={room.id}
            whileHover={{ x: 2 }}
            onClick={() => onSelectRoom(room.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
              activeRoomId === room.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">{room.emoji}</span>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{room.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{room.description}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">{timeAgo(room.lastActivity)}</span>
                {room.unreadCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {room.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="p-3 border-t border-sidebar-border">
        {creating ? (
          <div className="space-y-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Room name"
              className="w-full bg-sidebar-accent rounded-md px-3 py-2 text-sm text-sidebar-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-sidebar-accent rounded-md px-3 py-2 text-sm text-sidebar-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-md hover:opacity-90 transition-opacity">Create</button>
              <button onClick={() => setCreating(false)} className="flex-1 bg-secondary text-secondary-foreground text-sm py-1.5 rounded-md hover:opacity-90 transition-opacity">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground text-sm font-medium py-2 rounded-md hover:bg-secondary/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Room
          </button>
        )}
      </div>
    </div>
  );
};
