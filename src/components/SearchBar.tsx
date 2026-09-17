import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, BookOpen, FileText, User, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SearchResultItem {
  id: string;
  type: "course" | "lesson" | "user";
  title: string;
  subtitle?: string;
  meta?: string;
  course_id?: string;
}

interface SearchBarProps {
  onResults?: (results: any[]) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ onResults, placeholder = "Search courses, lessons...", className = "w-72 md:w-80" }: SearchBarProps) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const executeSearch = useCallback(
    async (term: string) => {
      const clean = term.trim();
      if (!clean) {
        setResults([]);
        setIsOpen(false);
        onResults?.([]);
        return;
      }

      setIsSearching(true);
      try {
        const aggregated: SearchResultItem[] = [];

        // 1. Search Courses
        const { data: courses } = await supabase
          .from("courses")
          .select("id, title, description, category")
          .or(`title.ilike.%${clean}%,description.ilike.%${clean}%,category.ilike.%${clean}%`)
          .limit(6);

        if (courses) {
          courses.forEach((c) => {
            aggregated.push({
              id: c.id,
              type: "course",
              title: c.title,
              subtitle: c.description ? c.description.slice(0, 70) + (c.description.length > 70 ? "..." : "") : undefined,
              meta: c.category || "Course",
              course_id: c.id,
            });
          });
        }

        // 2. Search Lessons
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, title, description, course_id, courses(title)")
          .ilike("title", `%${clean}%`)
          .limit(6);

        if (lessons) {
          lessons.forEach((l: any) => {
            aggregated.push({
              id: l.id,
              type: "lesson",
              title: l.title,
              subtitle: l.courses?.title ? `Course: ${l.courses.title}` : undefined,
              meta: "Lesson",
              course_id: l.course_id,
            });
          });
        }

        // 3. Search Users if admin, tutor, or ultimate tutor
        const isStaff = userProfile && (userProfile.role === "admin" || userProfile.role === "tutor" || userProfile.role === "ultimate_tutor" || (userProfile.role_level ?? 0) >= 2);
        if (isStaff) {
          const { data: users } = await supabase
            .from("users")
            .select("id, name, email, role")
            .or(`name.ilike.%${clean}%,email.ilike.%${clean}%,username.ilike.%${clean}%`)
            .limit(5);

          if (users) {
            users.forEach((u) => {
              aggregated.push({
                id: u.id,
                type: "user",
                title: u.name || u.email || "Unnamed User",
                subtitle: u.email || undefined,
                meta: u.role || "User",
              });
            });
          }
        }

        setResults(aggregated);
        setIsOpen(true);
        setSelectedIndex(-1);
        onResults?.(aggregated);
      } catch (error) {
        console.error("Global search error:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [userProfile, onResults]
  );

  // Debounce input change
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const timer = setTimeout(() => {
        executeSearch(searchTerm);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [searchTerm, executeSearch]);

  const handleSelectResult = (item: SearchResultItem) => {
    setIsOpen(false);
    setSearchTerm("");
    if (item.type === "course") {
      navigate(`/courses/${item.id}`);
    } else if (item.type === "lesson") {
      if (item.course_id) {
        navigate(`/courses/${item.course_id}`);
      } else {
        navigate(`/lesson/${item.id}`);
      }
    } else if (item.type === "user") {
      navigate(`/portfolio/${item.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const coursesList = results.filter((r) => r.type === "course");
  const lessonsList = results.filter((r) => r.type === "lesson");
  const usersList = results.filter((r) => r.type === "user");

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder={placeholder}
          className="pl-9 pr-8 h-9 text-sm bg-background/80 focus:bg-background transition-colors rounded-lg border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && searchTerm.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {isSearching ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : searchTerm ? (
          <button
            onClick={() => {
              setSearchTerm("");
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Popover Results Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-xl z-50 overflow-hidden max-h-[440px] flex flex-col backdrop-blur-sm animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-2 border-b border-border/60 bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground font-medium px-3">
            <span>Search Results ({results.length})</span>
            <span className="text-[10px]">Use ↑↓ to navigate, Enter to select</span>
          </div>

          <div className="overflow-y-auto flex-1 p-1.5 space-y-3">
            {results.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <p>No matches found for "{searchTerm}"</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">Try searching for a course or lesson topic</p>
              </div>
            ) : (
              <>
                {/* Courses Section */}
                {coursesList.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2.5 py-1 flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3 text-primary" />
                      Courses
                    </div>
                    <div className="space-y-0.5">
                      {coursesList.map((item) => {
                        const globalIdx = results.indexOf(item);
                        const isSelected = selectedIndex === globalIdx;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4">
                                {item.meta}
                              </Badge>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lessons Section */}
                {lessonsList.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2.5 py-1 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-blue-500" />
                      Lessons
                    </div>
                    <div className="space-y-0.5">
                      {lessonsList.map((item) => {
                        const globalIdx = results.indexOf(item);
                        const isSelected = selectedIndex === globalIdx;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-4">
                                Lesson
                              </Badge>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Users Section (for Staff) */}
                {usersList.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2.5 py-1 flex items-center gap-1.5">
                      <User className="w-3 h-3 text-purple-500" />
                      Users & Students
                    </div>
                    <div className="space-y-0.5">
                      {usersList.map((item) => {
                        const globalIdx = results.indexOf(item);
                        const isSelected = selectedIndex === globalIdx;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-semibold truncate">{item.title}</p>
                              {item.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] font-normal capitalize px-1.5 py-0 h-4">
                                {item.meta}
                              </Badge>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}