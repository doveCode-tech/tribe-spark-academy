import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SearchBarProps {
  onResults?: (results: any[]) => void;
  placeholder?: string;
}

export function SearchBar({ onResults, placeholder = "Search courses, lessons..." }: SearchBarProps) {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (term: string) => {
    if (!term.trim() || !userProfile) return;
    
    setIsSearching(true);
    try {
      const results: any[] = [];

      // Search courses
      const { data: courses } = await supabase
        .from('courses')
        .select('*')
        .ilike('title', `%${term}%`);
      
      if (courses) {
        results.push(...courses.map(c => ({ ...c, type: 'course' })));
      }

      // Search lessons if user has appropriate access
      if (userProfile.role !== 'student') {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('*, courses(title)')
          .ilike('title', `%${term}%`);
        
        if (lessons) {
          results.push(...lessons.map(l => ({ ...l, type: 'lesson' })));
        }
      }

      // Search users if admin/ultimate tutor
      if (userProfile.role === 'admin' || userProfile.role === 'ultimate_tutor') {
        const { data: users } = await supabase
          .from('users')
          .select('*')
          .or(`name.ilike.%${term}%,email.ilike.%${term}%,username.ilike.%${term}%`);
        
        if (users) {
          results.push(...users.map(u => ({ ...u, type: 'user' })));
        }
      }

      onResults?.(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [userProfile, onResults]);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    if (value.trim().length >= 2) {
      handleSearch(value);
    } else if (value.trim().length === 0) {
      onResults?.([]);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        placeholder={placeholder}
        className="pl-10 w-64"
        value={searchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        disabled={isSearching}
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}