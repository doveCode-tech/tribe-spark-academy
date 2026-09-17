/**
 * STEMtribe AI Course & Curriculum Assistant
 * Intelligently generates level-progressive activity templates and matching quizzes
 * tailored specifically to course subject, grade level (beginner -> intermediate -> advanced),
 * and kid-friendly pedagogy.
 */

import { ActivityItem } from "@/components/LessonActivityDialog";

export type LearningLevel = "beginner" | "intermediate" | "advanced";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface GeneratedActivityPackage {
  level: LearningLevel;
  levelTitle: string;
  progressionContext: string;
  activity: ActivityItem;
  quiz: {
    id: string;
    title: string;
    pass_percentage: number;
    questions: QuizQuestion[];
  };
}

export interface QuickTemplateDef {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
  item: ActivityItem;
}

/**
 * Detect course track from course title and category
 */
export function detectCourseTrack(courseTitle: string = "", category: string = ""): "ai" | "python" | "robotics" | "web" | "scratch" | "general" {
  const text = `${courseTitle} ${category}`.toLowerCase();
  if (text.includes("ai") || text.includes("artificial") || text.includes("machine learning") || text.includes("neural") || text.includes("intelligence") || text.includes("gpt")) {
    return "ai";
  }
  if (text.includes("python") || text.includes("data science") || text.includes("django") || text.includes("flask")) {
    return "python";
  }
  if (text.includes("robot") || text.includes("arduino") || text.includes("micro:bit") || text.includes("microbit") || text.includes("iot") || text.includes("hardware")) {
    return "robotics";
  }
  if (text.includes("web") || text.includes("html") || text.includes("css") || text.includes("javascript") || text.includes("frontend") || text.includes("react")) {
    return "web";
  }
  if (text.includes("scratch") || text.includes("block") || text.includes("animation") || text.includes("game")) {
    return "scratch";
  }
  return "general";
}

/**
 * Returns subject-tailored quick templates based on course name & category
 */
export function getSubjectQuickTemplates(courseTitle: string, category: string): QuickTemplateDef[] {
  const track = detectCourseTrack(courseTitle, category);

  if (track === "ai") {
    return [
      {
        id: "ai_chatbot",
        label: "AI Chatbot Lab (+50 XP)",
        icon: "Bot",
        colorClass: "text-purple-700 border-purple-200 hover:bg-purple-50 dark:border-purple-800",
        item: {
          id: crypto.randomUUID(),
          title: "Build a Friendly AI Chatbot Assistant",
          instructions: "1. Create conversational rules for your bot.\n2. Add responses for user greetings and favorite STEM topics.\n3. Run your program and chat with your bot in the terminal!",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# STEMtribe AI Chatbot Assistant
bot_name = "Sparky AI"
print(f"Hello! I am {bot_name}, your AI learning buddy.")

user_message = "hello"
user_interest = "space"

# AI Decision Logic
if user_message.lower() == "hello":
    print(f"{bot_name}: Greetings! What exciting topic are we exploring today?")

if user_interest == "space":
    print(f"{bot_name}: Did you know? A year on Venus is shorter than a day on Venus!")
`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "practice",
          hints: [{ step: 1, text: "Try changing user_interest to 'robotics' or 'coding' and add custom responses!" }],
        },
      },
      {
        id: "ai_vision",
        label: "Vision & Classifier (+50 XP)",
        icon: "Camera",
        colorClass: "text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800",
        item: {
          id: crypto.randomUUID(),
          title: "AI Vision & Image Classifier Simulator",
          instructions: "1. Set confidence thresholds for image recognition.\n2. Classify sample inputs as 'Friendly Cat', 'Robot', or 'Unknown'.\n3. Print the AI prediction and accuracy confidence score.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# AI Image Classifier
confidence_threshold = 0.75
detected_features = ["whiskers", "fur", "pointed_ears"]

# AI Scoring model
cat_score = 0.88
robot_score = 0.12

print("Analyzing input image features...")
if cat_score >= confidence_threshold:
    print(f"Prediction: Friendly Kitten (Confidence: {int(cat_score * 100)}%)")
else:
    print("Prediction uncertain. Need more training data!")
`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "practice",
          hints: [{ step: 1, text: "Try lowering confidence_threshold to 0.5 to see how AI sensitivity changes." }],
        },
      },
      {
        id: "ai_nlp",
        label: "Sentiment Analyzer (+40 XP)",
        icon: "Sparkles",
        colorClass: "text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800",
        item: {
          id: crypto.randomUUID(),
          title: "AI Sentiment & Emotion Analyzer",
          instructions: "Analyze text to detect whether feedback is Positive, Neutral, or Negative based on sentiment word weights.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# NLP Sentiment Analyzer
positive_words = ["great", "awesome", "fun", "love", "smart"]
negative_words = ["bad", "boring", "hard", "sad"]

review = "This STEM robot project is awesome and super fun"
words = review.lower().split()

score = 0
for word in words:
    if word in positive_words:
        score += 1
    elif word in negative_words:
        score -= 1

print("Review text:", review)
if score > 0:
    print("Sentiment: POSITIVE 😊 Score:", score)
elif score < 0:
    print("Sentiment: NEGATIVE 🙁 Score:", score)
else:
    print("Sentiment: NEUTRAL 😐")
`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "ai_debug",
        label: "AI Model Bug Hunt (+50 XP)",
        icon: "Bug",
        colorClass: "text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800",
        item: {
          id: crypto.randomUUID(),
          title: "Fix the AI Training Loop Bug",
          instructions: "The AI neural network training loop has two bugs causing the training accuracy to calculate incorrectly. Find and fix them!",
          editor_type: "monaco_python",
          project_mode: "debug",
          starter_code: `# AI Training Loop - Fix the 2 Bugs
training_samples = [10, 20, 30, 40]
total_loss = 0.0

# Bug 1: Range indexing issue
# Bug 2: Loss accumulation
for sample in training_samples:
    loss = (sample - 25) ** 2
    total_loss += loss

avg_loss = total_loss / len(training_samples)
print("Training Complete! Average Loss:", avg_loss)
`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "debug",
        },
      },
      {
        id: "ai_capstone",
        label: "AI Capstone Project (+100 XP)",
        icon: "Trophy",
        colorClass: "text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-800",
        item: {
          id: crypto.randomUUID(),
          title: "Capstone: Autonomous Smart Assistant",
          instructions: "Design an end-to-end intelligent assistant that parses user voice/text commands, checks facts, and recommends personalized STEM lessons.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# Capstone: Autonomous AI Agent
class SmartAssistant:
    def __init__(self, name):
        self.name = name
        self.knowledge_base = {
            "mars": "Mars is known as the Red Planet due to iron oxide.",
            "python": "Python was created by Guido van Rossum in 1991.",
            "circuit": "A complete path through which electric current can flow."
        }

    def ask(self, query):
        query = query.lower()
        for key in self.knowledge_base:
            if key in query:
                return f"{self.name}: {self.knowledge_base[key]}"
        return f"{self.name}: I am still learning about that topic!"

bot = SmartAssistant("STEM-Nova")
print(bot.ask("Tell me about mars"))
print(bot.ask("What is a circuit?"))
`,
          is_assignment: true,
          xp_reward: 100,
          status: "published",
          type: "assignment",
        },
      },
    ];
  }

  if (track === "robotics") {
    return [
      {
        id: "robot_sensor",
        label: "Obstacle Avoidance (+40 XP)",
        icon: "Cpu",
        colorClass: "text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800",
        item: {
          id: crypto.randomUUID(),
          title: "Robotics Ultrasonic Sensor Algorithm",
          instructions: "Program the robot rover to check distance ahead. If an obstacle is closer than 15cm, reverse and turn right!",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# Obstacle Avoidance Rover
distance_cm = 12
safety_limit = 15

print(f"Sensor reading: {distance_cm} cm ahead")
if distance_cm < safety_limit:
    print("⚠️ Obstacle detected! Motors: REVERSE, Turning RIGHT 90 degrees.")
else:
    print("✅ Path clear! Motors: FULL SPEED FORWARD.")
`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "robot_microbit",
        label: "Micro:bit LED Compass (+50 XP)",
        icon: "Radio",
        colorClass: "text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800",
        item: {
          id: crypto.randomUUID(),
          title: "Micro:bit Digital Compass & Display",
          instructions: "Simulate a digital compass heading reading and display North, South, East, or West arrow on the LED grid.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# Micro:bit Compass Simulator
heading_degrees = 45

if heading_degrees >= 315 or heading_degrees < 45:
    direction = "NORTH (⬆️)"
elif heading_degrees < 135:
    direction = "EAST (➡️)"
elif heading_degrees < 225:
    direction = "SOUTH (⬇️)"
else:
    direction = "WEST (⬅️)"

print(f"Compass Heading: {heading_degrees}° -> Heading {direction}")
`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "robot_debug",
        label: "Motor Bug Hunt (+50 XP)",
        icon: "Bug",
        colorClass: "text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800",
        item: {
          id: crypto.randomUUID(),
          title: "Fix the Servo Speed PWM Glitch",
          instructions: "The robot arm PWM signal is miscalculated. Fix the duty cycle formula so the arm can pick up the object smoothly.",
          editor_type: "monaco_python",
          project_mode: "debug",
          starter_code: `# Servo PWM Controller - Fix the Bug
angles = [0, 45, 90, 180]
for angle in angles:
    # Bug: Division operator produces float when integer duty cycle is expected
    duty_cycle = int((angle / 180.0) * 1023)
    print(f"Angle: {angle}° -> PWM Duty: {duty_cycle}")
`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "debug",
        },
      },
      {
        id: "robot_iot",
        label: "Smart IoT Greenhouse (+40 XP)",
        icon: "Thermometer",
        colorClass: "text-cyan-700 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-800",
        item: {
          id: crypto.randomUUID(),
          title: "Smart Greenhouse Automation System",
          instructions: "Monitor temperature and soil moisture. Automatically trigger the water pump and cooling fan when needed.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# Smart IoT Greenhouse
soil_moisture = 22  # Percentage
temperature_c = 31

print(f"Greenhouse Telemetry: Soil={soil_moisture}%, Temp={temperature_c}°C")
if soil_moisture < 30:
    print("💧 Activating Water Pump for 5 seconds...")
if temperature_c > 28:
    print("❄️ Activating Greenhouse Exhaust Fan...")
`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "robot_capstone",
        label: "Robotics Capstone (+100 XP)",
        icon: "Trophy",
        colorClass: "text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-800",
        item: {
          id: crypto.randomUUID(),
          title: "Capstone: Autonomous Factory Robot",
          instructions: "Program a state machine for an automated warehouse robot navigating stations, sorting packages, and returning to charger.",
          editor_type: "monaco_python",
          project_mode: "starter",
          starter_code: `# Warehouse Rover Autonomous State Machine
stations = ["Loading Dock", "Inspection Area", "Sorting Bay", "Shipping Container"]
battery = 100

for station in stations:
    print(f"Navigating to {station}...")
    battery -= 15
    print(f"Station reached. Battery remaining: {battery}%")

if battery < 50:
    print("⚡ Mission Complete. Returning to charging dock!")
`,
          is_assignment: true,
          xp_reward: 100,
          status: "published",
          type: "assignment",
        },
      },
    ];
  }

  if (track === "web") {
    return [
      {
        id: "web_landing",
        label: "Portfolio Page (+40 XP)",
        icon: "Globe",
        colorClass: "text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800",
        item: {
          id: crypto.randomUUID(),
          title: "My Creative Developer Portfolio",
          instructions: "Design your personalized portfolio card with HTML and CSS styling. Add an avatar, skill badges, and a contact button!",
          editor_type: "monaco_html",
          project_mode: "starter",
          starter_code: `<div style="font-family: sans-serif; text-align: center; padding: 24px; background: #1e1b4b; color: white; border-radius: 16px;">
  <h1>🚀 Alex the Coder</h1>
  <p>Young Maker & STEM Explorer</p>
  <div style="display: flex; justify-content: center; gap: 8px; margin-top: 12px;">
    <span style="background: #4338ca; padding: 4px 12px; border-radius: 99px;">Python</span>
    <span style="background: #059669; padding: 4px 12px; border-radius: 99px;">Web Dev</span>
    <span style="background: #d97706; padding: 4px 12px; border-radius: 99px;">Robotics</span>
  </div>
</div>`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "web_css",
        label: "CSS Flexbox Wizard (+40 XP)",
        icon: "Palette",
        colorClass: "text-pink-700 border-pink-200 hover:bg-pink-50 dark:border-pink-800",
        item: {
          id: crypto.randomUUID(),
          title: "CSS Card Grid & Hover Effects",
          instructions: "Use CSS Flexbox and transform transitions to create interactive cards that grow smoothly when hovered over.",
          editor_type: "monaco_html",
          project_mode: "starter",
          starter_code: `<div style="display: flex; gap: 16px; padding: 20px; font-family: sans-serif;">
  <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
    <h3>Card 1</h3>
    <p>Hover me!</p>
  </div>
  <div style="background: #10b981; color: white; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
    <h3>Card 2</h3>
    <p>Flex layout!</p>
  </div>
</div>`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "web_js",
        label: "Clicker Counter App (+50 XP)",
        icon: "Zap",
        colorClass: "text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-800",
        item: {
          id: crypto.randomUUID(),
          title: "JavaScript Space Cookie Clicker",
          instructions: "Program interactive JavaScript state: increase points when clicking the button, and unlock upgrades at 10 and 25 clicks!",
          editor_type: "monaco_html",
          project_mode: "starter",
          starter_code: `<div style="text-align:center; padding: 30px; font-family: sans-serif;">
  <h2>🍪 Space Energy Clicker</h2>
  <h1 id="count" style="font-size: 48px; color: #f59e0b;">0</h1>
  <button onclick="handleClick()" style="font-size: 18px; padding: 10px 24px; border-radius: 8px; background: #6366f1; color: white; border: none; cursor: pointer;">
    Generate Energy! ⚡
  </button>
  <script>
    let points = 0;
    function handleClick() {
      points++;
      document.getElementById('count').textContent = points;
    }
  </script>
</div>`,
          is_assignment: false,
          xp_reward: 50,
          status: "published",
          type: "practice",
        },
      },
      {
        id: "web_debug",
        label: "Fix Broken Layout (+40 XP)",
        icon: "Bug",
        colorClass: "text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800",
        item: {
          id: crypto.randomUUID(),
          title: "Bug Hunt: Broken Responsive Navbar",
          instructions: "The navigation links are overflowing and overlapping the header text. Fix the CSS styles so they align cleanly side-by-side.",
          editor_type: "monaco_html",
          project_mode: "debug",
          starter_code: `<div style="background: #0f172a; color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center; font-family: sans-serif;">
  <h3>STEM Hub</h3>
  <div style="display: flex; gap: 12px;">
    <a href="#" style="color: #38bdf8; text-decoration: none;">Home</a>
    <a href="#" style="color: #38bdf8; text-decoration: none;">Lessons</a>
    <a href="#" style="color: #38bdf8; text-decoration: none;">Projects</a>
  </div>
</div>`,
          is_assignment: false,
          xp_reward: 40,
          status: "published",
          type: "debug",
        },
      },
      {
        id: "web_capstone",
        label: "Web App Capstone (+100 XP)",
        icon: "Trophy",
        colorClass: "text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-800",
        item: {
          id: crypto.randomUUID(),
          title: "Capstone: Interactive STEM Quiz & Flashcard App",
          instructions: "Build a complete web application with interactive quiz flashcards, flip animations, score tracking, and restart button.",
          editor_type: "monaco_html",
          project_mode: "starter",
          starter_code: `<div style="max-width: 400px; margin: 20px auto; padding: 24px; border: 1px solid #cbd5e1; border-radius: 12px; text-align: center; font-family: sans-serif;">
  <h3>STEM Flashcard #1</h3>
  <p id="card-text" style="font-size: 18px; margin: 20px 0;">What is the brain of a computer called?</p>
  <button onclick="flip()" style="padding: 8px 16px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer;">Flip Card</button>
  <script>
    let flipped = false;
    function flip() {
      flipped = !flipped;
      document.getElementById('card-text').textContent = flipped ? "CPU (Central Processing Unit)" : "What is the brain of a computer called?";
    }
  </script>
</div>`,
          is_assignment: true,
          xp_reward: 100,
          status: "published",
          type: "assignment",
        },
      },
    ];
  }

  // Default / Python track
  return [
    {
      id: "python_vars",
      label: "Python Variables Lab (+40 XP)",
      icon: "Code",
      colorClass: "text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800",
      item: {
        id: crypto.randomUUID(),
        title: "Variables, Lists & Calculations",
        instructions: "1. Create a list named `my_list = [10, 20, 30]`.\n2. Add a new number with `.append()`.\n3. Print the list and its total length!",
        editor_type: "monaco_python",
        project_mode: "starter",
        starter_code: `# Python Variables & Lists
my_list = [1, 2, 3]
print("Starting list:", my_list)

my_list.append(4)
print("Updated list:", my_list)
print("Total elements:", len(my_list))
`,
        is_assignment: false,
        xp_reward: 40,
        status: "published",
        type: "practice",
      },
    },
    {
      id: "python_debug",
      label: "Python Debug Challenge (+50 XP)",
      icon: "Bug",
      colorClass: "text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800",
      item: {
        id: crypto.randomUUID(),
        title: "Bug Hunt: Fix the Python Algorithm",
        instructions: "There are 2 intentional syntax and logic errors in this script. Find them, fix the code, and run it to test output!",
        editor_type: "monaco_python",
        project_mode: "debug",
        starter_code: `def calculate_speed(distance, time):
    # Fix the calculation bug
    speed = distance / time
    print(f"Calculated Speed: {speed} m/s")

calculate_speed(100, 5)
`,
        is_assignment: false,
        xp_reward: 50,
        status: "published",
        type: "debug",
        hints: [{ step: 1, text: "Check parameter names and mathematical operators." }],
      },
    },
    {
      id: "python_loops",
      label: "Loops & Conditions (+40 XP)",
      icon: "Repeat",
      colorClass: "text-blue-700 border-blue-200 hover:bg-blue-50 dark:border-blue-800",
      item: {
        id: crypto.randomUUID(),
        title: "Loop Master: Filtering Even & Odd Numbers",
        instructions: "Loop through a list of scores and print which ones are above 70 with an encouraging message.",
        editor_type: "monaco_python",
        project_mode: "starter",
        starter_code: `scores = [65, 82, 94, 58, 77, 90]

for score in scores:
    if score >= 70:
        print(f"Great score: {score} (PASSED)")
    else:
        print(f"Score: {score} (Keep practicing!)")
`,
        is_assignment: false,
        xp_reward: 40,
        status: "published",
        type: "practice",
      },
    },
    {
      id: "scratch_game",
      label: "Scratch Arcade Game (+40 XP)",
      icon: "Gamepad",
      colorClass: "text-orange-700 border-orange-200 hover:bg-orange-50 dark:border-orange-800",
      item: {
        id: crypto.randomUUID(),
        title: "Scratch Game Builder Challenge",
        instructions: "Open Scratch and assemble block scripts to make your sprite collect falling stars and score points!",
        editor_type: "scratch",
        project_mode: "standard",
        external_url: "https://scratch.mit.edu/projects/editor/",
        is_assignment: false,
        xp_reward: 40,
        status: "published",
        type: "practice",
      },
    },
    {
      id: "capstone",
      label: "Capstone Project (+100 XP)",
      icon: "Trophy",
      colorClass: "text-purple-700 border-purple-200 hover:bg-purple-50 dark:border-purple-800",
      item: {
        id: crypto.randomUUID(),
        title: "Course Capstone: Full Showcase Project",
        instructions: "Build your complete independent project bringing together all the concepts you learned in this course!",
        editor_type: "monaco_python",
        project_mode: "starter",
        starter_code: `# STEM Course Capstone Project
def run_project():
    print("Welcome to my STEM Capstone Project!")
    # Add your functions, algorithms, and interactive logic here

run_project()
`,
        is_assignment: true,
        xp_reward: 100,
        status: "published",
        type: "assignment",
      },
    },
  ];
}

/**
 * AI Assistant generator that builds progressive Activities and matching Quizzes
 * for Beginner -> Intermediate -> Advanced levels.
 */
export function generateAIActivityAndQuiz(
  courseTitle: string,
  category: string,
  level: LearningLevel
): GeneratedActivityPackage {
  const track = detectCourseTrack(courseTitle, category);
  const cleanTitle = courseTitle || "STEM Course";

  if (level === "beginner") {
    return {
      level: "beginner",
      levelTitle: "Beginner Level (Ages 7–10)",
      progressionContext: "Foundation Stage: Introduces simple concepts, visual analogies, basic variable naming, and welcoming print statements.",
      activity: {
        id: crypto.randomUUID(),
        title: `${cleanTitle}: Beginner Discovery Lab`,
        instructions: `Welcome, young explorer! In this activity, we will learn how ${cleanTitle} works step-by-step:\n1. Open the code editor and look at the variables.\n2. Change the name to your own name.\n3. Click 'Run' to see your personalized output in the terminal!`,
        editor_type: track === "web" ? "monaco_html" : track === "scratch" ? "scratch" : "monaco_python",
        project_mode: "starter",
        starter_code: track === "web"
          ? `<div style="font-family: sans-serif; text-align: center; padding: 24px; background: #e0f2fe; border-radius: 12px;">\n  <h1>👋 Welcome to ${cleanTitle}!</h1>\n  <p>Created by: Young Explorer</p>\n</div>`
          : `# Beginner Discovery Lab: ${cleanTitle}
student_name = "Young Explorer"
mission = "Learn the basics of ${cleanTitle}"

print(f"Mission briefing for: {student_name}")
print(f"Goal: {mission}")
print("Step 1 complete! You are ready to explore!")
`,
        is_assignment: false,
        xp_reward: 40,
        status: "published",
        type: "practice",
        hints: [
          { step: 1, text: "Look for quotes '...' around text. Text inside quotes is called a string!" },
          { step: 2, text: "Click the green 'Run' button to see your code in action." }
        ],
      },
      quiz: {
        id: crypto.randomUUID(),
        title: `${cleanTitle} - Beginner Quick Quiz`,
        pass_percentage: 70,
        questions: [
          {
            id: crypto.randomUUID(),
            question: `What does a computer program use a 'variable' for in ${cleanTitle}?`,
            options: [
              "To store and remember information like names or numbers",
              "To turn off the computer",
              "To draw random squiggles",
              "To delete all files"
            ],
            correctAnswer: 0,
            explanation: "A variable is like a labeled storage box that holds information for our program to use later."
          },
          {
            id: crypto.randomUUID(),
            question: "In Python, which function do we use to show a message on the screen?",
            options: ["display.now()", "print()", "shout()", "write.text()"],
            correctAnswer: 1,
            explanation: "The print() function outputs whatever text or variables we pass inside its parentheses to the terminal."
          },
          {
            id: crypto.randomUUID(),
            question: "What symbol surrounds a text string in code?",
            options: ["Quotes (' ' or \" \")", "Hashtags (#)", "Plus signs (+)", "Percent signs (%)"],
            correctAnswer: 0,
            explanation: "Text is wrapped inside single quotes ('...') or double quotes (\"...\") so the computer knows it is words and not code commands."
          }
        ]
      }
    };
  }

  if (level === "intermediate") {
    return {
      level: "intermediate",
      levelTitle: "Intermediate Level (Ages 11–14)",
      progressionContext: "Building on Beginner basics: Introduces lists, loops, if/else conditions, mathematical evaluations, and interactive logic.",
      activity: {
        id: crypto.randomUUID(),
        title: `${cleanTitle}: Logic & Decision Engine`,
        instructions: `Now that you know the basics, let's build dynamic logic!\n1. We have a list of sensor readings or inputs.\n2. Use a for-loop to inspect each item.\n3. Use an if-statement to check if values exceed the threshold and print the action!`,
        editor_type: track === "web" ? "monaco_html" : track === "scratch" ? "scratch" : "monaco_python",
        project_mode: "starter",
        starter_code: track === "web"
          ? `<div style="font-family: sans-serif; max-width: 450px; margin: 20px auto; padding: 20px; border: 2px solid #3b82f6; border-radius: 12px;">\n  <h3>${cleanTitle} Decision Engine</h3>\n  <button onclick="checkStatus()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">Evaluate Inputs</button>\n  <div id="output" style="margin-top: 12px; font-weight: bold;"></div>\n  <script>\n    function checkStatus() {\n      document.getElementById('output').textContent = "Status: All checks passed! (Intermediate Logic Verified)";\n    }\n  </script>\n</div>`
          : `# Intermediate Decision Engine: ${cleanTitle}
data_points = [22, 45, 18, 76, 95]
threshold = 50

print(f"Analyzing {len(data_points)} data points against threshold {threshold}...")

for point in data_points:
    if point >= threshold:
        print(f"⚠️ High value detected: {point} -> Triggering alert response!")
    else:
        print(f"✅ Normal value: {point}")
`,
        is_assignment: false,
        xp_reward: 60,
        status: "published",
        type: "practice",
        hints: [
          { step: 1, text: "Try adding a new number greater than 100 to data_points to test the condition!" },
          { step: 2, text: "You can use len(data_points) to count how many items are in the list." }
        ],
      },
      quiz: {
        id: crypto.randomUUID(),
        title: `${cleanTitle} - Intermediate Mastery Quiz`,
        pass_percentage: 70,
        questions: [
          {
            id: crypto.randomUUID(),
            question: "What is the purpose of a 'for loop' in programming?",
            options: [
              "To repeat a block of code for each item in a collection or list",
              "To stop the program immediately",
              "To change the screen brightness",
              "To delete a variable"
            ],
            correctAnswer: 0,
            explanation: "A for loop allows our code to iterate through every item in a list without needing to write the same line repeatedly."
          },
          {
            id: crypto.randomUUID(),
            question: "How do you add an item to the end of a Python list named 'my_list'?",
            options: [
              "my_list.append(item)",
              "my_list.push_back(item)",
              "my_list + item",
              "insert.item(my_list)"
            ],
            correctAnswer: 0,
            explanation: "The .append() method places the new element at the very end of the list."
          },
          {
            id: crypto.randomUUID(),
            question: "Which keyword is used in Python for an alternative condition if the first 'if' is false?",
            options: ["elif", "else if", "otherwise", "then"],
            correctAnswer: 0,
            explanation: "Python uses 'elif' (short for else if) to check secondary conditions in an if-statement chain."
          },
          {
            id: crypto.randomUUID(),
            question: "What is the result of len([5, 10, 15, 20])?",
            options: ["4", "50", "20", "0"],
            correctAnswer: 0,
            explanation: "len() returns the count of items in the list, which has 4 numbers here."
          }
        ]
      }
    };
  }

  // Advanced level
  return {
    level: "advanced",
    levelTitle: "Advanced Level (Ages 15+)",
    progressionContext: "Mastery Stage: Integrates modular functions, algorithmic thinking, data modeling, automated testing, and full capstone design.",
    activity: {
      id: crypto.randomUUID(),
      title: `${cleanTitle}: Advanced Architecture & Capstone`,
      instructions: `Congratulations on reaching the advanced level!\nIn this project, you will build a complete modular system with function definitions, data validations, and error handling.\nTest edge cases and ensure your output meets the passing rubric!`,
      editor_type: track === "web" ? "monaco_html" : track === "scratch" ? "scratch" : "monaco_python",
      project_mode: "starter",
      starter_code: track === "web"
        ? `<div style="font-family: system-ui; max-width: 600px; margin: 30px auto; padding: 24px; background: #0f172a; color: #e2e8f0; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">\n  <h2>🛠️ ${cleanTitle} Advanced System</h2>\n  <p>Status: All algorithmic modules active.</p>\n  <div id="stats" style="padding: 12px; background: #1e293b; border-radius: 8px; font-family: monospace;">Execution Latency: 4ms | Accuracy: 98.4%</div>\n</div>`
        : `# Advanced System Architecture: ${cleanTitle}
def analyze_dataset(records):
    """Computes summary statistics and identifies anomalies."""
    if not records:
        return {"count": 0, "average": 0, "anomalies": []}
    
    total = sum(records)
    avg = total / len(records)
    anomalies = [r for r in records if r > avg * 1.5 or r < avg * 0.5]
    
    return {
        "count": len(records),
        "average": round(avg, 2),
        "anomalies": anomalies
    }

# Test with production dataset
telemetry = [42, 45, 43, 98, 44, 41, 12, 46]
report = analyze_dataset(telemetry)

print("=== ${cleanTitle} Audit Report ===")
print("Records processed:", report["count"])
print("Average value:", report["average"])
print("Detected anomalies:", report["anomalies"])
`,
      is_assignment: true,
      xp_reward: 100,
      status: "published",
      type: "assignment",
      hints: [
        { step: 1, text: "Docstrings (\"\"\"...\"\"\") document the purpose and return types of functions." },
        { step: 2, text: "List comprehensions offer concise and elegant ways to filter collections." }
      ],
    },
    quiz: {
      id: crypto.randomUUID(),
      title: `${cleanTitle} - Advanced Certification Exam`,
      pass_percentage: 70,
      questions: [
        {
          id: crypto.randomUUID(),
          question: "Why are functions essential when building large-scale software in STEM projects?",
          options: [
            "They make code reusable, modular, easier to test, and prevent repetition",
            "They make the computer run at double clock speed",
            "They permanently freeze memory",
            "They eliminate the need to write tests"
          ],
          correctAnswer: 0,
          explanation: "Functions encapsulate specific responsibilities, enabling clean code reuse and easier debugging."
        },
        {
          id: crypto.randomUUID(),
          question: "What does a time complexity of O(1) describe?",
          options: [
            "Constant time: the operation takes the same amount of time regardless of data size",
            "Linear time: the operation takes longer as data grows",
            "Infinite time: the operation never terminates",
            "Quadratic time: the operation loops twice"
          ],
          correctAnswer: 0,
          explanation: "O(1) signifies constant time complexity, such as dictionary key lookup in Python."
        },
        {
          id: crypto.randomUUID(),
          question: "In Python, which built-in function calculates the sum of all numeric items in an iterable?",
          options: ["sum()", "total()", "add_all()", "count()"],
          correctAnswer: 0,
          explanation: "sum() aggregates all numbers in a list, tuple, or iterable."
        },
        {
          id: crypto.randomUUID(),
          question: "What happens if a program attempts to divide a number by zero?",
          options: [
            "A ZeroDivisionError is raised",
            "The computer automatically converts it to infinity without warning",
            "The program formats the hard drive",
            "The result evaluates to None"
          ],
          correctAnswer: 0,
          explanation: "Division by zero is mathematically undefined and triggers a ZeroDivisionError in Python."
        }
      ]
    }
  };
}
