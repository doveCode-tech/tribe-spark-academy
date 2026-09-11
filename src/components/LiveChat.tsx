import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  created_at: string;
}

interface ChatUser {
  auth_user_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
}

interface LiveChatProps {
  isWidget?: boolean;
}

export function LiveChat({ isWidget = false }: LiveChatProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedContactRef = useRef<ChatUser | null>(null);

  // Keep ref in sync so real-time callback always has current selected contact
  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const isStudent = (userProfile?.role || "").toLowerCase() === "student";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch appropriate contacts
  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      try {
        setLoading(true);
        if (isStudent) {
          // Students: fetch all users then filter out other students client-side
          // This avoids brittle server-side role string matching
          const { data, error } = await supabase
            .from("users")
            .select("auth_user_id, name, first_name, last_name, email, role, avatar_url")
            .neq("auth_user_id", user.id)
            .order("role", { ascending: true });

          if (error) throw error;

          // Only show tutors, ultimate tutors, and admins — never other students
          const staffContacts = (data || []).filter(u => {
            const role = (u.role || "").toLowerCase().replace(/[\s-]/g, "_");
            return role === "tutor" || role === "ultimate_tutor" || role === "admin";
          });

          setContacts(staffContacts);
          if (staffContacts.length > 0 && !selectedContactRef.current) {
            setSelectedContact(staffContacts[0]);
          }
        } else {
          // Staff (admin/tutors) can see students and fellow staff to supervise and answer questions
          const { data, error } = await supabase
            .from("users")
            .select("auth_user_id, name, first_name, last_name, email, role, avatar_url")
            .order("created_at", { ascending: false });

          if (error) throw error;
          const filtered = (data || []).filter(u => u.auth_user_id !== user.id);
          setContacts(filtered);
          if (filtered.length > 0 && !selectedContactRef.current) {
            const firstStudent = filtered.find(u => (u.role || "").toLowerCase() === "student") || filtered[0];
            setSelectedContact(firstStudent);
          }
        }
      } catch (err: any) {
        console.error("Error fetching chat contacts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [user, isStudent]);

  // Global Realtime listener across all messages for the current user
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-chat-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          const currentSelected = selectedContactRef.current;

          if (isStudent) {
            // Students: show any message they sent or received from anyone
            const involvesMe = newMsg.sender_id === user.id || newMsg.recipient_id === user.id;
            if (involvesMe) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              // Increment unread if from someone other than current contact
              if (
                newMsg.sender_id !== user.id &&
                currentSelected &&
                newMsg.sender_id !== currentSelected.auth_user_id
              ) {
                setUnreadCounts((prev) => ({
                  ...prev,
                  [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
                }));
              }
            }
            return;
          }

          // Check if message belongs to current active conversation (staff view)
          const isViewingStudentContact =
            !isStudent &&
            currentSelected &&
            (currentSelected.role || "").toLowerCase() === "student";

          const isCurrentConvo =
            currentSelected &&
            (
              // Normal: current user is in the conversation
              (newMsg.sender_id === user.id && newMsg.recipient_id === currentSelected.auth_user_id) ||
              (newMsg.sender_id === currentSelected.auth_user_id && (newMsg.recipient_id === user.id || !newMsg.recipient_id)) ||
              // Staff supervision: viewing a student — show all messages involving that student
              (isViewingStudentContact && (
                newMsg.sender_id === currentSelected.auth_user_id ||
                newMsg.recipient_id === currentSelected.auth_user_id
              ))
            );

          if (isCurrentConvo) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (newMsg.sender_id !== user.id && (newMsg.recipient_id === user.id || !newMsg.recipient_id)) {
            // Message from another contact -> increment unread count for that sender
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isStudent]);

  // Fetch messages with the selected contact
  const fetchMessages = async (contact: ChatUser) => {
    if (!user || !contact) return;

    try {
      const isViewingStudent =
        !isStudent && (contact.role || "").toLowerCase() === "student";

      let query;
      if (isStudent) {
        // Students: fetch ALL messages they sent or received (from any staff member)
        // so they never miss a message regardless of which contact is selected
        query = supabase
          .from("chat_messages")
          .select("*")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);
      } else if (isViewingStudent) {
        // Staff supervision: show ALL messages where this student is sender or recipient
        query = supabase
          .from("chat_messages")
          .select("*")
          .or(
            `sender_id.eq.${contact.auth_user_id},recipient_id.eq.${contact.auth_user_id}`
          );
      } else {
        // Normal two-way thread between current user and contact
        query = supabase
          .from("chat_messages")
          .select("*")
          .or(
            `and(sender_id.eq.${user.id},recipient_id.eq.${contact.auth_user_id}),and(sender_id.eq.${contact.auth_user_id},recipient_id.eq.${user.id})`
          );
      }

      const { data, error } = await query.order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);
      // Clear unread for this contact
      setUnreadCounts((prev) => {
        const next = { ...prev };
        delete next[contact.auth_user_id];
        return next;
      });
    } catch (err) {
      console.error("Error in fetchMessages:", err);
    }
  };

  useEffect(() => {
    if (selectedContact) {
      fetchMessages(selectedContact);
    }
  }, [selectedContact, user]);

  const handleSelectContact = (contact: ChatUser) => {
    setSelectedContact(contact);
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[contact.auth_user_id];
      return next;
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user || !selectedContact || sending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      const { data, error } = await supabase.from("chat_messages").insert({
        sender_id: user.id,
        recipient_id: selectedContact.auth_user_id,
        message: messageText,
      }).select();

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast({
        title: "Could not send message",
        description: err?.message || "Please check your network connection.",
        variant: "destructive",
      });
      setInputMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const getContactName = (contact: ChatUser) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
    }
    return contact.name || contact.email || "User";
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/20 text-xs">Admin</Badge>;
      case "ultimate_tutor":
        return <Badge className="bg-purple-500/15 text-purple-600 hover:bg-purple-500/20 text-xs">Lead Tutor</Badge>;
      case "tutor":
        return <Badge className="bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 text-xs">Tutor</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Student</Badge>;
    }
  };

  return (
    <Card className={`shadow-card border border-border flex overflow-hidden ${
      isWidget ? "h-full w-full rounded-none border-0 shadow-none" : "h-[calc(100vh-12rem)] min-h-[550px]"
    }`}>
      {/* Left Contacts Sidebar */}
      <div className={`${isWidget ? "w-44 sm:w-56" : "w-80"} border-r border-border flex flex-col bg-muted/20`}>
        <div className="p-3 border-b border-border bg-card">
          <h2 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-primary" />
            {isStudent ? "Tutors" : "Conversations"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {isStudent 
              ? "Ask questions or get help directly from tutors & admins!" 
              : "Help students, supervise chats, and answer questions."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isStudent ? "No tutors currently available" : "No student conversations"}
            </div>
          ) : (
            contacts.map((contact) => {
              const isSelected = selectedContact?.auth_user_id === contact.auth_user_id;
              const name = getContactName(contact);
              const unread = unreadCounts[contact.auth_user_id] || 0;
              return (
                <button
                  key={contact.auth_user_id}
                  onClick={() => handleSelectContact(contact)}
                  className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                        {unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-sm truncate text-foreground">{name}</span>
                      {getRoleBadge(contact.role)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Area */}
      <div className="flex-1 flex flex-col bg-card">
        {selectedContact ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedContact.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                    {getContactName(selectedContact).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">
                      {getContactName(selectedContact)}
                    </h3>
                    {getRoleBadge(selectedContact.role)}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                </div>
              </div>

              {isStudent && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 py-1 px-2.5 rounded-full">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span>Safe Tutor Chat</span>
                </div>
              )}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">Start a conversation</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {isStudent
                      ? `Send a message to ${getContactName(selectedContact)} to ask for assistance, feedback, or guidance.`
                      : `Send a reply or check in on ${getContactName(selectedContact)}'s learning journey.`}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className={isMine ? "bg-primary text-primary-foreground text-xs" : "bg-muted text-xs font-bold"}>
                          {isMine ? (userProfile?.name || "Me").slice(0, 2).toUpperCase() : getContactName(selectedContact).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-card border border-border text-foreground rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1 block">
                          {time}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3.5 border-t border-border bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    isStudent
                      ? "Ask your tutor a question..."
                      : `Reply to ${getContactName(selectedContact)}...`
                  }
                  disabled={sending}
                  className="flex-1 text-sm h-10"
                />
                <Button 
                  type="submit" 
                  disabled={!inputMessage.trim() || sending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-10 px-4"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Send
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">Select a contact to begin messaging</p>
          </div>
        )}
      </div>
    </Card>
  );
}
