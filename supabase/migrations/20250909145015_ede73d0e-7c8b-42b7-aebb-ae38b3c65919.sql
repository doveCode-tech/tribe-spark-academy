-- Create some lessons for the demo courses
INSERT INTO public.lessons (course_id, title, description, order_index, content, exercises) VALUES
  -- Python Course Lessons
  ('11111111-1111-1111-1111-111111111111', 'Getting Started with Python', 'Introduction to Python and setting up your environment', 1, 'In this lesson, you will learn what Python is and how to set up your development environment. Python is a powerful, easy-to-learn programming language.', '[{"type": "coding", "title": "Print Hello World", "description": "Write your first Python program"}, {"type": "quiz", "title": "Python Basics", "description": "Test your understanding"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Variables and Data Types', 'Learn about different data types in Python', 2, 'Understanding variables, strings, numbers, and booleans in Python. Variables are containers for storing data values.', '[{"type": "coding", "title": "Create Variables", "description": "Practice creating different types of variables"}, {"type": "exercise", "title": "Data Type Quiz", "description": "Identify data types"}]'),
  ('11111111-1111-1111-1111-111111111111', 'Control Structures', 'If statements and loops in Python', 3, 'Learn how to make decisions and repeat actions in your code using if statements and loops.', '[{"type": "coding", "title": "If-Else Practice", "description": "Write conditional statements"}, {"type": "coding", "title": "For Loop Challenge", "description": "Create loops to solve problems"}]'),
  
  -- Scratch Course Lessons
  ('22222222-2222-2222-2222-222222222222', 'Introduction to Scratch', 'Getting familiar with the Scratch interface', 1, 'Discover the colorful world of Scratch programming! Scratch is a visual programming language designed for kids.', '[{"type": "interactive", "title": "Explore Scratch", "description": "Navigate the Scratch interface"}, {"type": "project", "title": "Make a Sprite Move", "description": "Create your first animation"}]'),
  ('22222222-2222-2222-2222-222222222222', 'Sprites and Backdrops', 'Working with characters and backgrounds', 2, 'Learn how to customize sprites and create amazing scenes in your Scratch projects.', '[{"type": "creative", "title": "Design a Character", "description": "Create and customize your sprite"}, {"type": "project", "title": "Scene Creator", "description": "Build an interactive scene"}]'),
  
  -- Web Development Lessons  
  ('33333333-3333-3333-3333-333333333333', 'HTML Fundamentals', 'Structure web pages with HTML', 1, 'Learn the building blocks of the web. HTML provides the structure and content of web pages.', '[{"type": "coding", "title": "First Web Page", "description": "Create a basic HTML page"}, {"type": "project", "title": "About Me Page", "description": "Build a personal webpage"}]'),
  ('33333333-3333-3333-3333-333333333333', 'CSS Styling', 'Make websites beautiful with CSS', 2, 'Add colors, fonts, and layouts to your web pages using CSS (Cascading Style Sheets).', '[{"type": "styling", "title": "Color and Fonts", "description": "Style text and backgrounds"}, {"type": "project", "title": "Portfolio Design", "description": "Create a styled portfolio"}]')
ON CONFLICT (course_id, order_index) DO NOTHING;

-- Create quizzes for courses
INSERT INTO public.quizzes (id, course_id, title, description, questions, pass_percentage) VALUES
  ('q1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Python Mastery Quiz', 'Test your Python programming knowledge', '[
    {"id": 1, "question": "What keyword is used to create a function in Python?", "options": ["def", "function", "create", "make"], "correct": 0},
    {"id": 2, "question": "Which data type is used to store text in Python?", "options": ["int", "float", "str", "bool"], "correct": 2},
    {"id": 3, "question": "What does the print() function do?", "options": ["Creates variables", "Displays output", "Deletes files", "Loops code"], "correct": 1},
    {"id": 4, "question": "Which symbol is used for comments in Python?", "options": ["//", "<!--", "#", "/*"], "correct": 2},
    {"id": 5, "question": "What is the correct way to create a list in Python?", "options": ["list = {1, 2, 3}", "list = [1, 2, 3]", "list = (1, 2, 3)", "list = 1, 2, 3"], "correct": 1}
  ]', 70),
  ('q2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Scratch Programming Quiz', 'Show your Scratch skills', '[
    {"id": 1, "question": "What are the characters in Scratch called?", "options": ["Actors", "Sprites", "Characters", "Objects"], "correct": 1},
    {"id": 2, "question": "Which block category contains movement commands?", "options": ["Looks", "Sound", "Motion", "Events"], "correct": 2},
    {"id": 3, "question": "What happens when you click the green flag?", "options": ["Saves project", "Starts scripts", "Deletes sprites", "Changes backdrop"], "correct": 1},
    {"id": 4, "question": "Which block makes a sprite say something?", "options": ["think", "say", "speak", "talk"], "correct": 1},
    {"id": 5, "question": "What is used to detect when sprites touch?", "options": ["Sensing blocks", "Motion blocks", "Sound blocks", "Looks blocks"], "correct": 0}
  ]', 70),
  ('q3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Web Development Quiz', 'Test your web development skills', '[
    {"id": 1, "question": "What does HTML stand for?", "options": ["High Tech Markup Language", "HyperText Markup Language", "Home Tool Markup Language", "Hyperlink Text Markup Language"], "correct": 1},
    {"id": 2, "question": "Which CSS property changes text color?", "options": ["font-color", "text-color", "color", "foreground"], "correct": 2},
    {"id": 3, "question": "What does JavaScript add to websites?", "options": ["Structure", "Styling", "Interactivity", "Images"], "correct": 2},
    {"id": 4, "question": "Which HTML tag creates a heading?", "options": ["<head>", "<h1>", "<header>", "<title>"], "correct": 1},
    {"id": 5, "question": "What is responsive design?", "options": ["Fast loading", "Interactive elements", "Works on all devices", "Colorful design"], "correct": 2}
  ]', 70)
ON CONFLICT (id) DO NOTHING;