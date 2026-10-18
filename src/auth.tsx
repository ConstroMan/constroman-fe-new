import { useQueryClient } from "@tanstack/react-query";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, request } from "./api/client";
import type { Me } from "./api/types";
import { supabase } from "./supabase";

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  // Supabase knows the user but the API has no row yet: they must register or join.
  | { status: "unregistered"; email: string }
  | { status: "ready"; me: Me };

interface AuthApi {
  session: Session;
  signIn(email: string, password: string): Promise<void>;
  /** "confirm-email" means Supabase sent a link and there is no session until it is clicked. */
  signUp(email: string, password: string): Promise<"signed-in" | "confirm-email">;
  registerCompany(companyName: string, name: string): Promise<void>;
  joinCompany(): Promise<void>;
  logOut(): Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const queryClient = useQueryClient();

  async function loadMe(user: SupabaseSession["user"]) {
    try {
      setSession({ status: "ready", me: await request<Me>("GET", "/me") });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setSession({ status: "unregistered", email: user.email ?? "" });
      } else {
        throw error;
      }
    }
  }

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!next) {
        queryClient.clear();
        setSession({ status: "signed-out" });
        return;
      }
      // Calling Supabase from inside this callback can deadlock, so defer the API call.
      setTimeout(() => loadMe(next.user).catch(() => setSession({ status: "signed-out" })), 0);
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api: AuthApi = {
    session,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      return data.session ? "signed-in" : "confirm-email";
    },
    registerCompany: async (companyName, name) => {
      const me = await request<Me>("POST", "/auth/register", {
        company_name: companyName,
        name: name || null,
      });
      setSession({ status: "ready", me });
    },
    joinCompany: async () => {
      const me = await request<Me>("POST", "/auth/join", {});
      setSession({ status: "ready", me });
    },
    logOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}

export function useMe(): Me {
  const { session } = useAuth();
  if (session.status !== "ready") throw new Error("useMe before sign-in");
  return session.me;
}

export const can = (me: Me, permission: string) => me.permissions.includes(permission);
