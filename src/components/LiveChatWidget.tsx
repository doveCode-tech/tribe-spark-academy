import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X, ChevronDown, HelpCircle, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveChat } from "./LiveChat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { soundEffects } from "@/utils/audio";

export function LiveChatWidget() {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isLiveChatRoute = location.pathname === "/live-chat" || location.pathname.startsWith("/chat");
  const isStudent = (userProfile?.role || "").toLowerCase() === "student";

  // Listen for real-time incoming messages to notify user when widget is minimized
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`widget-unread-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as any;
          const isForMe =
            newMsg.sender_id !== user.id &&
            (newMsg.recipient_id === user.id || !newMsg.recipient_id);
          if (isForMe) {
            soundEffects.playChime();
            if (!isOpen) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isOpen]);

  const handleToggle = () => {
    if (!isOpen) setUnreadCount(0);
    setIsOpen(!isOpen);
  };

  if (!user || isLiveChatRoute) return null;

  // ── Button styles ──────────────────────────────────────────────────────────
  // Student  → green "Need Help?" with ? icon
  // Staff    → dark purple "Offer Help" with lavender text
  const triggerBtn = isStudent ? (
    <Button
      onClick={handleToggle}
      className="h-12 px-5 rounded-full shadow-lg font-semibold flex items-center gap-2 transition-transform hover:scale-105 bg-green-500 hover:bg-green-600 text-white"
    >
      {isOpen ? (
        <>
          <X className="w-5 h-5" />
          <span>Close</span>
        </>
      ) : (
        <>
          <HelpCircle className="w-5 h-5" />
          <span>Need Help?</span>
        </>
      )}
    </Button>
  ) : (
    <Button
      onClick={handleToggle}
      className="h-12 px-5 rounded-full shadow-lg font-semibold flex items-center gap-2 transition-transform hover:scale-105"
      style={{
        backgroundColor: "#3b0764",
        color: "#d8b4fe",
      }}
    >
      {isOpen ? (
        <>
          <X className="w-5 h-5" />
          <span style={{ color: "#d8b4fe" }}>Close</span>
        </>
      ) : (
        <>
          <HandHeart className="w-5 h-5" />
          <span style={{ color: "#d8b4fe" }}>Offer Help</span>
        </>
      )}
    </Button>
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="mb-3 w-[92vw] sm:w-[520px] md:w-[680px] h-[560px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden border border-border bg-card flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Top Bar */}
          <div className={`px-4 py-2.5 flex items-center justify-between shadow-sm ${
            isStudent ? "bg-green-600" : "bg-[#3b0764]"
          }`}>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <span className={`font-semibold text-sm ${isStudent ? "text-white" : "text-purple-200"}`}>
                {isStudent ? "Tutor Support" : "STEMTribe Live Chat"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-white/20 rounded-md text-white"
                onClick={() => setIsOpen(false)}
                title="Minimize"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-white/20 rounded-md text-white"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Embedded Live Chat */}
          <div className="flex-1 overflow-hidden">
            <LiveChat isWidget={true} />
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="relative">
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 z-10 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center shadow animate-bounce">
              {unreadCount}
            </span>
          )}
          {triggerBtn}
        </div>
      )}
    </div>
  );
}
