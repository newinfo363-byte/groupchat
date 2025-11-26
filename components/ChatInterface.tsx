import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Message, Profile, UserRole } from '../types';
import { Send, Image as ImageIcon, Mic, Square, Loader2, LogOut, Shield } from 'lucide-react';

interface Props {
  user: any;
  userProfile: Profile;
  userRole?: UserRole; // Optional role to check if admin
  onBackToAdmin?: () => void;
}

export default function ChatInterface({ user, userProfile, userRole, onBackToAdmin }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as Message;
        // Fetch profile for the sender of the new message
        const { data } = await supabase.from('profiles').select('*').eq('user_id', newMsg.sender_id).single();
        // If no profile found (maybe admin without profile), creating a dummy one for display
        const displayProfile = data || { username: 'Admin', dp_url: null, bio: 'Administrator', id: 'admin', user_id: newMsg.sender_id };
        
        setMessages((prev) => [...prev, { ...newMsg, profiles: displayProfile }]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
    setLoading(false);
  };

  const handleSendMessage = async (type: 'text' | 'image' | 'audio', content: string) => {
    setSending(true);
    try {
      await supabase.from('messages').insert([{
        sender_id: user.id,
        type,
        content
      }]);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `images/${user.id}-${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('chat-media').upload(fileName, file);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data.path);
      await handleSendMessage('image', publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    setSending(true);
    try {
      const fileName = `audio/${user.id}-${Date.now()}.webm`;
      const { data, error } = await supabase.storage.from('chat-media').upload(fileName, blob);
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(data.path);
      await handleSendMessage('audio', publicUrl);
    } catch (error) {
      console.error('Error uploading audio:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-brand-900 text-slate-200">
      {/* Header */}
      <header className="flex-none p-4 border-b border-brand-700 bg-brand-800 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-700 overflow-hidden border border-brand-500 relative">
             {userProfile.dp_url ? (
               <img src={userProfile.dp_url} alt="Me" className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-xs font-bold">{userProfile.username.substring(0, 2).toUpperCase()}</div>
             )}
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-brand-800"></div>
          </div>
          <div>
             <h1 className="font-bold text-white leading-tight">GroupChat</h1>
             <p className="text-xs text-brand-500 font-medium">Logged in as {userProfile.username}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {userRole === 'admin' && onBackToAdmin && (
             <button 
               onClick={onBackToAdmin}
               className="p-2 bg-brand-700 rounded text-slate-300 hover:text-white hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
             >
               <Shield className="w-4 h-4" /> Admin Panel
             </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-900 custom-scrollbar">
        {loading ? (
           <div className="flex justify-center mt-10"><Loader2 className="w-8 h-8 animate-spin text-brand-500"/></div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            const senderName = msg.profiles?.username || 'Unknown';
            const senderPic = msg.profiles?.dp_url;

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[80%] md:max-w-[60%] flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-800 overflow-hidden border border-brand-700 mt-1 shadow-sm">
                    {senderPic ? (
                      <img src={senderPic} alt={senderName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] bg-brand-700">{senderName.substring(0,2).toUpperCase()}</div>
                    )}
                  </div>
                  
                  {/* Bubble */}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 mb-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">{senderName}</span>
                    <div className={`p-3 rounded-2xl shadow-sm ${isMe ? 'bg-brand-500 text-white rounded-tr-none' : 'bg-brand-800 text-slate-200 border border-brand-700 rounded-tl-none'}`}>
                      {msg.type === 'text' && <p className="whitespace-pre-wrap break-words text-sm md:text-base">{msg.content}</p>}
                      {msg.type === 'image' && (
                        <img src={msg.content} alt="shared" className="rounded-lg max-w-full max-h-64 object-cover border border-white/10" />
                      )}
                      {msg.type === 'audio' && (
                        <audio controls className="h-8 max-w-[200px]" src={msg.content} />
                      )}
                    </div>
                    <span className="text-[9px] text-slate-600 mt-1 px-1">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-brand-800 border-t border-brand-700">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          {/* Image Upload */}
          <label className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-900 rounded-full cursor-pointer transition-colors">
            <ImageIcon className="w-6 h-6" />
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={sending} />
          </label>

          {/* Voice Record */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending}
            className={`p-2 rounded-full transition-colors ${isRecording ? 'text-red-500 bg-red-900/20 animate-pulse' : 'text-slate-400 hover:text-brand-500 hover:bg-brand-900'}`}
          >
            {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newMessage.trim() && handleSendMessage('text', newMessage)}
            placeholder={isRecording ? "Recording audio..." : "Message GroupChat..."}
            disabled={sending || isRecording}
            className="flex-1 px-4 py-2.5 bg-brand-900 border border-brand-700 rounded-full text-white focus:outline-none focus:border-brand-500 placeholder-slate-500 disabled:opacity-50 shadow-inner"
          />

          {/* Send Button */}
          <button
            onClick={() => newMessage.trim() && handleSendMessage('text', newMessage)}
            disabled={sending || !newMessage.trim() || isRecording}
            className="p-2.5 bg-brand-500 text-white rounded-full hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:bg-brand-800 disabled:text-slate-500 shadow-lg shadow-brand-500/20"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}