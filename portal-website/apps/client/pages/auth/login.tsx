import { toast } from "@/shadcn/hooks/use-toast";
import { setCookie } from "cookies-next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useUser } from "../../store/session";

function Login() {
  const router = useRouter();
  const { setUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [url, setUrl] = useState("");

  async function postData() {
    try {
      setStatus("loading");
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const res = await response.json();
      
      if (res.user) {
        setCookie("session", res.token);

        const updatedUser = {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          isAdmin: res.user.isAdmin === true || res.user.role === "admin",
          role: res.user.role,
          external_user: res.user.external_user || false,
          notifcations: res.user.notifications || [],
          language: res.user.language || "en",
        };

        console.log("Login successful, user data:", updatedUser);
        setUser(updatedUser);

        toast({
          variant: "default",
          title: "Success",
          description: "Logged in successfully!",
        });

        if (res.user.external_user) {
          router.push("/portal");
        } else if (res.user.firstLogin) {
          router.push("/onboarding");
        } else {
          router.push("/");
        }
      } else {
        setStatus("idle");
        toast({
          variant: "destructive",
          title: "Error",
          description: res.message || "Invalid email or password",
        });
      }
    } catch (error) {
      console.error(error);
      setStatus("idle");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to login. Please try again.",
      });
    }
  }

  async function oidcLogin() {
    try {
      const response = await fetch("/api/v1/auth/check", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const res = await response.json();
      if (res.success && res.url) {
        setUrl(res.url);
      }
    } catch (error) {
      console.error("OIDC check failed:", error);
    }
  }

  useEffect(() => {
    oidcLogin();
  }, []);

  useEffect(() => {
    if (router.query && router.query.error) {
      toast({
        variant: "destructive",
        title: "Account Error",
        description: "SSO account not found. Please contact your admin.",
      });
    }
  }, [router.query]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Welcome to Seamolec Ticketing
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {status === "loading" ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-sm text-muted-foreground">Signing in...</p>
          </div>
        ) : (
          <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        postData();
                      }
                    }}
                    className="appearance-none block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        postData();
                      }
                    }}
                    className="appearance-none block w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <Link href="/auth/forgot-password" className="font-medium text-green-600 hover:text-green-500">
                    Forgot your password?
                  </Link>
                </div>
              </div>

              <div className="flex flex-col space-y-4">
                <button
                  type="button"
                  onClick={postData}
                  disabled={status === "loading"}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "Signing in..." : "Sign In"}
                </button>

                {url && (
                  <button
                    type="button"
                    onClick={() => router.push(url)}
                    className="w-full flex justify-center py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Sign in with OIDC
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center flex flex-col space-y-2">
          <span className="text-sm text-muted-foreground">
            Sign in with admin credentials for full access
          </span>
          <a
            href="https://docs.peppermint.sh/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-600 hover:text-green-500"
          >
            Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;