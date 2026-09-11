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

// Helper: normalize role string for comparison
function normalizeRole(role: string | null): string {
  return (role || "").toLowerCase().replace(/[\s-]/g, "_");
}

function isStaffRole(role: string | null): boolean {
  const r = normalizeRole(role);
  return r === "tutor" || r === "ultimate_tutor" || r === "admin";
}

export function LiveChat({ isWidget = false }: LiveChatProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]); // for sender lookup
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedContactRef = useRef<ChatUser | null>(null);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const isStudent = normalizeRole(userProfile?.role) === "student";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all users for sender lookup, plus filtered contacts for sidebar
  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      try {
        setLoading(true);

        // Always fetch all users so we can resolve sender names/roles
        const { data, error } = await supabase
          .from("users")
          .select("auth_user_id, name, first_name, last_name, email, role, avatar_url")
          .neq("auth_user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const users = data || [];
        setAllUsers(users);

        if (isStudent) {
          // Students: only show staff in sidebar
          const staffContacts = users.filter(u => isStaffRole(u.role));
          setContacts(staffContacts);
          if (staffContacts.length > 0 && !selectedContactRef.current) {
            setSelectedContact(staffContacts[0]);
          }
        } else {
          // Staff: show everyone (students first)
          setContacts(users);
          if (users.length > 0 && !selectedContactRef.current) {
            const firstStudent = users.find(u => normalizeRole(u.role) === "student") || users[0];
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

  // Global Realtime listener
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
            // Students: show any message they sent or received
            const involvesMe = newMsg.sender_id === user.id || newMsg.recipient_id === user.id;
            if (involvesMe) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
            return;
          }

          // Staff view: check if the message involves the currently-selected student
          if (currentSelected) {
            const isViewingStudent = normalizeRole(currentSelected.role) === "student";

            const isCurrentConvo = isViewingStudent
              ? // Viewing a student: show ALL messages involving that student
                newMsg.sender_id === currentSelected.auth_user_id ||
                newMsg.recipient_id === currentSelected.auth_user_id
              : // Viewing another staff: normal two-way
                (newMsg.sender_id === user.id && newMsg.recipient_id === currentSelected.auth_user_id) ||
                (newMsg.sender_id === currentSelected.auth_user_id && newMsg.recipient_id === user.id);

            if (isCurrentConvo) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              return;
            }
          }

          // Not in current view — increment unread
          if (newMsg.sender_id !== user.id && (newMsg.recipient_id === user.id || !newMsg.recipient_id)) {
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

  // Fetch messages when contact changes
  const fetchMessages = async (contact: ChatUser) => {
    if (!user || !contact) return;

    try {
      const isViewingStudent =
        !isStudent && normalizeRole(contact.role) === "student";

      let query;
      if (isStudent) {
        // Student: fetch ALL their messages (sent or received) — unified thread
        query = supabase
          .from("chat_messages")
          .select("*")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);
      } else if (isViewingStudent) {
        // Staff viewing a student: all messages involving that student
        query = supabase
          .from("chat_messages")
          .select("*")
          .or(
            `sender_id.eq.${contact.auth_user_id},recipient_id.eq.${contact.auth_user_id}`
          );
      } else {
        // Staff-to-staff: normal two-way thread
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

  // Look up a user by auth_user_id from allUsers cache
  const getUserById = (id: string): ChatUser | undefined => {
    return allUsers.find(u => u.auth_user_id === id);
  };

  const getRoleBadge = (role: string | null) => {
    const r = normalizeRole(role);
    switch (r) {
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

  /**
   * Determine which side a message appears on.
   *
   * UNIFIED SUPPORT CHANNEL LOGIC:
   * - Student view: Student's own messages → RIGHT. All staff messages → LEFT (as "Tutor").
   * - Staff viewing a student: Student's messages → LEFT. Any staff message → RIGHT (unified "our side").
   * - Staff viewing another staff: Normal — own messages RIGHT, other's LEFT.
   */
  const isMessageOnRight = (msg: ChatMessage): boolean => {
    if (isStudent) {
      // Student: own messages on right, everything else on left
      return msg.sender_id === user?.id;
    }

    // Staff member viewing
    if (selectedContact && normalizeRole(selectedContact.role) === "student") {
      // Viewing a student: student's messages on LEFT, all staff messages on RIGHT
      return msg.sender_id !== selectedContact.auth_user_id;
    }

    // Staff-to-staff: own messages on right
    return msg.sender_id === user?.id;
  };

  /**
   * Get the display initials for a message bubble.
   */
  const getMessageInitials = (msg: ChatMessage, onRight: boolean): string => {
    if (isStudent) {
      if (onRight) {
        return (userProfile?.name || "Me").slice(0, 2).toUpperCase();
      }
      // Staff message — show "T" for Tutor (unified)
      return "T";
    }

    // Staff view
    if (onRight) {
      // This is a staff message — could be from self or another staff member
      if (msg.sender_id === user?.id) {
        return (userProfile?.name || "Me").slice(0, 2).toUpperCase();
      }
      // Another staff member sent this
      const sender = getUserById(msg.sender_id);
      if (sender) return getContactName(sender).slice(0, 2).toUpperCase();
      return "ST";
    }

    // Left side = selected contact (student)
    if (selectedContact) {
      return getContactName(selectedContact).slice(0, 2).toUpperCase();
    }
    return "??";
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
                      ? "Send a message to get help from your tutors. All your tutors and admins can see and reply."
                      : `Send a reply or check in on ${getContactName(selectedContact)}'s learning journey.`}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const onRight = isMessageOnRight(msg);
                  const initials = getMessageInitials(msg, onRight);
                  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                  // For staff viewing a student: show which staff member sent a "right side" message
                  let staffLabel: string | null = null;
                  if (!isStudent && selectedContact && normalizeRole(selectedContact.role) === "student" && onRight) {
                    if (msg.sender_id === user?.id) {
                      staffLabel = "You";
                    } else {
                      const sender = getUserById(msg.sender_id);
                      if (sender) {
                        staffLabel = getContactName(sender);
                      }
                    }
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${onRight ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className={onRight ? "bg-primary text-primary-foreground text-xs" : "bg-muted text-xs font-bold"}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] ${onRight ? "items-end" : "items-start"}`}>
                        {staffLabel && (
                          <span className={`text-[10px] text-muted-foreground mb-0.5 px-1 block ${onRight ? "text-right" : ""}`}>
                            {staffLabel}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                            onRight
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
