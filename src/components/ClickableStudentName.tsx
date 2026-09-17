import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClickableStudentNameProps {
  studentId?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
  showAvatar?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  stopClickPropagation?: boolean;
}

export function ClickableStudentName({
  studentId,
  name,
  email,
  avatarUrl,
  className,
  showAvatar = false,
  avatarSize = "sm",
  stopClickPropagation = true,
}: ClickableStudentNameProps) {
  const navigate = useNavigate();

  const displayName = (name && name.trim()) || email || "Student";

  if (!studentId) {
    return <span className={cn("text-muted-foreground", className)}>{displayName}</span>;
  }

  const avatarDimensions =
    avatarSize === "lg" ? "h-9 w-9" : avatarSize === "md" ? "h-7 w-7" : "h-5 w-5";

  const handleClick = (e: React.MouseEvent) => {
    if (stopClickPropagation) {
      e.stopPropagation();
    }
  };

  return (
    <Link
      to={`/dashboard/students/${encodeURIComponent(studentId)}`}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors group cursor-pointer underline-offset-4 hover:underline",
        className
      )}
      title={`View profile for ${displayName}`}
    >
      {showAvatar && (
        <Avatar className={cn(avatarDimensions, "border border-border/50")}>
          <AvatarImage src={avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="truncate">{displayName}</span>
    </Link>
  );
}

export default ClickableStudentName;
