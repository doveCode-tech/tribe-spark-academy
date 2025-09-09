-- Create simple quizzes with proper UUID format
INSERT INTO public.quizzes (course_id, title, description, questions, pass_percentage) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Python Mastery Quiz', 'Test your Python programming knowledge', '[
    {"id": 1, "question": "What keyword is used to create a function in Python?", "options": ["def", "function", "create", "make"], "correct": 0},
    {"id": 2, "question": "Which data type is used to store text in Python?", "options": ["int", "float", "str", "bool"], "correct": 2},
    {"id": 3, "question": "What does the print() function do?", "options": ["Creates variables", "Displays output", "Deletes files", "Loops code"], "correct": 1}
  ]', 70),
  ('22222222-2222-2222-2222-222222222222', 'Scratch Programming Quiz', 'Show your Scratch skills', '[
    {"id": 1, "question": "What are the characters in Scratch called?", "options": ["Actors", "Sprites", "Characters", "Objects"], "correct": 1},
    {"id": 2, "question": "Which block category contains movement commands?", "options": ["Looks", "Sound", "Motion", "Events"], "correct": 2},
    {"id": 3, "question": "What happens when you click the green flag?", "options": ["Saves project", "Starts scripts", "Deletes sprites", "Changes backdrop"], "correct": 1}
  ]', 70);