import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Shield, Paperclip, X, Pencil, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { soundEffects } from "@/utils/audio";
import { createNotification } from "@/utils/notifications";

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  edited_at?: string | null;
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

function normalizeRole(role: string | null): string {
  return (role || "").toLowerCase().replace(/[\s-]/g, "_");
}

export function LiveChat({ isWidget = false }: LiveChatProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

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

  // ─── Fetch all student messages (unified thread) ────────────────────────────
  const fetchStudentMessages = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: true });
      if (!error) setMessages(data || []);
    } catch (err) {
      console.error("Error fetching student messages:", err);
    }
  }, [user]);

  // ─── Fetch messages for staff viewing a student ─────────────────────────────
  const fetchMessages = useCallback(async (contact: ChatUser) => {
    if (!user || !contact) return;
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .or(`sender_id.eq.${contact.auth_user_id},recipient_id.eq.${contact.auth_user_id}`)
        .order("created_at", { ascending: true });
      if (!error) setMessages(data || []);
      setUnreadCounts(prev => { const next = { ...prev }; delete next[contact.auth_user_id]; return next; });
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [user]);

  // ─── Load contacts ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || userProfile === undefined || userProfile === null) return;

    const load = async () => {
      setLoading(true);
      try {
        if (isStudent) {
          // Students: load their own messages immediately, no contacts sidebar
          await fetchStudentMessages();
        } else {
          // Staff: load all users for sidebar + sender lookup
          const { data, error } = await supabase
            .from("users")
            .select("auth_user_id, name, first_name, last_name, email, role, avatar_url")
            .neq("auth_user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;
          const users = data || [];
          setAllUsers(users);

          // Sidebar shows only students
          const studentContacts = users.filter(u => normalizeRole(u.role) === "student");
          setContacts(studentContacts);
          if (studentContacts.length > 0 && !selectedContactRef.current) {
            setSelectedContact(studentContacts[0]);
          }
        }
      } catch (err) {
        console.error("Error loading chat:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, userProfile, isStudent]);

  // ─── Load messages when staff selects a student ─────────────────────────────
  useEffect(() => {
    if (!isStudent && selectedContact) {
      fetchMessages(selectedContact);
    }
  }, [selectedContact, isStudent]);

  // ─── Realtime listener ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`chat-main-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        const current = selectedContactRef.current;

        const isFromOther = newMsg.sender_id !== user.id;

        if (isStudent) {
          // Student: show any message involving them
          if (newMsg.sender_id === user.id || newMsg.recipient_id === user.id) {
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            if (isFromOther) soundEffects.playChime();
          }
          return;
        }

        // Staff: show if involves selected student
        if (current) {
          const involvesSelected =
            newMsg.sender_id === current.auth_user_id ||
            newMsg.recipient_id === current.auth_user_id;
          if (involvesSelected) {
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            if (isFromOther) soundEffects.playChime();
            return;
          }
        }

        // Unread: message from a student to this staff member
        if (newMsg.sender_id !== user.id && (newMsg.recipient_id === user.id || !newMsg.recipient_id)) {
          setUnreadCounts(prev => ({ ...prev, [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1 }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isStudent]);

  // ─── File handling ───────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setAttachmentPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAttachment = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `chat/${user!.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(data.path);
      return { url: urlData.publicUrl, name: file.name, type: file.type };
    } catch (err) {
      console.error("Upload failed:", err);
      return null;
    }
  };

  // ─── Send message ────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !attachmentFile) || !user || sending) return;
    if (!isStudent && !selectedContact) return;

    // Students broadcast to all staff (recipient_id = null)
    // Staff reply directly to selected student
    const recipientId = isStudent ? null : selectedContact!.auth_user_id;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setSending(true);

    try {
      let attachment: { url: string; name: string; type: string } | null = null;
      if (attachmentFile) {
        attachment = await uploadAttachment(attachmentFile);
        clearAttachment();
      }

      const payload: any = {
        sender_id: user.id,
        recipient_id: recipientId,
        message: messageText || (attachment ? attachment.name : ""),
      };
      if (attachment) {
        payload.attachment_url = attachment.url;
        payload.attachment_name = attachment.name;
        payload.attachment_type = attachment.type;
      }

      const { data, error } = await supabase.from("chat_messages").insert(payload).select();
      if (error) throw error;
      if (data?.length) {
        setMessages(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
        
        // Notify recipient(s)
        if (isStudent) {
          createNotification({
            recipientRole: "tutor",
            type: "chat_message",
            title: `New student message from ${userProfile?.name || "Student"}`,
            message: messageText || (attachment ? `Sent attachment: ${attachment.name}` : "New message"),
            data: { sender_id: user.id },
          });
        } else if (selectedContact) {
          createNotification({
            recipientUserId: selectedContact.auth_user_id,
            type: "chat_message",
            title: "New message from Tutor Support",
            message: messageText || (attachment ? `Sent attachment: ${attachment.name}` : "New message"),
            data: { sender_id: user.id },
          });
        }
      }
    } catch (err: any) {
      console.error("Send failed:", err);
      toast({ title: "Could not send message", description: err?.message || "Please try again.", variant: "destructive" });
      setInputMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // ─── Edit message ────────────────────────────────────────────────────────────
  const handleEditSave = async (msgId: string) => {
    if (!editText.trim()) { setEditingId(null); return; }
    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({ message: editText, edited_at: new Date().toISOString() } as any)
        .eq("id", msgId)
        .eq("sender_id", user!.id);

      if (!error) {
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, message: editText, edited_at: new Date().toISOString() } : m
        ));
      }
    } catch (err) {
      console.error("Edit failed:", err);
    }
    setEditingId(null);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getContactName = (contact: ChatUser) => {
    if (contact.first_name || contact.last_name) return `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
    return contact.name || contact.email || "User";
  };

  const getUserById = (id: string) => allUsers.find(u => u.auth_user_id === id);

  const getRoleBadge = (role: string | null) => {
    switch (normalizeRole(role)) {
      case "admin": return <Badge className="bg-red-500/15 text-red-600 text-xs">Admin</Badge>;
      case "ultimate_tutor": return <Badge className="bg-purple-500/15 text-purple-600 text-xs">Lead Tutor</Badge>;
      case "tutor": return <Badge className="bg-blue-500/15 text-blue-600 text-xs">Tutor</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Student</Badge>;
    }
  };

  // Determine which side a bubble goes on
  const isOnRight = (msg: ChatMessage): boolean => {
    if (isStudent) return msg.sender_id === user?.id;
    if (selectedContact && normalizeRole(selectedContact.role) === "student") {
      // Staff side: student on left, all staff on right
      return msg.sender_id !== selectedContact.auth_user_id;
    }
    return msg.sender_id === user?.id;
  };

  const getInitials = (msg: ChatMessage, onRight: boolean): string => {
    if (isStudent) {
      return onRight ? (userProfile?.name || "Me").slice(0, 2).toUpperCase() : "TS";
    }
    if (onRight) {
      if (msg.sender_id === user?.id) return (userProfile?.name || "Me").slice(0, 2).toUpperCase();
      const sender = getUserById(msg.sender_id);
      return sender ? getContactName(sender).slice(0, 2).toUpperCase() : "ST";
    }
    return selectedContact ? getContactName(selectedContact).slice(0, 2).toUpperCase() : "??";
  };

  const renderAttachment = (msg: ChatMessage) => {
    if (!msg.attachment_url) return null;
    const isImage = (msg.attachment_type || "").startsWith("image/");
    return (
      <div className="mt-2">
        {isImage ? (
          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
            <img src={msg.attachment_url} alt={msg.attachment_name || "image"} className="max-w-xs rounded-lg border border-white/20" />
          </a>
        ) : (
          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 text-xs underline hover:opacity-80 transition-opacity">
            <Paperclip className="w-3 h-3 shrink-0" />
            <span className="truncate">{msg.attachment_name || "Attachment"}</span>
          </a>
        )}
      </div>
    );
  };

  // ─── Chat panel (shared by student + staff) ──────────────────────────────────
  const chatPanel = (
    <div className="flex-1 flex flex-col bg-card min-w-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            {!isStudent && selectedContact && <AvatarImage src={selectedContact.avatar_url || undefined} />}
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              {isStudent ? "TS" : selectedContact ? getContactName(selectedContact).slice(0, 2).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">
                {isStudent ? "Tutor Support" : selectedContact ? getContactName(selectedContact) : "Select a student"}
              </h3>
              {!isStudent && selectedContact && getRoleBadge(selectedContact.role)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isStudent
                ? "All tutors & admins can see your messages"
                : selectedContact?.email || ""}
            </p>
          </div>
        </div>
        {isStudent && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 py-1 px-2.5 rounded-full">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>Safe Chat</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 min-h-0">
        {(!isStudent && !selectedContact) ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Select a student to view their conversation</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-semibold text-sm mb-1">No messages yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              {isStudent
                ? "Type a message below — your tutors will respond soon."
                : `No conversation with ${selectedContact ? getContactName(selectedContact) : "this student"} yet.`}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const onRight = isOnRight(msg);
            const initials = getInitials(msg, onRight);
            const time = msg.created_at
              ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const isEditing = editingId === msg.id;
            const canEdit = msg.sender_id === user?.id;

            // For staff viewing a student: label which staff member sent the right-side message
            let staffLabel: string | null = null;
            if (!isStudent && selectedContact && normalizeRole(selectedContact.role) === "student" && onRight) {
              if (msg.sender_id === user?.id) {
                staffLabel = "You";
              } else {
                const sender = getUserById(msg.sender_id);
                if (sender) staffLabel = getContactName(sender);
              }
            }

            return (
              <div key={msg.id} className={`flex gap-2.5 group ${onRight ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className="w-8 h-8 shrink-0 mt-1">
                  <AvatarFallback className={`text-xs font-semibold ${onRight ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[72%] flex flex-col ${onRight ? "items-end" : "items-start"}`}>
                  {staffLabel && (
                    <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                      {staffLabel}
                    </span>
                  )}
                  <div className="relative">
                    {isEditing ? (
                      <div className="flex gap-2 items-center min-w-[200px]">
                        <Input
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="text-sm h-9 flex-1"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") handleEditSave(msg.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button size="sm" className="h-9 w-9 p-0" onClick={() => handleEditSave(msg.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setEditingId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm leading-relaxed ${
                          onRight
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border border-border text-foreground rounded-tl-none"
                        }`}>
                          {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                          {renderAttachment(msg)}
                          {msg.edited_at && (
                            <span className="text-[9px] opacity-50 mt-0.5 block">edited</span>
                          )}
                        </div>
                        {/* Edit pencil — only own messages, appears on hover */}
                        {canEdit && (
                          <button
                            onClick={() => { setEditingId(msg.id); setEditText(msg.message); }}
                            className={`absolute top-2 ${onRight ? "-left-6" : "-right-6"}
                              opacity-0 group-hover:opacity-100 transition-opacity
                              text-muted-foreground hover:text-foreground`}
                            title="Edit message"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 px-1">{time}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment preview bar */}
      {attachmentFile && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center gap-3 shrink-0">
          {attachmentPreview ? (
            <img src={attachmentPreview} alt="preview" className="h-14 w-14 object-cover rounded-lg border" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[200px]">{attachmentFile.name}</span>
            </div>
          )}
          <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0" onClick={clearAttachment}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Input bar — always visible for students; for staff only when a contact is selected */}
      {(isStudent || selectedContact) && (
        <div className="p-3 border-t border-border bg-card shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp4,.mov"
          />
          <form
            onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 h-10 w-10 p-0 text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder={
                isStudent
                  ? "Ask your tutors a question..."
                  : selectedContact
                  ? `Reply to ${getContactName(selectedContact)}...`
                  : "Send a message..."
              }
              disabled={sending}
              className="flex-1 text-sm h-10"
            />
            <Button
              type="submit"
              disabled={(!inputMessage.trim() && !attachmentFile) || sending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-10 px-4"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );

  // ─── Student layout: no sidebar, just the chat ───────────────────────────────
  if (isStudent) {
    return (
      <Card className={`shadow-card border border-border flex overflow-hidden ${
        isWidget ? "h-full w-full rounded-none border-0 shadow-none" : "h-[calc(100vh-12rem)] min-h-[500px]"
      }`}>
        {chatPanel}
      </Card>
    );
  }

  // ─── Staff layout: students sidebar + chat ───────────────────────────────────
  return (
    <Card className={`shadow-card border border-border flex overflow-hidden ${
      isWidget ? "h-full w-full rounded-none border-0 shadow-none" : "h-[calc(100vh-12rem)] min-h-[500px]"
    }`}>
      {/* Students sidebar */}
      <div className={`${isWidget ? "w-44 sm:w-52" : "w-72"} border-r border-border flex flex-col bg-muted/20 shrink-0`}>
        <div className="p-3 border-b border-border bg-card">
          <h2 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-primary" />
            Student Conversations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Help students &amp; supervise chats.</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No students yet</div>
          ) : (
            contacts.map(contact => {
              const isSelected = selectedContact?.auth_user_id === contact.auth_user_id;
              const name = getContactName(contact);
              const unread = unreadCounts[contact.auth_user_id] || 0;
              return (
                <button
                  key={contact.auth_user_id}
                  onClick={() => {
                    setSelectedContact(contact);
                    setUnreadCounts(prev => { const n = { ...prev }; delete n[contact.auth_user_id]; return n; });
                  }}
                  className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                    isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="w-9 h-9">
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
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="font-semibold text-sm truncate text-foreground">{name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {chatPanel}
    </Card>
  );
}
