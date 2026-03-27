import { RoomData } from "@/pages/Index";
import { Menu, X, MessageSquare, Hash } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface MobileNavProps {
  open: boolean;
  onToggle: () => void;
  rooms: RoomData[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  memberRoomIds: Set<string>;
}

export const MobileNav = ({ open, onToggle, rooms, activeRoomId, onSelectRoom, memberRoomIds }: MobileNavProps) => {
  return (
    <>
      <button onClick={onToggle} className="md:hidden fixed top-3 left-3 z-50 p-2 bg-card border border-border rounded-md">
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onToggle} className="md:hidden fixed inset-0 bg-background/80 z-40" />
            <motion.div initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="md:hidden fixed left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border z-40 overflow-y-auto">
              <div className="p-4 pt-14 space-y-1">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <span className="font-display font-bold text-sidebar-accent-foreground">ReplyChain</span>
                </div>
                {rooms.map(room => (
                  <button key={room.id} onClick={() => { onSelectRoom(room.id); onToggle(); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeRoomId === room.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
                    <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{room.name}</span>
                    {!memberRoomIds.has(room.id) && <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded ml-auto flex-shrink-0">Join</span>}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
