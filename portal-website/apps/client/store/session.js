import { getCookie, setCookie, deleteCookie } from "cookies-next";
import { useRouter } from "next/router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext();

if (process.env.NEXT_PUBLIC_POSTHOG) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG);
}

// AUTO-LOGIN sebagai client guest yang sudah ada di database
// GANTI credential ini dengan akun client yang sudah Anda buat
const GUEST_CLIENT_EMAIL = "guest@seamolec.org"; // Ganti dengan email client Anda
const GUEST_CLIENT_PASSWORD = "guest123"; // Ganti dengan password client Anda

export const SessionProvider = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState({
    id: 'loading',
    name: 'Loading...',
    email: '',
    isAdmin: false,
    role: 'guest',
    external_user: false,
    notifcations: [],
    language: 'en'
  })
  const [loading, setLoading] = useState(true);

  const autoLoginAsGuest = async () => {
    try {
      console.log("Auto-logging in as guest client...");
      
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: GUEST_CLIENT_EMAIL, 
          password: GUEST_CLIENT_PASSWORD 
        }),
      });
      
      const res = await response.json();
      
      if (res.user && res.token) {
        // Set token untuk auto-login
        setCookie("session", res.token);
        
        setUser({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          isAdmin: false, // Guest client BUKAN admin
          role: res.user.role || 'client',
          external_user: res.user.external_user || false,
          notifcations: res.user.notifications || [],
          language: res.user.language || 'en',
        });
        
        console.log("Auto-login successful as guest client:", res.user.name);
      } else {
        console.error("Auto-login failed - guest account not found or invalid");
        // Fallback ke mock user jika auto-login gagal
        setUser({
          id: 'guest-fallback',
          name: 'Guest User',
          email: 'guest@example.com',
          isAdmin: false,
          role: 'guest',
          external_user: false,
          notifcations: [],
          language: 'en'
        });
      }
    } catch (error) {
      console.error("Error auto-login as guest:", error);
      // Fallback ke mock user
      setUser({
        id: 'guest-fallback',
        name: 'Guest User',
        email: 'guest@example.com',
        isAdmin: false,
        role: 'guest',
        external_user: false,
        notifcations: [],
        language: 'en'
      });
    }
    
    setLoading(false);
  };

  const fetchUserProfile = async () => {
    const token = getCookie("session");
    
    if (token) {
      try {
        const response = await fetch("/api/v1/auth/profile", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const res = await response.json();
          
          if (res.user) {
            setUser({
              id: res.user.id,
              name: res.user.name,
              email: res.user.email,
              isAdmin: res.user.isAdmin === true || res.user.role === 'admin',
              role: res.user.role,
              external_user: res.user.external_user || false,
              notifcations: res.user.notifications || [],
              language: res.user.language || 'en',
            });
            console.log("User profile loaded:", res.user.name);
          } else {
            // Token invalid, auto-login sebagai guest
            deleteCookie("session");
            await autoLoginAsGuest();
          }
        } else {
          // Token expired/invalid, auto-login sebagai guest
          deleteCookie("session");
          await autoLoginAsGuest();
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        deleteCookie("session");
        await autoLoginAsGuest();
      }
    } else {
      // Tidak ada token, auto-login sebagai guest
      await autoLoginAsGuest();
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Fungsi logout untuk kembali ke guest client
  const logout = async () => {
    deleteCookie("session");
    await autoLoginAsGuest();
    router.push("/");
  };

  return process.env.NEXT_PUBLIC_ENVIRONMENT === "production" &&
    process.env.NEXT_PUBLIC_TELEMETRY === "1" ? (
    <UserContext.Provider value={{ user, setUser, loading, fetchUserProfile, logout }}>
      <PostHogProvider client={posthog}>{children}</PostHogProvider>
    </UserContext.Provider>
  ) : (
    <UserContext.Provider value={{ user, setUser, loading, fetchUserProfile, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};