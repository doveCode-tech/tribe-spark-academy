import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Play, Trophy, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Game {
  id: string;
  title: string;
  description: string;
  game_type: string;
  lesson_number: number;
  game_data: any;
}

interface InCourseGamesProps {
  courseId: string;
  lessonNumber: number;
}

export function InCourseGames({ courseId, lessonNumber }: InCourseGamesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [gameScores, setGameScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
    fetchScores();
  }, [courseId, lessonNumber]);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('course_id', courseId)
        .eq('lesson_number', lessonNumber)
        .order('created_at');

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('game_scores')
        .select('*')
        .eq('student_id', user?.id);

      if (error) throw error;

      const scoresMap = data?.reduce((acc, score) => {
        acc[score.game_id] = Math.max(acc[score.game_id] || 0, score.score);
        return acc;
      }, {} as Record<string, number>) || {};

      setGameScores(scoresMap);
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  const playGame = async (game: Game) => {
    // Simple game mechanics - this would be expanded with actual game logic
    const randomScore = Math.floor(Math.random() * 100) + 50; // 50-150 points
    
    try {
      const { error } = await supabase
        .from('game_scores')
        .insert({
          student_id: user?.id,
          game_id: game.id,
          score: randomScore,
          completed: true
        });

      if (error) throw error;

      toast({
        title: "Game Completed!",
        description: `You scored ${randomScore} points in ${game.title}!`,
      });

      fetchScores(); // Refresh scores
    } catch (error) {
      console.error('Error saving game score:', error);
      toast({
        title: "Error",
        description: "Failed to save game score.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (games.length === 0) {
    return null; // No games for this lesson
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gamepad2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Mini-Games</h3>
        <Badge variant="secondary">Lesson {lessonNumber}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {games.map((game) => (
          <Card key={game.id} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{game.title}</CardTitle>
                {gameScores[game.id] && (
                  <div className="flex items-center gap-1 text-sm">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold">{gameScores[game.id]}</span>
                  </div>
                )}
              </div>
              <CardDescription>{game.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">
                  {game.game_type}
                </Badge>
                <Button
                  onClick={() => playGame(game)}
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Game
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}