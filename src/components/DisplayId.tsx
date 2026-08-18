import React from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DisplayIdProps {
  type: 'character' | 'prompt' | 'user' | 'creator';
  numericId?: string;
  className?: string;
}

export default function DisplayId({ type, numericId, className = '' }: DisplayIdProps) {
  const [copied, setCopied] = React.useState(false);

  if (!numericId) return null;

  const displayId = `${type}/${numericId}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(displayId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast.success("ID copied");
        })
        .catch(() => {
          toast.error("Unable to copy ID. Please copy it manually.");
        });
    } else {
      toast.error("Unable to copy ID. Please copy it manually.");
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-800/50 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700/50 max-w-full overflow-hidden ${className}`}>
      <span className="truncate" title={displayId}>{displayId}</span>
      <button 
        onClick={handleCopy}
        className="p-1 hover:text-black dark:hover:text-white transition-colors shrink-0"
        aria-label="Copy ID"
        title="Copy ID"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}
