"use client";

import React, { useState } from 'react';

// The page handles loading, empty, and unauthorized states as requested
type ViewState = 'loading' | 'unauthorized' | 'no-instance' | 'joined-member' | 'admin-dashboard';

export default function InstancePage() {
  const [viewState, setViewState] = useState<ViewState>('no-instance');
  const [authMode, setAuthMode] = useState<'join' | 'create'>('join');

  // Local Form States
  const [inviteToken, setInviteToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [instanceName, setInstanceName] = useState('');

  // Admin Mock Data State for Pending Requests and Active Users
  const [pendingRequests, setPendingRequests] = useState([
    { id: '1', name: 'developer_alpha', email: 'alpha@team.com' },
    { id: '2', name: 'coder_beta', email: 'beta@team.com' },
  ]);
  const [activeUsers, setActiveUsers] = useState([
    { id: 'admin', name: 'Admin (You)', role: 'Owner' },
  ]);

  const handleApprove = (id: string, name: string) => {
    setPendingRequests(prev => prev.filter(req => req.id !== id));
    setActiveUsers(prev => [...prev, { id, name, role: 'Member' }]);
  };

  const handleReject = (id: string) => {
    setPendingRequests(prev => prev.filter(req => req.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen transition-colors duration-200 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      
      {/* HEADER SECTION */}
      <header className="border-b pb-4 mb-6 border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight">Shared Instance Management</h1>
        <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
          Configure opt-in decentralized team collaboration environments.
        </p>
      </header>

      {/* MANDATORY LOCAL-FIRST PRIVACY WARNING */}
      <div className="mb-6 p-4 rounded-lg border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          ⚠️ Local-First & Privacy Notice
        </h4>
        <p className="text-xs mt-1 leading-relaxed opacity-90">
          Sharing is completely opt-in. Single-user standalone installations are never forced through 
          instance routing and remain completely private locally. If setting up a shared instance, 
          the administrator is responsible for exposing the instance server safely.
        </p>
      </div>

      {/* STATE 1: LOADING STATE VIEW */}
      {viewState === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-sm text-zinc-500">Checking instance status...</span>
        </div>
      )}

      {/* STATE 2: UNAUTHORIZED STATE VIEW */}
      {viewState === 'unauthorized' && (
        <div className="p-6 border rounded-xl border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          <h3 className="font-bold">Access Denied</h3>
          <p className="text-sm mt-1">You do not have administrative permissions to configure this instance.</p>
          <button onClick={() => setViewState('no-instance')} className="mt-4 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">Back</button>
        </div>
      )}

      {/* STATE 3: EMPTY STATE / JOIN OR CREATE FLOW */}
      {viewState === 'no-instance' && (
        <div>
          {/* Sub-tab Selection */}
          <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button 
              onClick={() => setAuthMode('join')}
              className={`pb-2 font-medium text-sm transition-all ${authMode === 'join' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}
            >
              Join Existing Instance
            </button>
            <button 
              onClick={() => setAuthMode('create')}
              className={`pb-2 font-medium text-sm transition-all ${authMode === 'create' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}
            >
              Create Admin Setup Flow
            </button>
          </div>

          {/* Form Routing Panels */}
          {authMode === 'join' ? (
            <div className="space-y-4 max-w-md p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div>
                <h3 className="text-lg font-medium">Join an Instance</h3>
                <p className="text-xs text-zinc-500">Enter your invitation details below.</p>
              </div>
              <input 
                type="text" 
                placeholder="Invite Token or Link" 
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700" 
              />
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-1/2 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700" 
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-1/2 p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700" 
                />
              </div>
              <button 
                onClick={() => setViewState('joined-member')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm w-full transition-colors"
              >
                Submit Join Request
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-md p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div>
                <h3 className="text-lg font-medium">Initialize Shared Instance</h3>
                <p className="text-xs text-zinc-500">Setup explicit admin authentication parameters.</p>
              </div>
              <input 
                type="text" 
                placeholder="Instance Name (e.g., Core Engineering)" 
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700" 
              />
              <button 
                onClick={() => setViewState('admin-dashboard')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-sm w-full transition-colors"
              >
                Confirm Setup Flow
              </button>
            </div>
          )}
        </div>
      )}

      {/* STATE 4: JOINED MEMBER VIEW */}
      {viewState === 'joined-member' && (
        <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 text-center max-w-md mx-auto">
          <div className="text-4xl mb-2">⏳</div>
          <h3 className="text-xl font-bold">Request Pending</h3>
          <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
            Your request to join has been submitted successfully using your token. Please wait for the instance admin to approve your account.
          </p>
          <button onClick={() => setViewState('no-instance')} className="mt-4 text-xs text-blue-500 underline">Cancel Request</button>
        </div>
      )}

      {/* STATE 5: ADMIN MANAGEMENT DASHBOARD */}
      {viewState === 'admin-dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* PENDING REQUESTS PANEL */}
          <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/10">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span>Pending Join Requests</span>
              <span className="px-2 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 rounded-full">{pendingRequests.length}</span>
            </h3>
            
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center">No pending requests found.</p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.id} className="p-3 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{req.name}</p>
                      <p className="text-xs text-zinc-400">{req.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(req.id, req.name)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(req.id)}
                        className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 text-xs font-medium rounded transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIVE TEAM MEMBERS PANEL */}
          <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/10">
            <h3 className="text-lg font-semibold mb-4">Active User Directory</h3>
            <div className="space-y-3">
              {activeUsers.map(user => (
                <div key={user.id} className="p-3 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'Owner' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300' : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setViewState('no-instance')} className="mt-6 w-full text-xs text-zinc-400 hover:underline">
              ← Leave Admin Dashboard View
            </button>
          </div>

        </div>
      )}

    </div>
  );
}