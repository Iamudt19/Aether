'use client';

import React, { useEffect, useState } from 'react';
import { supabase, signInWithGoogle, signOut } from '../lib/supabaseClient';
import { LogIn, LogOut, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserAuthButton() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />;
  }

  const user = session?.user;

  return (
    <div className="relative flex items-center">
      <AnimatePresence mode="wait">
        {user ? (
          <div className="relative">
            <motion.button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || 'User'}
                  className="w-7 h-7 rounded-full border border-emerald-500/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300 hidden md:block">
                {user.user_metadata?.full_name?.split(' ')[0] || 'Account'}
              </span>
            </motion.button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40 cursor-default" onClick={() => setDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-950/95 border border-white/10 p-2 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1"
                >
                  <div className="px-3 py-2 border-b border-white/5 flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200 truncate">
                      {user.user_metadata?.full_name || 'Aether Member'}
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate">
                      {user.email}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors text-xs font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </motion.div>
              </>
            )}
          </div>
        ) : (
          <motion.button
            onClick={signInWithGoogle}
            className="glass-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogIn className="w-3.5 h-3.5" /> Sign in with Google
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
