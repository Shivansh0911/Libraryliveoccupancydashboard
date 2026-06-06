import { useState, useCallback } from "react";
import { login as apiLogin } from "../api";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const login = useCallback(async (u: string, p: string): Promise<void> => {
    try {
      const data = await apiLogin(u, p) as { access_token?: string };
      if (data.access_token) {
        setToken(data.access_token);
        setUsername(u);
        return;
      }
      throw new Error("Invalid credentials");
    } catch (err) {
      // Backend unreachable — fall back to mock credentials for demo mode
      if (err instanceof TypeError) {
        if (u === "admin" && p === "bits2024") {
          setToken("demo-token");
          setUsername(u);
          return;
        }
        throw new Error("Invalid credentials");
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
  }, []);

  return { token, username, isAdmin: token !== null, login, logout };
}
