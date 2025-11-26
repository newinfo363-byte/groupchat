import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { AccessRequest, Profile } from '../types';
import { Check, X, Loader2, LogOut, Shield, RefreshCw, MessageCircle, UserX, UserCheck, Users, Search } from 'lucide-react';

interface Props {
  onEnterChat: () => void;
}

// Extended type for the User Management view
interface UserView extends AccessRequest {
  profile?: Profile;
}

export default function AdminDashboard({ onEnterChat }: Props) {
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  
  // Data State
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter
  const [searchTerm, setSearchTerm] = useState('');

  const refreshData = () => {
    if (activeTab === 'requests') fetchRequests();
    else fetchAllUsers();
  };

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  // 1. Fetch Pending Requests
  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setRequests(data as AccessRequest[]);
    }
    setLoading(false);
  };

  // 2. Fetch All Users (Approved/Rejected) with Profiles
  const fetchAllUsers = async () => {
    setLoading(true);
    
    // Get requests that are NOT pending
    const { data: requestData, error: reqError } = await supabase
      .from('access_requests')
      .select('*')
      .neq('status', 'pending')
      .order('created_at', { ascending: false });

    if (reqError || !requestData) {
      setLoading(false);
      return;
    }

    // Get profiles for these users
    const userIds = requestData.map(r => r.user_id);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds);

    // Merge data
    const merged: UserView[] = requestData.map(req => ({
      ...req,
      profile: profileData?.find(p => p.user_id === req.user_id)
    }));

    setAllUsers(merged);
    setLoading(false);
  };

  // 3. Handle Approval/Rejection
  const handleDecision = async (id: string, userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({ status })
        .eq('id', id);

      if (updateError) throw updateError;

      // Manage Role
      if (status === 'approved') {
        await supabase
          .from('roles')
          .upsert([{ user_id: userId, role: 'member' }], { onConflict: 'user_id' });
      } else {
        // If rejected, remove role (revoke access)
        await supabase
          .from('roles')
          .delete()
          .eq('user_id', userId);
      }

      // Refresh local state
      if (activeTab === 'requests') {
        setRequests(prev => prev.filter(r => r.id !== id));
      } else {
        await fetchAllUsers(); // Refresh full list to show status change
      }

    } catch (err) {
      console.error("Error processing decision:", err);
      alert("Failed to update user status");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.profile?.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-brand-900 text-slate-200 flex flex-col">
      {/* Top Header */}
      <header className="bg-brand-800 border-b border-brand-700 p-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-700 rounded-lg border border-brand-600">
               <Shield className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Control</h1>
              <p className="text-xs text-slate-400">System Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
               onClick={onEnterChat}
               className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-400 transition-colors shadow-lg shadow-brand-500/20 text-sm font-medium"
            >
               <MessageCircle className="w-4 h-4" /> Enter Chat
            </button>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-slate-400 hover:text-white hover:bg-brand-700 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-700 mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-all relative ${
              activeTab === 'requests' ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Pending Requests
            {requests.length > 0 && (
              <span className="ml-2 bg-brand-500 text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>
            )}
            {activeTab === 'requests' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500"></div>}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-all relative ${
              activeTab === 'users' ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management
            {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-500"></div>}
          </button>
        </div>

        {/* Content Views */}
        <div className="bg-brand-800 rounded-xl border border-brand-700 shadow-xl overflow-hidden min-h-[400px]">
          
          {/* HEADER ROW with Refresh */}
          <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-800/50">
             <h2 className="font-semibold text-lg text-white">
               {activeTab === 'requests' ? 'Applications for Review' : 'All Registered Users'}
             </h2>
             <div className="flex gap-2">
                {activeTab === 'users' && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-brand-900 border border-brand-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 w-48 md:w-64"
                    />
                  </div>
                )}
                <button 
                  onClick={refreshData}
                  className="p-2 bg-brand-700 rounded-lg hover:bg-brand-600 transition-colors text-slate-300"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
             </div>
          </div>

          {/* VIEW: PENDING REQUESTS */}
          {activeTab === 'requests' && (
            <div className="p-4">
              {loading && requests.length === 0 ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-500"/></div>
              ) : requests.length === 0 ? (
                <div className="text-center p-16 text-slate-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>All caught up! No pending requests.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {requests.map((req) => (
                    <div key={req.id} className="bg-brand-900 p-5 rounded-lg border border-brand-700 flex flex-col md:flex-row gap-4 hover:border-brand-600 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white">{req.name}</h3>
                          <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded border border-yellow-900/50 uppercase tracking-wider font-bold">Pending</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 font-mono">ID: {req.user_id}</p>
                        <div className="bg-brand-800 p-3 rounded border border-brand-700/50">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Reason</span>
                          <p className="text-slate-300 text-sm">"{req.reason}"</p>
                        </div>
                      </div>
                      <div className="flex md:flex-col justify-center gap-2 min-w-[140px]">
                        <button
                          onClick={() => handleDecision(req.id, req.user_id, 'approved')}
                          disabled={actionLoading === req.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-600/90 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-green-900/20"
                        >
                           {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Check className="w-4 h-4" /> Approve</>}
                        </button>
                        <button
                          onClick={() => handleDecision(req.id, req.user_id, 'rejected')}
                          disabled={actionLoading === req.id}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-brand-800 hover:bg-red-900/50 text-slate-400 hover:text-red-200 border border-brand-700 rounded-lg transition-colors text-sm font-medium"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: USER MANAGEMENT */}
          {activeTab === 'users' && (
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-brand-900 text-slate-400 text-xs uppercase tracking-wider border-b border-brand-700">
                    <tr>
                      <th className="p-4 font-medium">User Profile</th>
                      <th className="p-4 font-medium">Application Name</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-700">
                    {loading ? (
                      <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500"/></td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-500">No users found.</td></tr>
                    ) : (
                      filteredUsers.map(user => (
                        <tr key={user.id} className="hover:bg-brand-700/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-brand-700 overflow-hidden flex items-center justify-center border border-brand-600">
                                {user.profile?.dp_url ? (
                                  <img src={user.profile.dp_url} alt="" className="w-full h-full object-cover"/>
                                ) : (
                                  <span className="text-xs font-bold text-slate-400">
                                    {(user.profile?.username || user.name).substring(0,2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-slate-200">{user.profile?.username || <span className="text-slate-500 italic">No Profile</span>}</div>
                                <div className="text-xs text-slate-500">{user.user_id.substring(0,8)}...</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-slate-300 text-sm">{user.name}</td>
                          <td className="p-4">
                            {user.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Suspended
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {user.status === 'approved' ? (
                              <button 
                                onClick={() => handleDecision(user.id, user.user_id, 'rejected')}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-medium transition-colors"
                              >
                                {actionLoading === user.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <UserX className="w-3 h-3" />}
                                Suspend
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleDecision(user.id, user.user_id, 'approved')}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-700 hover:bg-brand-600 text-slate-300 border border-brand-600 rounded-lg text-xs font-medium transition-colors"
                              >
                                {actionLoading === user.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <UserCheck className="w-3 h-3" />}
                                Reactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
