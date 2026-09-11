import { useState } from "react";
import { MessageCircle, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveChat } from "./LiveChat";
import { useAuth } from "@/contexts/AuthContext";

export function LiveChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

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
      <Button
        onClick={() => setIsOpen(!isOpen)}
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
  );
}
