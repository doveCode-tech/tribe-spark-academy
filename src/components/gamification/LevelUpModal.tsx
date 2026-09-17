import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Star, ArrowRight, Zap } from "lucide-react";
import { LevelInfo } from "@/utils/gamification";

export function LevelUpModal() {
  const [open, setOpen] = useState(false);
  const [newLevel, setNewLevel] = useState<LevelInfo | null>(null);

  useEffect(() => {
    // Check if there is a pending levelup event in localStorage
    try {
      const raw = localStorage.getItem("stemtribe_pending_levelup");
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.newLevel && Date.now() - (data.timestamp || 0) < 60000) {
          setNewLevel(data.newLevel);
          setOpen(true);
          localStorage.removeItem("stemtribe_pending_levelup");
        }
      }
    } catch {
      // Non-blocking
    }

    const handleEvent = (e: any) => {
      if (e.detail) {
        setNewLevel(e.detail);
        setOpen(true);
        localStorage.removeItem("stemtribe_pending_levelup");
      }
    };

    window.addEventListener("stemtribe-levelup", handleEvent);
    return () => {
      window.removeEventListener("stemtribe-levelup", handleEvent);
    };
  }, []);

  if (!newLevel) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center p-6 sm:p-8 overflow-hidden relative">
        {/* Confetti / Sparkle background decorations */}
        <div className="absolute top-2 left-6 text-yellow-400 text-xl animate-bounce">✨</div>
        <div className="absolute top-6 right-8 text-yellow-400 text-2xl animate-pulse">⭐</div>
        <div className="absolute bottom-12 left-10 text-purple-400 text-lg animate-bounce">🎉</div>
        <div className="absolute bottom-8 right-8 text-pink-400 text-xl animate-pulse">🌟</div>

        <DialogHeader className="space-y-3 pt-2">
          <div className="mx-auto relative">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-2xl mx-auto border-4 animate-pulse"
              style={{
                backgroundColor: `${newLevel.color}20`,
                borderColor: newLevel.color
              }}
            >
              {newLevel.badge}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-purple-950 rounded-full p-1.5 shadow-md">
              <Sparkles className="w-5 h-5 fill-purple-950" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary animate-pulse">
              🎉 LEVEL UP ACHIEVED! 🎉
            </span>
            <DialogTitle className="text-2xl sm:text-3xl font-black text-foreground">
              You are now a Level {newLevel.level} {newLevel.title}!
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-3 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {newLevel.description}
          </p>

          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-3.5 flex items-center justify-around">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-medium">New Rank</div>
              <div className="text-sm font-bold text-primary">{newLevel.title}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-medium">Badge Unlocked</div>
              <div className="text-base font-extrabold">{newLevel.badge}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-medium">Milestone</div>
              <div className="text-sm font-bold text-green-600">Level {newLevel.level}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center pt-2">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-purple-700 hover:from-primary/90 hover:to-purple-700/90 text-white font-bold gap-2 shadow-lg h-11"
            onClick={() => setOpen(false)}
          >
            <span>Awesome! Continue Learning</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
