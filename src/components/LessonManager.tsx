// Lesson Manager Component
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Video, BookOpen, Gamepad2, Trash2, Edit, Upload, X, AlertCircle, CheckCircle2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  duration_minutes: number;
  order_index: number;
  video_urls: string[] | null;
  exercises: any;
  content_type: string;
  assignment_required: boolean;
  quiz_required: boolean;
  is_end_of_course: boolean;
  assignment_data: any;
  quiz_data: any;
}

interface LessonManagerProps {
  courseId: string;
  category: string;
}

export function LessonManager({ courseId, category }: LessonManagerProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'tutor' || userProfile?.role === 'ultimate_tutor';

  useEffect(() => {
    fetchLessons();

    // Real-time updates for lesson changes
    const lessonsChannel = supabase
      .channel('lessons-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
          filter: `course_id=eq.${courseId}`
        },
        () => fetchLessons()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lessonsChannel);
    };
  }, [courseId]);

  const fetchLessons = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (error) throw error;
      setLessons((data || []) as Lesson[]);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast({
        title: "Error",
        description: "Failed to load lessons.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCourseLessons = async () => {
    const courseContent = getCourseContent(category);
    
    try {
      const lessonsToInsert = courseContent.map((lesson, index) => ({
        course_id: courseId,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        duration_minutes: lesson.duration_minutes,
        order_index: index + 1,
        video_urls: [],
        exercises: lesson.exercises,
        content_type: 'lesson',
        assignment_required: lesson.assignment_required || false,
        quiz_required: lesson.quiz_required || false,
        is_end_of_course: lesson.is_end_of_course || false,
        assignment_data: lesson.assignment_data || null,
        quiz_data: lesson.quiz_data || null,
      }));

      const { error } = await supabase
        .from('lessons')
        .insert(lessonsToInsert);

      if (error) throw error;

      toast({
        title: "Course Lessons Created",
        description: `Created ${courseContent.length} lessons for ${category}. You can now edit and add videos.`,
      });

      fetchLessons();
    } catch (error) {
      console.error('Error creating lessons:', error);
      toast({
        title: "Error",
        description: "Failed to create lessons.",
        variant: "destructive",
      });
    }
  };

  const getCourseContent = (courseCategory: string) => {
    const cat = courseCategory?.toLowerCase() || '';
    
    if (cat.includes('python')) return getPythonLessons();
    if (cat.includes('scratch')) return getScratchLessons();
    if (cat.includes('graphic') || cat.includes('design')) return getGraphicsDesignLessons();
    if (cat.includes('robot')) return getRoboticsLessons();
    if (cat.includes('web') || cat.includes('html')) return getWebDevLessons();
    if (cat.includes('javascript') || cat.includes('js')) return getJavaScriptLessons();
    
    // Default generic lessons
    return getGenericLessons(courseCategory);
  };

  const getPythonLessons = () => [
    {
      title: "Lesson 1: Introduction to Python",
      description: "Learn what Python is and why it's one of the most popular programming languages",
      content: "Welcome to Python! Python is a powerful, easy-to-learn programming language used by professionals worldwide. In this lesson, we'll explore what makes Python special and set up your coding environment.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 1 Useful Video - What is Python?" },
        { type: "interactive", title: "Lesson 1 Exercise - Python Interactive Example", prompt: "Run your first Python print statement" },
        { type: "practice", title: "Lesson 1 Exercise - Python Mathematical Operations", prompt: "Practice basic math in Python: addition, subtraction, multiplication, division" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 1 Assignment: Python Strings", description: "Create a program that displays your name, age, and favorite hobby using print statements" },
      quiz_required: true,
      quiz_data: { title: "Lesson 1 Quiz", questions: [{ q: "What symbol is used for comments in Python?", options: ["//", "#", "/*", "--"], correct: 1 }] },
    },
    {
      title: "Lesson 2: Variables and Data Types",
      description: "Understand how to store and manage different types of data in Python",
      content: "Variables are containers for storing data values. Python has several data types including strings, integers, floats, and booleans. Let's learn how to use them!",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 2 Useful Video - Python Variables and Data Types" },
        { type: "practice", title: "Lesson 2 Exercise - Variables", prompt: "Create variables to store your personal information" },
        { type: "practice", title: "Lesson 2 Exercise - Data Types", prompt: "Practice with different data types: str, int, float, bool" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 2 Assignment: About Me", description: "Create a program using variables to introduce yourself with name, age, city, and hobbies" },
      quiz_required: true,
      quiz_data: { title: "Lesson 2 Quiz", questions: [{ q: "Which data type stores text?", options: ["int", "float", "str", "bool"], correct: 2 }] },
    },
    {
      title: "Lesson 3: Input and Output",
      description: "Learn how to get user input and display output in Python",
      content: "Interactive programs need to communicate with users. Learn how to use input() to get data from users and print() to display results.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 3 Useful Video - User Input and Output" },
        { type: "interactive", title: "Lesson 3 Exercise - Getting User Input", prompt: "Create a program that asks for the user's name and greets them" },
        { type: "practice", title: "Lesson 3 Exercise - Formatted Output", prompt: "Practice using f-strings for formatted output" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 3 Assignment: Interactive Calculator", description: "Build a simple calculator that asks for two numbers and an operation" },
      quiz_required: true,
      quiz_data: { title: "Lesson 3 Quiz", questions: [{ q: "What function gets user input?", options: ["get()", "read()", "input()", "scan()"], correct: 2 }] },
    },
    {
      title: "Lesson 4: Conditional Statements",
      description: "Make decisions in your code using if, elif, and else statements",
      content: "Programs need to make decisions! Learn how to use conditional statements to control the flow of your program based on different conditions.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 4 Useful Video - If Statements in Python" },
        { type: "interactive", title: "Lesson 4 Exercise - Simple Conditions", prompt: "Write if statements to check age eligibility" },
        { type: "practice", title: "Lesson 4 Exercise - Multiple Conditions", prompt: "Practice with elif and else for grade calculations" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 4 Assignment: Grade Checker", description: "Create a program that converts numerical grades to letter grades" },
      quiz_required: true,
      quiz_data: { title: "Lesson 4 Quiz", questions: [{ q: "What keyword checks additional conditions?", options: ["else", "elif", "elseif", "otherwise"], correct: 1 }] },
    },
    {
      title: "Lesson 5: Loops",
      description: "Automate repetitive tasks using for and while loops",
      content: "Loops allow you to repeat code efficiently. Master the for loop for iterating through sequences and the while loop for condition-based repetition.",
      duration_minutes: 60,
      exercises: [
        { type: "video", title: "Lesson 5 Useful Video - Python Loops Explained" },
        { type: "interactive", title: "Lesson 5 Exercise - For Loops", prompt: "Use for loops to iterate through a list of names" },
        { type: "practice", title: "Lesson 5 Exercise - While Loops", prompt: "Create a countdown timer using while loop" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 5 Assignment: Multiplication Table", description: "Generate a multiplication table for any number using loops" },
      quiz_required: true,
      quiz_data: { title: "Lesson 5 Quiz", questions: [{ q: "Which loop is best for a known number of iterations?", options: ["while", "for", "do-while", "repeat"], correct: 1 }] },
    },
    {
      title: "Lesson 6: Lists and Tuples",
      description: "Store collections of data using Python's list and tuple data structures",
      content: "Lists and tuples let you store multiple items in a single variable. Lists are mutable (changeable), while tuples are immutable (unchangeable).",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 6 Useful Video - Python Lists and Tuples" },
        { type: "interactive", title: "Lesson 6 Exercise - Working with Lists", prompt: "Create and manipulate a shopping list" },
        { type: "practice", title: "Lesson 6 Exercise - List Methods", prompt: "Practice append, remove, sort, and other list methods" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 6 Assignment: To-Do List App", description: "Build a simple to-do list manager with add, remove, and display features" },
      quiz_required: true,
      quiz_data: { title: "Lesson 6 Quiz", questions: [{ q: "Which is mutable?", options: ["tuple", "list", "both", "neither"], correct: 1 }] },
    },
    {
      title: "Lesson 7: Functions",
      description: "Create reusable blocks of code with functions",
      content: "Functions help organize code into reusable pieces. Learn to define functions, pass parameters, and return values.",
      duration_minutes: 60,
      exercises: [
        { type: "video", title: "Lesson 7 Useful Video - Python Functions" },
        { type: "interactive", title: "Lesson 7 Exercise - Defining Functions", prompt: "Create a greeting function with parameters" },
        { type: "practice", title: "Lesson 7 Exercise - Return Values", prompt: "Build functions that calculate and return results" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 7 Assignment: Calculator Functions", description: "Create separate functions for add, subtract, multiply, and divide operations" },
      quiz_required: true,
      quiz_data: { title: "Lesson 7 Quiz", questions: [{ q: "What keyword defines a function?", options: ["function", "def", "func", "define"], correct: 1 }] },
    },
    {
      title: "Lesson 8: Dictionaries",
      description: "Store key-value pairs using Python dictionaries",
      content: "Dictionaries store data in key-value pairs, making it easy to look up information. Perfect for storing structured data like user profiles!",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 8 Useful Video - Python Dictionaries" },
        { type: "interactive", title: "Lesson 8 Exercise - Creating Dictionaries", prompt: "Build a dictionary to store student information" },
        { type: "practice", title: "Lesson 8 Exercise - Dictionary Methods", prompt: "Practice accessing, adding, and removing dictionary items" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 8 Assignment: Contact Book", description: "Create a contact book using dictionaries with name, phone, and email" },
      quiz_required: true,
      quiz_data: { title: "Lesson 8 Quiz", questions: [{ q: "How do you access a dictionary value?", options: ["dict.key", "dict[key]", "dict->key", "dict(key)"], correct: 1 }] },
    },
    {
      title: "Lesson 9: File Handling",
      description: "Read from and write to files in Python",
      content: "Learn how to save data permanently by writing to files and reading data back. Essential for creating programs that remember information!",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 9 Useful Video - File Handling in Python" },
        { type: "interactive", title: "Lesson 9 Exercise - Reading Files", prompt: "Read and display contents of a text file" },
        { type: "practice", title: "Lesson 9 Exercise - Writing Files", prompt: "Write user input to a file" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 9 Assignment: Journal App", description: "Create a journal app that saves entries to a file with dates" },
      quiz_required: true,
      quiz_data: { title: "Lesson 9 Quiz", questions: [{ q: "What mode opens a file for writing?", options: ["r", "w", "a", "x"], correct: 1 }] },
    },
    {
      title: "Lesson 10: Final Project & Course Completion",
      description: "Apply everything you've learned in a comprehensive final project",
      content: "Congratulations on reaching the final lesson! Now it's time to showcase your Python skills by building a complete project that combines all the concepts you've learned.",
      duration_minutes: 90,
      exercises: [
        { type: "video", title: "Lesson 10 Useful Video - Project Planning and Best Practices" },
        { type: "project", title: "Lesson 10 Exercise - Final Project Planning", prompt: "Plan your final project: define features and structure" },
        { type: "review", title: "Lesson 10 Exercise - Code Review", prompt: "Review and improve your code with best practices" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 10 Final Project: Student Management System", description: "Build a complete student management system with add, view, update, delete features using all concepts learned" },
      quiz_required: true,
      quiz_data: { title: "Lesson 10 Final Quiz", questions: [{ q: "What have you accomplished?", options: ["Nothing", "Some basics", "A lot!", "I'm a Python pro!"], correct: 3 }] },
      is_end_of_course: true,
    },
  ];

  const getScratchLessons = () => [
    {
      title: "Lesson 1: Introduction to Scratch",
      description: "Discover the world of visual programming with Scratch",
      content: "Welcome to Scratch! Scratch is a visual programming language that makes coding fun and easy. Learn to create animations, games, and interactive stories!",
      duration_minutes: 40,
      exercises: [
        { type: "video", title: "Lesson 1 Useful Video - What is Scratch?" },
        { type: "interactive", title: "Lesson 1 Exercise - Exploring the Scratch Interface", prompt: "Navigate through the Scratch editor and identify key areas" },
        { type: "practice", title: "Lesson 1 Exercise - Moving Sprites", prompt: "Make your first sprite move across the stage" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 1 Assignment: My First Animation", description: "Create a simple animation with a sprite moving and saying hello" },
      quiz_required: true,
      quiz_data: { title: "Lesson 1 Quiz", questions: [{ q: "What is a sprite in Scratch?", options: ["A sound", "A character/object", "A background", "A variable"], correct: 1 }] },
    },
    {
      title: "Lesson 2: Motion and Looks",
      description: "Learn to make sprites move and change appearance",
      content: "Bring your sprites to life! Learn how to use motion blocks to move sprites and looks blocks to change their appearance, size, and costumes.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 2 Useful Video - Motion and Looks Blocks" },
        { type: "practice", title: "Lesson 2 Exercise - Sprite Movement", prompt: "Make a sprite glide, turn, and bounce" },
        { type: "practice", title: "Lesson 2 Exercise - Costume Changes", prompt: "Create an animation by switching costumes" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 2 Assignment: Dancing Character", description: "Create a character that dances by changing costumes and moving" },
      quiz_required: true,
      quiz_data: { title: "Lesson 2 Quiz", questions: [{ q: "Which block makes a sprite slide smoothly?", options: ["move", "glide", "go to", "turn"], correct: 1 }] },
    },
    {
      title: "Lesson 3: Events and Controls",
      description: "Trigger actions with events and control program flow",
      content: "Events start your programs! Learn to use green flag, key presses, and clicks to trigger actions. Control blocks help you repeat and make decisions.",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 3 Useful Video - Events and Control Flow" },
        { type: "interactive", title: "Lesson 3 Exercise - Event Triggers", prompt: "Create programs that respond to key presses" },
        { type: "practice", title: "Lesson 3 Exercise - Loops in Scratch", prompt: "Use repeat and forever blocks for continuous animation" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 3 Assignment: Keyboard Controller", description: "Create a game where arrow keys control a sprite" },
      quiz_required: true,
      quiz_data: { title: "Lesson 3 Quiz", questions: [{ q: "What starts most Scratch programs?", options: ["Space key", "Green flag", "Mouse click", "Timer"], correct: 1 }] },
    },
    {
      title: "Lesson 4: Sound and Music",
      description: "Add sounds, music, and voice to your projects",
      content: "Make your projects come alive with sound! Learn to play sounds, create music with instruments, and even record your own audio.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 4 Useful Video - Sound Blocks in Scratch" },
        { type: "practice", title: "Lesson 4 Exercise - Playing Sounds", prompt: "Add sound effects to sprite actions" },
        { type: "practice", title: "Lesson 4 Exercise - Creating Music", prompt: "Compose a simple melody using instrument blocks" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 4 Assignment: Musical Instrument", description: "Create a virtual piano or drum kit" },
      quiz_required: true,
      quiz_data: { title: "Lesson 4 Quiz", questions: [{ q: "Which block plays a musical note?", options: ["play sound", "play note", "start sound", "make noise"], correct: 1 }] },
    },
    {
      title: "Lesson 5: Variables and Scoring",
      description: "Track scores, lives, and other data using variables",
      content: "Variables store information that can change. Learn to create scoreboards, track lives, and store player data in your games!",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 5 Useful Video - Variables in Scratch" },
        { type: "interactive", title: "Lesson 5 Exercise - Creating Variables", prompt: "Create and display a score variable" },
        { type: "practice", title: "Lesson 5 Exercise - Updating Variables", prompt: "Change variable values based on game events" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 5 Assignment: Clicker Game", description: "Create a clicking game that tracks and displays the score" },
      quiz_required: true,
      quiz_data: { title: "Lesson 5 Quiz", questions: [{ q: "What stores changing information?", options: ["Sprite", "Variable", "Costume", "Block"], correct: 1 }] },
    },
    {
      title: "Lesson 6: Sensing and Interaction",
      description: "Create interactive projects that respond to the environment",
      content: "Make smart sprites! Learn to detect colors, distances, mouse position, and create sprites that respond to their environment.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 6 Useful Video - Sensing Blocks" },
        { type: "practice", title: "Lesson 6 Exercise - Collision Detection", prompt: "Detect when sprites touch each other or edges" },
        { type: "practice", title: "Lesson 6 Exercise - Mouse Following", prompt: "Make a sprite follow the mouse cursor" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 6 Assignment: Maze Game", description: "Create a maze game using collision detection" },
      quiz_required: true,
      quiz_data: { title: "Lesson 6 Quiz", questions: [{ q: "Which block detects touching another sprite?", options: ["if touching", "when touching", "touching?", "touch"], correct: 2 }] },
    },
    {
      title: "Lesson 7: Cloning and Broadcasting",
      description: "Create multiple copies and communicate between sprites",
      content: "Clone power! Learn to create copies of sprites for bullets, enemies, and more. Broadcasting allows sprites to communicate with each other.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 7 Useful Video - Cloning and Messages" },
        { type: "practice", title: "Lesson 7 Exercise - Creating Clones", prompt: "Create a rain effect using clones" },
        { type: "practice", title: "Lesson 7 Exercise - Broadcasting Messages", prompt: "Make sprites react to broadcast messages" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 7 Assignment: Space Shooter", description: "Create a game with cloned bullets and enemies" },
      quiz_required: true,
      quiz_data: { title: "Lesson 7 Quiz", questions: [{ q: "What creates a copy of a sprite?", options: ["duplicate", "clone", "copy", "stamp"], correct: 1 }] },
    },
    {
      title: "Lesson 8: Backdrops and Levels",
      description: "Create multi-level games with different backgrounds",
      content: "Level up your games! Learn to create multiple levels using backdrops and manage game progression from start to finish.",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 8 Useful Video - Working with Backdrops" },
        { type: "practice", title: "Lesson 8 Exercise - Switching Backdrops", prompt: "Create a game with different background levels" },
        { type: "practice", title: "Lesson 8 Exercise - Level Progression", prompt: "Add level completion logic to your game" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 8 Assignment: Multi-Level Adventure", description: "Create a 3-level game with increasing difficulty" },
      quiz_required: true,
      quiz_data: { title: "Lesson 8 Quiz", questions: [{ q: "What changes the game scene?", options: ["Costume", "Backdrop", "Variable", "Clone"], correct: 1 }] },
    },
    {
      title: "Lesson 9: Lists and High Scores",
      description: "Store multiple values and create leaderboards",
      content: "Lists store collections of data. Perfect for creating high score tables, inventory systems, and storing multiple player names!",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 9 Useful Video - Lists in Scratch" },
        { type: "practice", title: "Lesson 9 Exercise - Creating Lists", prompt: "Build a list to store player names" },
        { type: "practice", title: "Lesson 9 Exercise - High Score System", prompt: "Create and manage a high score leaderboard" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 9 Assignment: Quiz Game", description: "Create an interactive quiz with questions stored in lists" },
      quiz_required: true,
      quiz_data: { title: "Lesson 9 Quiz", questions: [{ q: "What stores multiple items?", options: ["Variable", "List", "Clone", "Sprite"], correct: 1 }] },
    },
    {
      title: "Lesson 10: Final Project & Course Completion",
      description: "Create your masterpiece game using all skills learned",
      content: "You've learned so much! Now combine everything to create an amazing final project. Show off your creativity and programming skills!",
      duration_minutes: 90,
      exercises: [
        { type: "video", title: "Lesson 10 Useful Video - Game Design Tips" },
        { type: "project", title: "Lesson 10 Exercise - Project Planning", prompt: "Plan your final game with features and sprites" },
        { type: "review", title: "Lesson 10 Exercise - Polish and Test", prompt: "Test and improve your game" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 10 Final Project: Complete Game", description: "Create a fully functional game with menu, levels, scoring, and sound" },
      quiz_required: true,
      quiz_data: { title: "Lesson 10 Final Quiz", questions: [{ q: "What makes a great Scratch project?", options: ["Good graphics only", "Good code only", "Creativity + code + polish", "Copying others"], correct: 2 }] },
      is_end_of_course: true,
    },
  ];

  const getGraphicsDesignLessons = () => [
    {
      title: "Lesson 1: Introduction to Graphics Design",
      description: "Discover the fundamentals of visual design and creativity",
      content: "Welcome to the world of graphics design! Learn about design principles, tools, and how designers create stunning visuals for various media.",
      duration_minutes: 45,
      exercises: [
        { type: "video", title: "Lesson 1 Useful Video - What is Graphics Design?" },
        { type: "interactive", title: "Lesson 1 Exercise - Exploring Design Tools", prompt: "Navigate your design software and explore the interface" },
        { type: "practice", title: "Lesson 1 Exercise - Basic Shapes", prompt: "Create basic shapes and understand their properties" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 1 Assignment: Shape Composition", description: "Create an artwork using only basic shapes" },
      quiz_required: true,
      quiz_data: { title: "Lesson 1 Quiz", questions: [{ q: "What is the purpose of graphics design?", options: ["Just decoration", "Visual communication", "Only for websites", "Making photos"], correct: 1 }] },
    },
    {
      title: "Lesson 2: Color Theory",
      description: "Master the art of using colors effectively in design",
      content: "Colors evoke emotions and create visual harmony. Learn about the color wheel, color schemes, and how to choose the perfect palette for your projects.",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 2 Useful Video - Understanding Color Theory" },
        { type: "practice", title: "Lesson 2 Exercise - Color Wheel", prompt: "Explore primary, secondary, and tertiary colors" },
        { type: "practice", title: "Lesson 2 Exercise - Color Schemes", prompt: "Create complementary and analogous color palettes" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 2 Assignment: Color Mood Board", description: "Create a mood board using a specific color scheme" },
      quiz_required: true,
      quiz_data: { title: "Lesson 2 Quiz", questions: [{ q: "What colors are opposite on the color wheel?", options: ["Analogous", "Complementary", "Triadic", "Monochromatic"], correct: 1 }] },
    },
    {
      title: "Lesson 3: Typography Basics",
      description: "Learn to use fonts and text effectively in design",
      content: "Typography is the art of arranging text. Discover different font families, pairing techniques, and how to make text readable and visually appealing.",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 3 Useful Video - Typography Fundamentals" },
        { type: "practice", title: "Lesson 3 Exercise - Font Categories", prompt: "Identify and use serif, sans-serif, and display fonts" },
        { type: "practice", title: "Lesson 3 Exercise - Font Pairing", prompt: "Create effective font combinations" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 3 Assignment: Typography Poster", description: "Design a quote poster focusing on typography" },
      quiz_required: true,
      quiz_data: { title: "Lesson 3 Quiz", questions: [{ q: "What type of font has small lines at letter ends?", options: ["Sans-serif", "Serif", "Script", "Display"], correct: 1 }] },
    },
    {
      title: "Lesson 4: Layout and Composition",
      description: "Arrange elements for visual balance and impact",
      content: "Good composition guides the eye and creates visual interest. Learn about grids, alignment, white space, and the rule of thirds.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 4 Useful Video - Design Layout Principles" },
        { type: "practice", title: "Lesson 4 Exercise - Using Grids", prompt: "Design using a grid system" },
        { type: "practice", title: "Lesson 4 Exercise - Balance and Alignment", prompt: "Create balanced compositions" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 4 Assignment: Magazine Layout", description: "Design a magazine spread using grid principles" },
      quiz_required: true,
      quiz_data: { title: "Lesson 4 Quiz", questions: [{ q: "What helps organize design elements?", options: ["Random placement", "Grid system", "No rules", "Only colors"], correct: 1 }] },
    },
    {
      title: "Lesson 5: Working with Images",
      description: "Learn to edit, manipulate, and enhance images",
      content: "Images are powerful design elements. Master cropping, resizing, adjusting colors, and basic photo manipulation techniques.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 5 Useful Video - Image Editing Basics" },
        { type: "practice", title: "Lesson 5 Exercise - Cropping and Resizing", prompt: "Edit images for different formats" },
        { type: "practice", title: "Lesson 5 Exercise - Color Adjustments", prompt: "Enhance photos with color corrections" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 5 Assignment: Photo Enhancement", description: "Transform a basic photo into a professional-looking image" },
      quiz_required: true,
      quiz_data: { title: "Lesson 5 Quiz", questions: [{ q: "What maintains image quality when enlarging?", options: ["JPEG", "PNG", "Vector graphics", "GIF"], correct: 2 }] },
    },
    {
      title: "Lesson 6: Logo Design",
      description: "Create memorable and effective brand logos",
      content: "Logos are the face of brands. Learn the principles of logo design, from sketching concepts to creating versatile, memorable marks.",
      duration_minutes: 60,
      exercises: [
        { type: "video", title: "Lesson 6 Useful Video - Logo Design Process" },
        { type: "practice", title: "Lesson 6 Exercise - Logo Sketching", prompt: "Sketch multiple logo concepts" },
        { type: "practice", title: "Lesson 6 Exercise - Digitizing Logos", prompt: "Create a clean digital logo from sketches" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 6 Assignment: Brand Logo", description: "Design a complete logo for a fictional company" },
      quiz_required: true,
      quiz_data: { title: "Lesson 6 Quiz", questions: [{ q: "What makes a good logo?", options: ["Complex details", "Many colors", "Simple and memorable", "Trendy fonts"], correct: 2 }] },
    },
    {
      title: "Lesson 7: Social Media Graphics",
      description: "Design engaging content for social media platforms",
      content: "Social media needs eye-catching visuals. Learn to create posts, stories, and banners optimized for different platforms.",
      duration_minutes: 50,
      exercises: [
        { type: "video", title: "Lesson 7 Useful Video - Social Media Design" },
        { type: "practice", title: "Lesson 7 Exercise - Platform Sizes", prompt: "Create designs for different social media dimensions" },
        { type: "practice", title: "Lesson 7 Exercise - Engaging Posts", prompt: "Design scroll-stopping social media posts" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 7 Assignment: Social Media Kit", description: "Create a set of matching social media graphics" },
      quiz_required: true,
      quiz_data: { title: "Lesson 7 Quiz", questions: [{ q: "Why do social platforms have different size requirements?", options: ["No reason", "Display optimization", "To be difficult", "Random choice"], correct: 1 }] },
    },
    {
      title: "Lesson 8: Print Design Basics",
      description: "Create designs ready for professional printing",
      content: "Print design has specific requirements. Learn about resolution, bleed, color modes (CMYK), and preparing files for printing.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 8 Useful Video - Print Design Essentials" },
        { type: "practice", title: "Lesson 8 Exercise - Setting Up Print Files", prompt: "Create a document with proper print settings" },
        { type: "practice", title: "Lesson 8 Exercise - Business Card Design", prompt: "Design a professional business card" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 8 Assignment: Print Flyer", description: "Design a print-ready promotional flyer" },
      quiz_required: true,
      quiz_data: { title: "Lesson 8 Quiz", questions: [{ q: "What color mode is used for printing?", options: ["RGB", "CMYK", "HSL", "Grayscale"], correct: 1 }] },
    },
    {
      title: "Lesson 9: Building a Portfolio",
      description: "Showcase your best work professionally",
      content: "Your portfolio is your visual resume. Learn to select, present, and organize your work to impress clients and employers.",
      duration_minutes: 55,
      exercises: [
        { type: "video", title: "Lesson 9 Useful Video - Portfolio Best Practices" },
        { type: "practice", title: "Lesson 9 Exercise - Selecting Work", prompt: "Choose your best pieces for the portfolio" },
        { type: "practice", title: "Lesson 9 Exercise - Presenting Projects", prompt: "Create mockups and case studies" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 9 Assignment: Portfolio Page", description: "Design a page to showcase one of your projects" },
      quiz_required: true,
      quiz_data: { title: "Lesson 9 Quiz", questions: [{ q: "What should a portfolio show?", options: ["Everything you made", "Only your best work", "Work in progress", "Other people's work"], correct: 1 }] },
    },
    {
      title: "Lesson 10: Final Project & Course Completion",
      description: "Complete a comprehensive design project from concept to delivery",
      content: "Apply all your skills in a final project! Create a complete brand identity including logo, color scheme, typography, and various applications.",
      duration_minutes: 90,
      exercises: [
        { type: "video", title: "Lesson 10 Useful Video - Complete Design Process" },
        { type: "project", title: "Lesson 10 Exercise - Brand Research", prompt: "Research and plan a complete brand identity" },
        { type: "review", title: "Lesson 10 Exercise - Design Critique", prompt: "Review and refine your final designs" },
      ],
      assignment_required: true,
      assignment_data: { title: "Lesson 10 Final Project: Complete Brand Identity", description: "Create a full brand package with logo, colors, typography, and sample applications" },
      quiz_required: true,
      quiz_data: { title: "Lesson 10 Final Quiz", questions: [{ q: "What makes you a graphic designer?", options: ["Having software", "Creativity + skills + practice", "Copying trends", "Only natural talent"], correct: 1 }] },
      is_end_of_course: true,
    },
  ];

  const getRoboticsLessons = () => getGenericLessons("Robotics");
  const getWebDevLessons = () => getGenericLessons("Web Development");
  const getJavaScriptLessons = () => getGenericLessons("JavaScript");

  const getGenericLessons = (courseName: string) => Array.from({ length: 10 }, (_, i) => ({
    title: `Lesson ${i + 1}: ${i === 0 ? `Introduction to ${courseName}` : i === 9 ? `Final Project & Course Completion` : `${courseName} Concepts ${i + 1}`}`,
    description: i === 0 ? `Learn the basics of ${courseName}` : i === 9 ? `Apply all skills in a comprehensive final project` : `Continue learning ${courseName} with new concepts`,
    content: i === 0 ? `Welcome to ${courseName}! Start your journey here.` : i === 9 ? `Congratulations on reaching the final lesson! Time to create your masterpiece.` : `Build on your ${courseName} knowledge with practical exercises.`,
    duration_minutes: i === 9 ? 90 : 45 + (i * 5),
    exercises: [
      { type: "video", title: `Lesson ${i + 1} Useful Video - ${courseName} Topic ${i + 1}` },
      { type: "interactive", title: `Lesson ${i + 1} Exercise - Interactive Example`, prompt: `Practice ${courseName} concepts` },
      { type: "practice", title: `Lesson ${i + 1} Exercise - Hands-on Practice`, prompt: `Apply what you learned` },
    ],
    assignment_required: true,
    assignment_data: { title: `Lesson ${i + 1} Assignment`, description: `Complete the ${courseName} assignment for lesson ${i + 1}` },
    quiz_required: true,
    quiz_data: { title: `Lesson ${i + 1} Quiz`, questions: [{ q: `Question about ${courseName}`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0 }] },
    is_end_of_course: i === 9,
  }));

  const saveLesson = async (lessonData: Partial<Lesson>) => {
    try {
      if (editingLesson) {
        // Update existing lesson
        const { error } = await supabase
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        if (error) throw error;
        toast({ title: "Success", description: "Lesson updated successfully." });
      } else {
        // Create new lesson
        const insertData = {
          title: lessonData.title || '',
          description: lessonData.description || '',
          content: lessonData.content || '',
          duration_minutes: lessonData.duration_minutes || 30,
          course_id: courseId,
          order_index: lessons.length + 1,
          video_urls: lessonData.video_urls || [],
          exercises: lessonData.exercises || [],
          content_type: 'lesson'
        };
        
        const { error } = await supabase
          .from('lessons')
          .insert(insertData);

        if (error) throw error;
        toast({ title: "Success", description: "Lesson created successfully." });
      }

      setDialogOpen(false);
      setEditingLesson(null);
      fetchLessons();
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast({
        title: "Error",
        description: "Failed to save lesson.",
        variant: "destructive",
      });
    }
  };

  const deleteLesson = async (lessonId: string) => {
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;

      toast({ title: "Success", description: "Lesson deleted successfully." });
      fetchLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        title: "Error",
        description: "Failed to delete lesson.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading lessons...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Course Lessons</h3>
        {canEdit && (
          <div className="flex gap-2">
            {lessons.length === 0 && (
              <Button onClick={generateCourseLessons} variant="outline">
                <BookOpen className="w-4 h-4 mr-2" />
                Generate Course Lessons
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingLesson(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lesson
                </Button>
              </DialogTrigger>
              <LessonEditDialog 
                lesson={editingLesson}
                onSave={saveLesson}
                onCancel={() => {
                  setDialogOpen(false);
                  setEditingLesson(null);
                }}
              />
            </Dialog>
          </div>
        )}
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No lessons created yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {lessons.map((lesson) => (
            <Card key={lesson.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="outline">{lesson.order_index}</Badge>
                      {lesson.title}
                    </CardTitle>
                    <CardDescription>{lesson.description}</CardDescription>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingLesson(lesson);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteLesson(lesson.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>⏱️ {lesson.duration_minutes} min</span>
                    <span>🎥 {lesson.video_urls?.length || 0} videos</span>
                    <span>📝 {lesson.exercises?.length || 0} exercises</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lesson.assignment_required && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Assignment Required
                      </Badge>
                    )}
                    {lesson.quiz_required && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Quiz Required
                      </Badge>
                    )}
                    {lesson.is_end_of_course && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        End-of-Course
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonEditDialog({ lesson, onSave, onCancel }: {
  lesson: Lesson | null;
  onSave: (data: Partial<Lesson>) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadedVideos, setUploadedVideos] = useState<string[]>(lesson?.video_urls || []);
  const [formData, setFormData] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    content: lesson?.content || '',
    duration_minutes: lesson?.duration_minutes || 30,
    video_urls: lesson?.video_urls?.join('\n') || '',
    assignment_required: lesson?.assignment_required || false,
    quiz_required: lesson?.quiz_required || false,
    is_end_of_course: lesson?.is_end_of_course || false,
    assignment_data: lesson?.assignment_data || null,
    quiz_data: lesson?.quiz_data || null,
  });

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('lesson-videos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('lesson-videos')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedVideos([...uploadedVideos, ...urls]);
      
      toast({
        title: "Success",
        description: `Uploaded ${files.length} video(s) successfully.`,
      });
    } catch (error: any) {
      console.error('Error uploading videos:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload videos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = uploadedVideos.filter((_, i) => i !== index);
    setUploadedVideos(newVideos);
  };

  const handleSave = () => {
    // Combine uploaded videos and manually entered URLs
    const manualUrls = formData.video_urls.split('\n').filter(url => url.trim());
    const allVideoUrls = [...uploadedVideos, ...manualUrls];

    onSave({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      duration_minutes: formData.duration_minutes,
      video_urls: allVideoUrls,
      assignment_required: formData.assignment_required,
      quiz_required: formData.quiz_required,
      is_end_of_course: formData.is_end_of_course,
      assignment_data: formData.assignment_data,
      quiz_data: formData.quiz_data,
    });
  };

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{lesson ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
        <DialogDescription>
          {lesson ? 'Update lesson details and content.' : 'Add a new lesson to the course.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Basic Information</h3>
          
          <div>
            <Label htmlFor="title">Lesson Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter lesson title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief lesson description"
            />
          </div>

          <div>
            <Label htmlFor="content">Lesson Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Detailed lesson content and instructions"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
              min={1}
              max={180}
            />
          </div>
        </div>

        <Separator />

        {/* Video Management */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Videos</h3>
          
          {/* Uploaded Videos Display */}
          {uploadedVideos.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Videos</Label>
              {uploadedVideos.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm truncate flex-1">{url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVideo(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Video Upload */}
          <div>
            <Label htmlFor="video-upload">Upload Videos</Label>
            <div className="flex items-center gap-2">
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                disabled={uploading}
              />
              {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload video files from your computer (MP4, MOV, etc.)
            </p>
          </div>

          {/* Video URLs */}
          <div>
            <Label htmlFor="videos">Or Add Video URLs (one per line)</Label>
            <Textarea
              id="videos"
              value={formData.video_urls}
              onChange={(e) => setFormData({ ...formData, video_urls: e.target.value })}
              placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Add YouTube, Vimeo, or direct video links
            </p>
          </div>
        </div>

        <Separator />

        {/* Completion Requirements */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Completion Requirements</h3>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Enable these toggles to enforce completion rules. Students must satisfy all enabled requirements before marking the lesson as complete.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="assignment-required" className="cursor-pointer">
                  Assignment Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students must complete and submit an assignment
                </p>
              </div>
              <Switch
                id="assignment-required"
                checked={formData.assignment_required}
                onCheckedChange={(checked) => setFormData({ ...formData, assignment_required: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="quiz-required" className="cursor-pointer">
                  Quiz Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students must pass a quiz to complete this lesson
                </p>
              </div>
              <Switch
                id="quiz-required"
                checked={formData.quiz_required}
                onCheckedChange={(checked) => setFormData({ ...formData, quiz_required: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/50">
              <div className="space-y-1">
                <Label htmlFor="end-of-course" className="cursor-pointer flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  End-of-Course Lesson
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mark as final lesson with project/quiz/presentation activities
                </p>
              </div>
              <Switch
                id="end-of-course"
                checked={formData.is_end_of_course}
                onCheckedChange={(checked) => setFormData({ ...formData, is_end_of_course: checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.title.trim() || uploading}>
          {uploading ? 'Uploading...' : lesson ? 'Update Lesson' : 'Create Lesson'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}