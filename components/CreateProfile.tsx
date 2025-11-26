import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { User, Camera, Save, Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  onProfileCreated: () => void;
}

export default function CreateProfile({ userId, onProfileCreated }: Props) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let dpUrl = '';

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('chat-media')
          .upload(`avatars/${fileName}`, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(data.path);
        
        dpUrl = publicUrl;
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .insert([{ user_id: userId, username, bio, dp_url: dpUrl }]);

      if (dbError) throw dbError;
      onProfileCreated();

    } catch (err) {
      console.error(err);
      alert('Error creating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-brand-900">
      <div className="w-full max-w-md p-8 bg-brand-800 rounded-xl shadow-2xl border border-brand-700">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Complete Your Profile</h2>
        <p className="text-center text-slate-400 text-sm mb-6">You've been approved! Set up your profile to start chatting.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-24 h-24 rounded-full bg-brand-700 border-2 border-brand-500 flex items-center justify-center overflow-hidden">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-slate-400" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-brand-900 border border-brand-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
              placeholder="@username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Bio</label>
            <textarea
              required
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-2 bg-brand-900 border border-brand-700 rounded-lg text-white focus:outline-none focus:border-brand-500 resize-none"
              placeholder="A short intro..."
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Join Chat</>}
          </button>
        </form>
      </div>
    </div>
  );
}