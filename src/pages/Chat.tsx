import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Lightbulb, BookOpen, HelpCircle, MessageSquare, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveChat } from "@/components/LiveChat";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: number;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const quickQuestions = [
  "How do I debug my Python code?",
  "What's the difference between variables and constants?",
  "How do I upload my project?",
  "Can you explain loops in programming?",
  "What should I learn next?",
  "How do I get help with my assignment?"
];

const Chat = () => {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Hi Alex! I'm your AI learning assistant. I'm here to help you with your coding questions, explain concepts, or guide you through your STEMTribe journey. What would you like to know today?",
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: Date.now() + 1,
        content: getAIResponse(inputMessage),
        sender: "ai",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const getAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes("python") || input.includes("debug")) {
      return "Great question about Python! When debugging, try these steps: 1) Read error messages carefully, 2) Use print statements to check variable values, 3) Break your code into smaller parts to test. Would you like me to explain any specific error you're seeing?";
    }
    
    if (input.includes("variable") || input.includes("constant")) {
      return "Variables are like containers that can hold different values and can be changed during your program. Constants are values that don't change once set. Think of a variable like a box you can put different things in, while a constant is like a label that always says the same thing!";
    }
    
    if (input.includes("upload") || input.includes("project")) {
      return "To upload your project: 1) Go to your course page, 2) Click on the assignment, 3) Click 'Submit Project', 4) Upload your files or paste your code link. Make sure to include a description of what your project does!";
    }
    
    if (input.includes("loop")) {
      return "Loops are like giving your computer instructions to repeat something! There are two main types: 'for' loops (repeat a specific number of times) and 'while' loops (repeat until something is true/false). Think of it like telling someone to 'count to 10' or 'keep walking until you reach the door'.";
    }
    
    if (input.includes("next") || input.includes("learn")) {
      return "Based on your progress, I recommend exploring data structures next! You've done great with Python basics. You might enjoy learning about lists and dictionaries, or maybe try the Arduino Robotics course to build something physical!";
    }
    
    return "That's an interesting question! I'm here to help you learn and grow. Can you tell me more about what specific topic you're working on? I can provide explanations, coding tips, or help you understand concepts better.";
  };

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  return (
    <LMSLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Tabs defaultValue={searchParams.get("tab") === "ai" ? "ai" : "live"} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-card border border-border p-1">
              <TabsTrigger value="live" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <MessageSquare className="w-4 h-4" />
                Live Tutor Chat
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <Sparkles className="w-4 h-4" />
                AI Learning Assistant
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="live" className="mt-0">
            <LiveChat />
          </TabsContent>

          <TabsContent value="ai" className="mt-0">
            <Card className="shadow-card h-[600px] flex flex-col">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-6 h-6 text-primary" />
                  AI Learning Assistant
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about coding, courses, or your learning journey!
                </p>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        {message.sender === "ai" ? (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot className="w-4 h-4" />
                          </AvatarFallback>
                        ) : (
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className={`max-w-[80%] ${message.sender === "user" ? "text-right" : ""}`}>
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            message.sender === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Questions */}
                <div className="border-t p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="w-4 h-4" />
                      Quick questions to get started:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {quickQuestions.map((question, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-left justify-start h-auto py-2 px-3"
                          onClick={() => handleQuickQuestion(question)}
                        >
                          <HelpCircle className="w-3 h-3 mr-2 shrink-0" />
                          <span className="text-xs">{question}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask me anything about your learning..."
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage} size="icon">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LMSLayout>
  );
};

export default Chat;