import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Send, Loader2, Shield } from 'lucide-react';

interface Props {
  userId: string;
  onSubmitted: () => void;
}

export default function AccessRequestForm({ userId, onSubmitted }: Props) {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('access_requests')
        .insert([{ user_id: userId, name, reason, status: 'pending' }]);

      if (dbError) throw dbError;
      onSubmitted();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-brand-900">
      <div className="w-full max-w-lg p-8 bg-brand-800 rounded-xl shadow-2xl border border-brand-700">
        <h2 className="text-2xl font-bold text-white mb-2">Join GroupChat</h2>
        <p className="text-slate-400 mb-6">This is a private community. Please introduce yourself to the admins to gain access.</p>

        {error && <div className="p-3 mb-4 bg-red-900 text-red-200 rounded text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-brand-900 border border-brand-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Why do you want to join?</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-brand-900 border border-brand-700 rounded-lg text-white focus:outline-none focus:border-brand-500 resize-none"
              placeholder="I'm a developer interested in..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit Application</>}
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-brand-700 flex flex-col gap-3">
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500 hover:text-white transition-colors">
            Sign Out
          </button>
          
          <div className="flex justify-center">
             <button onClick={() => supabase.auth.signOut()} className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1">
               <Shield className="w-3 h-3" /> Login as Admin
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}