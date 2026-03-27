import { MessageData } from "@/pages/Index";
import { ThreadMessage } from "./ThreadMessage";
import { ArrowLeft, Maximize2 } from "lucide-react";

interface FocusViewProps {
  message: MessageData;
  onBack: () => void;
  onVote: (messageId: string, vote: 1 | -1) => void;
  onReply: (parentId: string, content: string) => void;
  onFocus: (message: MessageData) => void;
}

export const FocusView = ({ message, onBack, onVote, onReply, onFocus }: FocusViewProps) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-primary" />
          <h2 className="font-display text-lg font-bold">Focus Mode</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
        <div className="bg-card rounded-lg p-4 border border-primary/20">
          <ThreadMessage message={message} depth={0} maxDepth={4} onVote={onVote} onReply={onReply} onFocus={onFocus} />
        </div>
      </div>
    </div>
  );
};
