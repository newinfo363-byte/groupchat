import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, MessageCircle, Shield, Lock, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

// Hidden credentials for the preset password flow
const ADMIN_SYSTEM_EMAIL = 'admin@groupchat.local';
const ADMIN_PRESET_CODE = '96208088';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    try {
      if (isAdminMode) {
        // --- ADMIN FLOW: PRESET CODE ---
        // We use the password field as the "Code" input
        if (password !== ADMIN_PRESET_CODE) {
          throw new Error("Invalid Access Code");
        }

        // 1. Try to login with the hidden system account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: ADMIN_SYSTEM_EMAIL,
          password: ADMIN_PRESET_CODE,
        });

        if (signInError) {
          // 2. If login fails (account doesn't exist yet), create it automatically
          if (signInError.message.includes('Invalid login')) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: ADMIN_SYSTEM_EMAIL,
              password: ADMIN_PRESET_CODE,
            });

            if (signUpError) throw signUpError;

            // 3. Assign Admin Role to this new user
            if (signUpData.user) {
              const { error: roleError } = await supabase
                .from('roles')
                .upsert({ user_id: signUpData.user.id, role: 'admin' }, { onConflict: 'user_id' });
              
              if (roleError) {
                // If RLS blocks this, we might need manual SQL, but we try anyway due to "Bootstrap Admin" policy
                console.error("Auto-assign role failed:", roleError);
                setMessage("System Admin created. If dashboard doesn't load, run SQL setup.");
              } else {
                // Success - reload to refresh session/roles
                window.location.reload(); 
              }
            }
          } else {
            throw signInError;
          }
        }
        // If sign in success, the App.tsx will detect the role and redirect
        
      } else {
        // --- USER FLOW: STANDARD ---
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) throw error;
          setIsError(false);
          setMessage('Sign up successful! Please check your email to verify (or log in if confirmation is disabled).');
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
        }
      }
    } catch (error: any) {
      setIsError(true);
      let msg = error.message || 'An error occurred';
      
      if (msg.includes('Signups not allowed')) {
        msg = 'Signups are disabled. Enable "Allow new users to sign up" in Supabase Auth settings.';
      }
      
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminMode = () => {
    setIsAdminMode(!isAdminMode);
    setIsSignUp(false);
    setMessage('');
    setEmail('');
    setPassword('');
    setIsError(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-900 text-slate-200">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-brand-800 border-b border-brand-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-brand-500" />
          <span className="font-bold text-lg tracking-tight">GroupChat</span>
        </div>
        <button
          onClick={toggleAdminMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isAdminMode 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50'
          }`}
        >
          {isAdminMode ? (
            <>Back to User Login</>
          ) : (
            <><Shield className="w-4 h-4" /> Admin Portal</>
          )}
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className={`w-full max-w-md p-8 rounded-xl shadow-2xl border transition-colors duration-500 ${
          isAdminMode ? 'bg-slate-900 border-red-900/30' : 'bg-brand-800 border-brand-700'
        }`}>
          
          <div className="flex justify-center mb-6">
            <div className={`p-4 rounded-full ${isAdminMode ? 'bg-red-900/20' : 'bg-brand-700'}`}>
              {isAdminMode ? (
                <Lock className="w-8 h-8 text-red-500" />
              ) : (
                <MessageCircle className="w-8 h-8 text-brand-500" />
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-white mb-2">
            {isAdminMode ? 'Admin Access' : 'Welcome Back'}
          </h1>
          <p className="text-center text-slate-400 mb-8">
            {isAdminMode 
              ? 'Enter the preset security code.' 
              : 'Secure, Admin-Approved Community'}
          </p>

          {message && (
            <div className={`p-4 mb-6 text-sm rounded-lg flex gap-3 items-start ${
              !isError ? 'bg-green-900/50 text-green-200 border border-green-900' : 'bg-red-900/50 text-red-200 border border-red-900'
            }`}>
              {isError ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* Standard User Inputs */}
            {!isAdminMode && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-brand-900 border border-brand-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  placeholder="you@example.com"
                />
              </div>
            )}

            {/* Shared Password Input / Admin Code Input */}
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {isAdminMode ? 'Access Code' : 'Password'}
              </label>
              <div className="relative">
                {isAdminMode && <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />}
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full ${isAdminMode ? 'pl-9' : 'px-4'} py-2 bg-brand-900 border rounded-lg text-white focus:outline-none transition-colors ${
                    isAdminMode 
                      ? 'border-red-900/50 focus:border-red-500' 
                      : 'border-brand-700 focus:border-brand-500'
                  }`}
                  placeholder={isAdminMode ? "Enter preset code" : "••••••••"}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 text-white font-semibold rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 ${
                isAdminMode 
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20' 
                  : 'bg-brand-500 hover:bg-brand-400 shadow-lg shadow-brand-500/20'
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isAdminMode ? 'Unlock Dashboard' : (isSignUp ? 'Sign Up' : 'Sign In')} 
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>

          {!isAdminMode && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-slate-400 hover:text-white underline"
              >
                {isSignUp ? 'Already a member? Sign in' : 'New here? Create an account'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}