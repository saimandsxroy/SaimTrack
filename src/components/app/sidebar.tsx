"use client";

import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/features/auth/auth-context";
import { navItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const name = user?.displayName || user?.email || "SaimTrack User";
  const initial = name.charAt(0).toUpperCase();

  async function handleSignOut() {
    try {
      await signOutUser();
      toast.success("Signed out.");
      router.replace("/auth/sign-in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  async function handleChangePassword() {
    if (!user || !user.email) {
      toast.error("No user email found.");
      return;
    }
    if (!auth) {
      toast.error("Auth is not initialized.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset email.");
    }
  }

  return (
    <motion.aside
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "hidden min-h-screen shrink-0 border-r border-border bg-background transition-all duration-300 lg:block relative z-20",
        collapsed ? "w-[56px]" : "w-[220px]"
      )}
    >
      <div className="sticky top-0 flex h-screen flex-col py-5">
        
        {/* Brand & Collapse */}
        <div className={cn("mb-6 flex items-center justify-between", collapsed ? "px-2 justify-center" : "px-4")}>
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button
              aria-label="Collapse sidebar"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {collapsed && (
          <div className="flex justify-center mb-6">
            <button
              aria-label="Expand sidebar"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className={cn("mb-8", collapsed ? "px-2" : "px-3")}>
          <div className={cn("flex h-[32px] items-center gap-2 rounded-md border border-border bg-surface text-text-tertiary transition-colors hover:border-border-hover cursor-text", collapsed ? "justify-center px-0" : "px-2.5")}>
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="text-[13px] flex-1 font-medium">Search</span>}
            {!collapsed && <span className="text-[10px] font-mono text-text-tertiary bg-white/[0.03] px-1.5 rounded border border-border">⌘K</span>}
          </div>
        </div>

        {/* Nav List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2">
          {!collapsed && <div className="px-2 mb-2 text-[11px] font-medium tracking-[0.06em] text-text-tertiary uppercase">Menu</div>}
          <NavList collapsed={collapsed} />
        </div>

        {/* Bottom Section */}
        <div className={cn("mt-auto pt-4 border-t border-border mx-2 pb-2", collapsed ? "px-0" : "px-2")}>
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="h-7 w-7 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0">
               <span className="text-[11px] font-bold text-text-primary">{mounted ? initial : ""}</span>
            </div>
            {!collapsed && (
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="text-[13px] font-medium text-text-primary truncate">{mounted ? name : ""}</span>
              </div>
            )}
          </div>
          
          {/* Actions */}
          {!collapsed && (
            <div className="flex items-center gap-4 mt-3 ml-[40px]">
              <button 
                onClick={handleChangePassword} 
                className="text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
                title="Change Password"
              >
                <KeyRound className="h-3 w-3" /> Password
              </button>
              <button 
                onClick={handleSignOut} 
                className="text-[11px] font-medium text-text-secondary hover:text-destructive transition-colors flex items-center gap-1.5"
                title="Log Out"
              >
                <LogOut className="h-3 w-3" /> Logout
              </button>
            </div>
          )}

          {collapsed && (
            <div className="flex flex-col items-center gap-3 mt-4">
              <button onClick={handleChangePassword} className="text-text-tertiary hover:text-text-primary" title="Change Password"><KeyRound className="h-4 w-4" /></button>
              <button onClick={handleSignOut} className="text-text-tertiary hover:text-destructive" title="Log Out"><LogOut className="h-4 w-4" /></button>
            </div>
          )}
        </div>

      </div>
    </motion.aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const name = user?.displayName || user?.email || "SaimTrack User";
  const initial = name.charAt(0).toUpperCase();

  async function handleSignOut() {
    try {
      await signOutUser();
      setOpen(false);
      toast.success("Signed out.");
      router.replace("/auth/sign-in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  async function handleChangePassword() {
    if (!user || !user.email) {
      toast.error("No user email found.");
      return;
    }
    if (!auth) {
      toast.error("Auth is not initialized.");
      return;
    }
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset email.");
    }
  }

  return (
    <>
      <button
        aria-label="Open navigation"
        className="text-text-secondary hover:text-text-primary"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              animate={{ x: 0 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-background p-5 shadow-2xl lg:hidden flex flex-col"
              exit={{ x: "-100%" }}
              initial={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            >
              <div className="mb-8 flex items-center justify-between">
                <Brand />
                <button
                  aria-label="Close navigation"
                  className="text-text-secondary hover:text-text-primary"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList onNavigate={() => setOpen(false)} />
              </div>

              {/* User Section */}
              <div className="mt-auto pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0">
                    <span className="text-[12px] font-bold text-text-primary">{mounted ? initial : ""}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-text-primary truncate">{mounted ? name : ""}</span>
                    {user?.email && (
                      <span className="text-[11px] text-text-tertiary truncate">{user.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 ml-[44px]">
                  <button
                    onClick={handleChangePassword}
                    className="text-[12px] font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
                    title="Change Password"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Password
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="text-[12px] font-medium text-text-secondary hover:text-destructive transition-colors flex items-center gap-1.5"
                    title="Log Out"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Logout
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}


function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-transparent transition-transform group-hover:scale-105">
        <img src="/logo.png" alt="SaimTrack Logo" className="w-full h-full object-contain" />
      </div>
      {!collapsed && (
        <span className="text-[14px] font-semibold text-text-primary tracking-tight">SaimTrack</span>
      )}
    </Link>
  );
}

function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.title : undefined}
            className={cn(
              "group relative flex h-[36px] items-center gap-3 rounded-[6px] px-3 text-[14px] font-normal transition-all duration-150",
              active 
                ? "bg-[rgba(255,255,255,0.07)] text-text-primary" 
                : "text-text-secondary hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary",
              collapsed && "justify-center px-0 w-[40px] mx-auto"
            )}
            onClick={onNavigate}
          >
            {active && (
              <motion.div 
                layoutId="active-nav-indicator"
                className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-r-full bg-accent"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            
            <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary")} />
            
            {!collapsed && (
              <div className="flex flex-1 items-center justify-between">
                <span>{item.title}</span>
                {!item.enabled && (
                  <span className="text-[10px] font-medium text-text-tertiary">
                    {item.phase}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
