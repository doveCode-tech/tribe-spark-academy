-- Fix the admin_enroll_user function to handle unique constraint properly
CREATE OR REPLACE FUNCTION public.admin_enroll_user(_user_id uuid, _course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_ultimate_tutor_or_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.enrollments (student_id, course_id, status, enrolled_by)
  VALUES (_user_id, _course_id, 'active', auth.uid())
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    status = EXCLUDED.status,
    enrolled_by = EXCLUDED.enrolled_by,
    enrolled_at = now();
END;
$function$;

-- Add unique constraint to enrollments if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'enrollments_student_course_unique'
  ) THEN
    ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_course_unique UNIQUE (student_id, course_id);
  END IF;
END $$;

-- Create demo courses with lessons, quizzes, and badges
INSERT INTO public.courses (id, title, description, category) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Python for Beginners', 'Learn the fundamentals of Python programming', 'Python'),
  ('22222222-2222-2222-2222-222222222222', 'Scratch Programming', 'Create games and animations with Scratch', 'Scratch'),
  ('33333333-3333-3333-3333-333333333333', 'Web Development', 'Build websites with HTML, CSS, and JavaScript', 'Web Development'),
  ('44444444-4444-4444-4444-444444444444', 'Robotics Basics', 'Introduction to robotics and automation', 'Robotics'),
  ('55555555-5555-5555-5555-555555555555', 'Game Development', 'Create your own video games', 'Game Development')
ON CONFLICT (id) DO NOTHING;

-- Create lessons for each course
INSERT INTO public.lessons (course_id, title, description, order_index, content, exercises) VALUES
  -- Python Course Lessons
  ('11111111-1111-1111-1111-111111111111', 'Getting Started with Python', 'Introduction to Python and setting up your environment', 1, 'In this lesson, you will learn what Python is and how to set up your development environment.', '[{"type": "coding", "title": "Print Hello World", "description": "Write your first Python program"}, {"type": "quiz", "title": "Python Basics", "description": "Test your understanding"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Variables and Data Types', 'Learn about different data types in Python', 2, 'Understanding variables, strings, numbers, and booleans in Python.', '[{"type": "coding", "title": "Create Variables", "description": "Practice creating different types of variables"}, {"type": "exercise", "title": "Data Type Quiz", "description": "Identify data types"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Control Structures', 'If statements and loops in Python', 3, 'Learn how to make decisions and repeat actions in your code.', '[{"type": "coding", "title": "If-Else Practice", "description": "Write conditional statements"}, {"type": "coding", "title": "For Loop Challenge", "description": "Create loops to solve problems"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Functions', 'Creating and using functions', 4, 'Learn how to organize your code with functions.', '[{"type": "coding", "title": "Write Functions", "description": "Create your own functions"}, {"type": "project", "title": "Function Library", "description": "Build a collection of useful functions"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Lists and Dictionaries', 'Working with data structures', 5, 'Master Python''s most important data structures.', '[{"type": "coding", "title": "List Operations", "description": "Practice with lists"}, {"type": "coding", "title": "Dictionary Practice", "description": "Work with key-value pairs"}]'),
  
  -- Scratch Course Lessons
  ('22222222-2222-2222-2222-222222222222', 'Introduction to Scratch', 'Getting familiar with the Scratch interface', 1, 'Discover the colorful world of Scratch programming!', '[{"type": "interactive", "title": "Explore Scratch", "description": "Navigate the Scratch interface"}, {"type": "project", "title": "Make a Sprite Move", "description": "Create your first animation"}]'),
  ('22222222-2222-2222-2222-222222222222', 'Sprites and Backdrops', 'Working with characters and backgrounds', 2, 'Learn how to customize sprites and create amazing scenes.', '[{"type": "creative", "title": "Design a Character", "description": "Create and customize your sprite"}, {"type": "project", "title": "Scene Creator", "description": "Build an interactive scene"}]'),
  ('22222222-2222-2222-2222-222222222222', 'Motion and Animation', 'Making things move and dance', 3, 'Bring your creations to life with movement and animation.', '[{"type": "animation", "title": "Dance Party", "description": "Make sprites dance"}, {"type": "game", "title": "Bouncing Ball", "description": "Create a bouncing ball animation"}]'),
  ('22222222-2222-2222-2222-222222222222', 'Events and Interactions', 'Responding to clicks and key presses', 4, 'Make your programs interactive and responsive.', '[{"type": "interactive", "title": "Click Games", "description": "Create click-responsive programs"}, {"type": "project", "title": "Interactive Story", "description": "Build a choose-your-adventure story"}]'),
  
  -- Web Development Lessons
  ('33333333-3333-3333-3333-333333333333', 'HTML Fundamentals', 'Structure web pages with HTML', 1, 'Learn the building blocks of the web.', '[{"type": "coding", "title": "First Web Page", "description": "Create a basic HTML page"}, {"type": "project", "title": "About Me Page", "description": "Build a personal webpage"}]'),
  ('33333333-3333-3333-3333-333333333333', 'CSS Styling', 'Make websites beautiful with CSS', 2, 'Add colors, fonts, and layouts to your web pages.', '[{"type": "styling", "title": "Color and Fonts", "description": "Style text and backgrounds"}, {"type": "project", "title": "Portfolio Design", "description": "Create a styled portfolio"}]'),
  ('33333333-3333-3333-3333-333333333333', 'JavaScript Basics', 'Add interactivity with JavaScript', 3, 'Make your websites come alive with programming.', '[{"type": "coding", "title": "Button Actions", "description": "Create interactive buttons"}, {"type": "game", "title": "Simple Calculator", "description": "Build a working calculator"}]'),
  ('33333333-3333-3333-3333-333333333333', 'Responsive Design', 'Make websites work on all devices', 4, 'Learn to create websites that look great everywhere.', '[{"type": "design", "title": "Mobile First", "description": "Design for mobile devices"}, {"type": "project", "title": "Responsive Site", "description": "Create a multi-device website"}]'),
  
  -- Robotics Lessons
  ('44444444-4444-4444-4444-444444444444', 'What is Robotics?', 'Introduction to robots and automation', 1, 'Discover the amazing world of robotics and how robots work.', '[{"type": "theory", "title": "Robot Types", "description": "Learn about different kinds of robots"}, {"type": "video", "title": "Robots in Action", "description": "Watch robots at work"}]'),
  ('44444444-4444-4444-4444-444444444444', 'Sensors and Motors', 'Understanding robot components', 2, 'Learn how robots see, hear, and move.', '[{"type": "experiment", "title": "Sensor Testing", "description": "Test different sensors"}, {"type": "building", "title": "Motor Control", "description": "Control robot movement"}]'),
  ('44444444-4444-4444-4444-444444444444', 'Programming Robots', 'Writing code for robots', 3, 'Learn to give instructions to robots.', '[{"type": "coding", "title": "Move Commands", "description": "Program robot movement"}, {"type": "challenge", "title": "Maze Runner", "description": "Navigate a robot through a maze"}]'),
  
  -- Game Development Lessons
  ('55555555-5555-5555-5555-555555555555', 'Game Design Basics', 'Planning and designing games', 1, 'Learn the fundamentals of creating engaging games.', '[{"type": "design", "title": "Game Concept", "description": "Design your game idea"}, {"type": "planning", "title": "Game Mechanics", "description": "Plan game rules and features"}]'),
  ('55555555-5555-5555-5555-555555555555', 'Characters and Assets', 'Creating game art and characters', 2, 'Design heroes, enemies, and game worlds.', '[{"type": "art", "title": "Character Design", "description": "Create game characters"}, {"type": "creative", "title": "Game World", "description": "Design levels and backgrounds"}]'),
  ('55555555-5555-5555-5555-555555555555', 'Game Programming', 'Coding your game logic', 3, 'Bring your game to life with code.', '[{"type": "coding", "title": "Player Controls", "description": "Program character movement"}, {"type": "coding", "title": "Collision Detection", "description": "Handle object interactions"}]')
ON CONFLICT (course_id, order_index) DO NOTHING;

-- Create badges
INSERT INTO public.badges (id, name, description, icon, color, criteria) VALUES
  ('badge-001', 'Star of Excellence', 'Awarded for outstanding performance', '⭐', '#FFD700', '{"type": "completion", "threshold": 100}'),
  ('badge-002', 'Master Coder', 'Expert programming skills', '💻', '#00FF00', '{"type": "coding_excellence", "projects": 5}'),
  ('badge-003', 'Quiz Champion', 'Perfect quiz performance', '🏆', '#FF6B35', '{"type": "quiz_score", "percentage": 100}'),
  ('badge-004', 'Project Hero', 'Exceptional project submissions', '🛡️', '#4A90E2', '{"type": "project_quality", "rating": "excellent"}'),
  ('badge-005', 'Fast Learner', 'Quick completion of courses', '⚡', '#FFEB3B', '{"type": "completion_time", "speed": "fast"}'),
  ('badge-006', 'Perfect Score', 'Achieved 100% in assessments', '💯', '#FFD700', '{"type": "perfect_assessment", "count": 1}'),
  ('badge-007', 'Persistent Learner', 'Never gave up on challenges', '🏔️', '#8E24AA', '{"type": "persistence", "attempts": 3}'),
  ('badge-008', 'Team Player', 'Great collaboration skills', '👥', '#4CAF50', '{"type": "collaboration", "projects": 2}')
ON CONFLICT (id) DO NOTHING;

-- Create quizzes for each course
INSERT INTO public.quizzes (id, course_id, title, description, questions, pass_percentage) VALUES
  ('quiz-python', '11111111-1111-1111-1111-111111111111', 'Python Mastery Quiz', 'Test your Python programming knowledge', '[
    {"id": 1, "question": "What keyword is used to create a function in Python?", "options": ["def", "function", "create", "make"], "correct": 0},
    {"id": 2, "question": "Which data type is used to store text in Python?", "options": ["int", "float", "str", "bool"], "correct": 2},
    {"id": 3, "question": "What does the print() function do?", "options": ["Creates variables", "Displays output", "Deletes files", "Loops code"], "correct": 1},
    {"id": 4, "question": "Which symbol is used for comments in Python?", "options": ["//", "<!--", "#", "/*"], "correct": 2},
    {"id": 5, "question": "What is the correct way to create a list in Python?", "options": ["list = {1, 2, 3}", "list = [1, 2, 3]", "list = (1, 2, 3)", "list = 1, 2, 3"], "correct": 1}
  ]', 70),
  ('quiz-scratch', '22222222-2222-2222-2222-222222222222', 'Scratch Programming Quiz', 'Show your Scratch skills', '[
    {"id": 1, "question": "What are the characters in Scratch called?", "options": ["Actors", "Sprites", "Characters", "Objects"], "correct": 1},
    {"id": 2, "question": "Which block category contains movement commands?", "options": ["Looks", "Sound", "Motion", "Events"], "correct": 2},
    {"id": 3, "question": "What happens when you click the green flag?", "options": ["Saves project", "Starts scripts", "Deletes sprites", "Changes backdrop"], "correct": 1},
    {"id": 4, "question": "Which block makes a sprite say something?", "options": ["think", "say", "speak", "talk"], "correct": 1},
    {"id": 5, "question": "What is used to detect when sprites touch?", "options": ["Sensing blocks", "Motion blocks", "Sound blocks", "Looks blocks"], "correct": 0}
  ]', 70),
  ('quiz-web', '33333333-3333-3333-3333-333333333333', 'Web Development Quiz', 'Test your web development skills', '[
    {"id": 1, "question": "What does HTML stand for?", "options": ["High Tech Markup Language", "HyperText Markup Language", "Home Tool Markup Language", "Hyperlink Text Markup Language"], "correct": 1},
    {"id": 2, "question": "Which CSS property changes text color?", "options": ["font-color", "text-color", "color", "foreground"], "correct": 2},
    {"id": 3, "question": "What does JavaScript add to websites?", "options": ["Structure", "Styling", "Interactivity", "Images"], "correct": 2},
    {"id": 4, "question": "Which HTML tag creates a heading?", "options": ["<head>", "<h1>", "<header>", "<title>"], "correct": 1},
    {"id": 5, "question": "What is responsive design?", "options": ["Fast loading", "Interactive elements", "Works on all devices", "Colorful design"], "correct": 2}
  ]', 70),
  ('quiz-robotics', '44444444-4444-4444-4444-444444444444', 'Robotics Knowledge Quiz', 'Test your robotics understanding', '[
    {"id": 1, "question": "What do robots use to sense their environment?", "options": ["Motors", "Sensors", "Processors", "Batteries"], "correct": 1},
    {"id": 2, "question": "Which component makes robots move?", "options": ["Sensors", "Motors", "Cameras", "Speakers"], "correct": 1},
    {"id": 3, "question": "What is the brain of a robot?", "options": ["Motor", "Sensor", "Processor", "Battery"], "correct": 2},
    {"id": 4, "question": "What type of sensor detects distance?", "options": ["Light sensor", "Sound sensor", "Ultrasonic sensor", "Touch sensor"], "correct": 2},
    {"id": 5, "question": "What programming concept makes robots repeat actions?", "options": ["Variables", "Loops", "Functions", "Conditions"], "correct": 1}
  ]', 70),
  ('quiz-gamedev', '55555555-5555-5555-5555-555555555555', 'Game Development Quiz', 'Show your game dev knowledge', '[
    {"id": 1, "question": "What makes a game fun to play?", "options": ["Graphics only", "Sound only", "Good gameplay", "Length"], "correct": 2},
    {"id": 2, "question": "What is a game sprite?", "options": ["A drink", "A 2D image", "A sound file", "A level"], "correct": 1},
    {"id": 3, "question": "What happens during collision detection?", "options": ["Objects are created", "Objects interact", "Objects disappear", "Objects change color"], "correct": 1},
    {"id": 4, "question": "What is a game level?", "options": ["Difficulty setting", "Player rank", "Game stage", "Score value"], "correct": 2},
    {"id": 5, "question": "What makes characters move in games?", "options": ["Physics", "Animation", "Programming", "All of above"], "correct": 3}
  ]', 70)
ON CONFLICT (id) DO NOTHING;

-- Create games for courses (after lesson 3 and 7)
INSERT INTO public.games (id, course_id, lesson_number, title, description, game_type, game_data) VALUES
  ('game-python-3', '11111111-1111-1111-1111-111111111111', 3, 'Code Debugger', 'Find and fix bugs in Python code', 'debugging', '{"bugs": [{"line": 3, "error": "missing colon"}, {"line": 7, "error": "wrong indentation"}], "code": "def hello()\\n    print(\\"Hello World\\")\\n\\nhello()"}'),
  ('game-scratch-3', '22222222-2222-2222-2222-222222222222', 3, 'Sprite Dance Challenge', 'Make sprites dance to the music', 'creative', '{"sprites": ["cat", "dog", "bird"], "music": "upbeat", "moves": ["spin", "jump", "wiggle"]}'),
  ('game-web-3', '33333333-3333-3333-3333-333333333333', 3, 'CSS Color Match', 'Match colors using CSS properties', 'matching', '{"colors": ["red", "blue", "green", "yellow"], "properties": ["color", "background-color", "border-color"]}'),
  ('game-robotics-3', '44444444-4444-4444-4444-444444444444', 3, 'Robot Maze Navigator', 'Guide a robot through a maze', 'strategy', '{"maze": "simple", "robot": "basic", "obstacles": ["walls", "gaps"], "goal": "reach exit"}'),
  ('game-gamedev-3', '55555555-5555-5555-5555-555555555555', 3, 'Character Creator', 'Design your game character', 'creative', '{"parts": ["head", "body", "legs"], "colors": ["red", "blue", "green"], "accessories": ["hat", "glasses", "cape"]}}')
ON CONFLICT (id) DO NOTHING;