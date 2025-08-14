import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Star, Trophy, Shield, Zap, Target, Mountain, Users } from "lucide-react";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
}

interface BadgeDisplayProps {
  badges: BadgeData[];
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

const iconMap = {
  'Star': Star,
  'Trophy': Trophy,
  'Shield': Shield,
  'Zap': Zap,
  'Target': Target,
  'Mountain': Mountain,
  'Users': Users,
  'Laptop': Award,
  'Award': Award,
};

export function BadgeDisplay({ badges, size = 'md', showDescription = true }: BadgeDisplayProps) {
  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'lg': return 'w-8 h-8';
      default: return 'w-6 h-6';
    }
  };

  const getCardSize = () => {
    switch (size) {
      case 'sm': return 'p-2';
      case 'lg': return 'p-6';
      default: return 'p-4';
    }
  };

  if (badges.length === 0) {
    return (
      <div className="text-center py-6">
        <Award className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No badges earned yet</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-${size === 'sm' ? '2' : '4'} ${
      size === 'sm' ? 'grid-cols-4' : size === 'lg' ? 'grid-cols-1' : 'grid-cols-2'
    }`}>
      {badges.map((badge) => {
        const IconComponent = iconMap[badge.icon as keyof typeof iconMap] || Award;
        
        return (
          <Card
            key={badge.id}
            className={`${getCardSize()} text-center transition-all hover:scale-105 hover:shadow-lg`}
            style={{ 
              background: `linear-gradient(135deg, ${badge.color}15, ${badge.color}05)`,
              borderColor: `${badge.color}30`
            }}
          >
            <CardContent className="p-0">
              <div 
                className={`w-${size === 'sm' ? '8' : size === 'lg' ? '16' : '12'} h-${size === 'sm' ? '8' : size === 'lg' ? '16' : '12'} rounded-full mx-auto mb-2 flex items-center justify-center`}
                style={{ backgroundColor: `${badge.color}20` }}
              >
                <IconComponent 
                  className={getIconSize()} 
                  style={{ color: badge.color }}
                />
              </div>
              <h4 className={`font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                {badge.name}
              </h4>
              {showDescription && size !== 'sm' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {badge.description}
                </p>
              )}
              {badge.earned_at && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  {new Date(badge.earned_at).toLocaleDateString()}
                </Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}