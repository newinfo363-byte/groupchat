import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AccessRequest, Profile, UserRole } from './types';
import Auth from './components/Auth';
import AccessRequestForm from './components/AccessRequestForm';
import AdminDashboard from './components/AdminDashboard';
import CreateProfile from './components/CreateProfile';
import ChatInterface from './components/ChatInterface';
import { Loader2, Lock, Clock, Ban } from 'lucide-react';

type AppState = 'loading' | 'auth' | 'request' | 'pending' | 'rejected' | 'profile' | 'chat' | 'admin';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<AppState>('loading');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) determineView(session.user.id);
      else setView('auth');
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) determineView(session.user.id);
      else {
        setView('auth');
        setUserProfile(null);
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const determineView = async (userId: string) => {
    // Only set loading if we aren't already in a valid authenticated state to avoid flicker
    if (view === 'auth') setView('loading');

    try {
      // A. Check if Admin
      const { data: roleData } = await supabase
        .from('roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        setUserRole('admin');
        // If they are an admin, we still need their profile data if they want to chat
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (profileData) setUserProfile(profileData as Profile);
        else {
           // Create a temp profile object for admins without a real profile
           setUserProfile({
             id: 'admin-temp',
             user_id: userId,
             username: 'Admin',
             bio: 'System Administrator',
             dp_url: ''
           });
        }
        
        // Default to admin dashboard, but don't force it if they are already chatting
        setView((prev) => prev === 'chat' ? 'chat' : 'admin');
        return;
      }

      setUserRole('member');

      // B. Check Access Request Status
      const { data: requestData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!requestData) {
        setView('request');
        return;
      }

      const request = requestData as AccessRequest;

      if (request.status === 'pending') {
        setView('pending');
        return;
      }

      if (request.status === 'rejected') {
        setView('rejected');
        return;
      }

      if (request.status === 'approved') {
        // C. Check Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileData) {
          setUserProfile(profileData as Profile);
          setView('chat');
        } else {
          setView('profile');
        }
      }
    } catch (error) {
      console.error("State determination error:", error);
      setView('auth'); // Fallback
    }
  };

  // --------------------------------------------------------------------------
  // Render Logic
  // --------------------------------------------------------------------------

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-900 text-brand-500">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (view === 'auth') {
    return <Auth />;
  }

  if (view === 'request') {
    return <AccessRequestForm userId={session.user.id} onSubmitted={() => determineView(session.user.id)} />;
  }

  if (view === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-900 text-slate-200 p-4 text-center">
        <div className="bg-brand-800 p-8 rounded-xl border border-brand-700 max-w-md shadow-2xl">
          <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Application Pending</h2>
          <p className="text-slate-400 mb-6">Your request to join GroupChat is currently under review by the administration. Check back later.</p>
          <button onClick={() => supabase.auth.signOut()} className="px-6 py-2 bg-brand-700 rounded hover:bg-brand-600 transition">Sign Out</button>
        </div>
      </div>
    );
  }

  if (view === 'rejected') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-900 text-slate-200 p-4 text-center">
        <div className="bg-brand-800 p-8 rounded-xl border border-red-900/50 max-w-md shadow-2xl">
          <Ban className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-red-400">Access Denied</h2>
          <p className="text-slate-400 mb-6">Your application was reviewed and unfortunately, you have not been granted access at this time.</p>
          <button onClick={() => supabase.auth.signOut()} className="px-6 py-2 bg-brand-700 rounded hover:bg-brand-600 transition">Sign Out</button>
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return <AdminDashboard onEnterChat={() => setView('chat')} />;
  }

  if (view === 'profile') {
    return <CreateProfile userId={session.user.id} onProfileCreated={() => determineView(session.user.id)} />;
  }

  if (view === 'chat' && userProfile) {
    return (
      <ChatInterface 
        user={session.user} 
        userProfile={userProfile} 
        userRole={userRole || 'member'} 
        onBackToAdmin={userRole === 'admin' ? () => setView('admin') : undefined}
      />
    );
  }

  return <div>Unknown State</div>;
}