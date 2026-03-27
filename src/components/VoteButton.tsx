import { ChevronUp, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

interface VoteButtonProps {
  count: number;
  userVote: 1 | -1 | 0;
  onVote: (vote: 1 | -1) => void;
}

export const VoteButton = ({ count, userVote, onVote }: VoteButtonProps) => {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.button
        whileTap={{ scale: 1.3 }}
        onClick={() => onVote(1)}
        className={`p-0.5 rounded transition-colors ${
          userVote === 1 ? "text-upvote" : "text-muted-foreground hover:text-upvote"
        }`}
      >
        <ChevronUp className="w-4 h-4" />
      </motion.button>
      <span className={`text-xs font-bold ${
        userVote === 1 ? "text-upvote" : userVote === -1 ? "text-downvote" : "text-muted-foreground"
      }`}>
        {count}
      </span>
      <motion.button
        whileTap={{ scale: 1.3 }}
        onClick={() => onVote(-1)}
        className={`p-0.5 rounded transition-colors ${
          userVote === -1 ? "text-downvote" : "text-muted-foreground hover:text-downvote"
        }`}
      >
        <ChevronDown className="w-4 h-4" />
      </motion.button>
    </div>
  );
};
