-- Insert predefined kid-friendly courses
INSERT INTO public.courses (title, description, category, created_by, capstone_project_title, capstone_project_description) VALUES 
(
  'Python Programming for Kids',
  'Learn Python programming through fun projects and games! Start with simple commands and build up to creating your own programs.',
  'Python',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Create Your Own Game',
  'Design and code your very own Python game using everything you''ve learned!'
),
(
  'Roblox Game Development',
  'Create amazing games and experiences in Roblox! Learn scripting, building, and game design principles.',
  'Roblox',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Publish Your Roblox Game',
  'Create and publish a complete game experience on the Roblox platform.'
),
(
  'Web Design Adventures',
  'Build awesome websites with HTML, CSS, and JavaScript! Create colorful pages and interactive elements.',
  'Web Design',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Build Your Personal Website',
  'Create a personal portfolio website showcasing all your web development skills!'
),
(
  'Web Builders Workshop',
  'Learn to create websites without coding using Mobirise, Wix, and Framer! Perfect for beginners.',
  'Web Builders',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Design a Business Website',
  'Create a professional website for a fictional business using your favorite web builder tool.'
),
(
  'Animation Magic',
  'Bring your ideas to life with 2D and 3D animation! Start with simple movements and create amazing stories.',
  'Animation',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Create an Animated Short Film',
  'Produce a 1-2 minute animated story that showcases your animation skills!'
),
(
  'Graphics Design with Canva',
  'Create stunning posters, logos, and graphics using Canva! Learn design principles and color theory.',
  'Graphics Design',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Design a Brand Identity',
  'Create a complete brand package including logo, business card, and poster for your dream company.'
),
(
  'Artificial Intelligence Explorer',
  'Discover the amazing world of AI! Play with AI tools, create smart programs, and understand how machines learn.',
  'Artificial Intelligence',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Build an AI Assistant',
  'Create your own AI-powered helper using visual programming tools and machine learning concepts.'
),
(
  'Robotics Adventures',
  'Build and program robots that move, think, and solve problems! Work with Edison, mBot, and simple electronics.',
  'Robotics',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Robot Problem Solver',
  'Design and build a robot that can solve a real-world problem in your community.'
),
(
  'Scratch Programming Fun',
  'Create games, animations, and interactive stories using Scratch''s drag-and-drop programming!',
  'Scratch',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Interactive Story Game',
  'Create an interactive story game where players make choices that change the adventure!'
),
(
  'Mobile App Creator',
  'Build real mobile apps using Kodular and Thunkable! No complex coding required - just drag, drop, and create!',
  'Mobile Apps',
  (SELECT auth_user_id FROM public.users WHERE role = 'admin' LIMIT 1),
  'Launch Your App Idea',
  'Design, build, and publish a mobile app that solves a problem or provides entertainment!'
);