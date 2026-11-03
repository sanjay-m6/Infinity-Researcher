import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface TruncatedTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  text: string;
  maxLines?: number;
  expandable?: boolean;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLines = 2,
  expandable = false,
  className = "",
  ...props
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const lineClampStyle = isExpanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      };

  return (
    <div className="w-full space-y-1">
      <p
        title={isExpanded ? undefined : text}
        style={lineClampStyle}
        className={cn("text-xs leading-relaxed text-foreground", className)}
        {...props}
      >
        {text}
      </p>
      {expandable && text.length > 120 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-medium text-primary hover:underline cursor-pointer select-none"
        >
          {isExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
};

export default TruncatedText;

