import { useState, useEffect } from "react";
import { MessageCircle, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveChat } from "./LiveChat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function LiveChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
          if (newMsg.sender_id !== user.id && (newMsg.recipient_id === user.id || !newMsg.recipient_id)) {
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
    if (!isOpen) {
      setUnreadCount(0);
    }
    setIsOpen(!isOpen);
  };

  // Only render if user is logged in
  if (!user) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="mb-3 w-[92vw] sm:w-[500px] md:w-[650px] h-[550px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden border border-border bg-card flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Top Bar with Close / Minimize button */}
          <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <span className="font-semibold text-sm">STEMTribe Live Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20 rounded-md"
                onClick={() => setIsOpen(false)}
                title="Minimize Chat"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20 rounded-md"
                onClick={() => setIsOpen(false)}
                title="Close Chat"
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

      {/* Floating Trigger Button (like EarlySTEMer "Open Chat") */}
      <div className="relative">
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1.5 -left-1.5 z-10 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center shadow animate-bounce">
            {unreadCount}
          </span>
        )}
        <Button
          onClick={handleToggle}
          className="h-12 px-5 rounded-full shadow-lg bg-[#f97316] hover:bg-[#ea580c] text-white font-medium flex items-center gap-2 transition-transform hover:scale-105"
        >
          {isOpen ? (
            <>
              <X className="w-5 h-5" />
              <span>Close Chat</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span>Open Chat</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
