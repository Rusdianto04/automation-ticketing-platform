//@ts-nocheck
import "@radix-ui/themes/styles.css";
import "../styles/globals.css";

import { ThemeProvider } from "next-themes";

import {
  DocumentCheckIcon,
  FolderIcon,
  HomeIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";

import { MantineProvider } from "@mantine/core";
import { Theme } from "@radix-ui/themes";
import { useRouter } from "next/router";
import { QueryClient, QueryClientProvider } from "react-query";

import { SessionProvider, useUser } from "../store/session";

import React from "react";

import AdminLayout from "../layouts/adminLayout";
import NewLayout from "../layouts/newLayout";
import NoteBookLayout from "../layouts/notebook";
import PortalLayout from "../layouts/portalLayout";
import Settings from "../layouts/settings";
import ShadLayout from "../layouts/shad";
import GlobalShortcut from "@/shadcn/block/GlobalShortcut";
import { Toaster } from "@/shadcn/ui/toaster";

import { SidebarProvider } from "@/shadcn/ui/sidebar";

const queryClient = new QueryClient();

// BYPASS AUTH - Langsung render children
function Auth({ children }: any) {
  return children;
}

function MyApp({ Component, pageProps: { session, ...pageProps } }: any) {
  const router = useRouter();

  // PENTING: Tambahkan pengecekan router ready
  if (!router.isReady) {
    return <div>Loading...</div>;
  }

  // Auth routes - BUNGKUS DENGAN SessionProvider
  if (router.pathname.startsWith("/auth")) {
    return (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Component {...pageProps} />
          <Toaster />
        </ThemeProvider>
      </SessionProvider>
    );
  }

  // Admin routes
  if (router.pathname.startsWith("/admin")) {
    return (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Theme>
            <QueryClientProvider client={queryClient}>
              <AdminLayout>
                <Component {...pageProps} />
                <Toaster />
              </AdminLayout>
            </QueryClientProvider>
          </Theme>
        </ThemeProvider>
      </SessionProvider>
    );
  }

  // Settings routes
  if (router.pathname.startsWith("/settings")) {
    return (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Theme>
            <QueryClientProvider client={queryClient}>
              <ShadLayout>
                <Settings>
                  <Component {...pageProps} />
                  <Toaster />
                </Settings>
              </ShadLayout>
            </QueryClientProvider>
          </Theme>
        </ThemeProvider>
      </SessionProvider>
    );
  }

  // Portal routes
  if (router.pathname.startsWith("/portal")) {
    return (
      <SessionProvider>
        <Theme>
          <QueryClientProvider client={queryClient}>
            <PortalLayout>
              <Component {...pageProps} />
              <Toaster />
            </PortalLayout>
          </QueryClientProvider>
        </Theme>
      </SessionProvider>
    );
  }

  // Onboarding
  if (router.pathname === "/onboarding") {
    return (
      <SessionProvider>
        <Component {...pageProps} />
        <Toaster />
      </SessionProvider>
    );
  }

  // Submit page
  if (router.pathname === "/submit") {
    return (
      <SessionProvider>
        <Component {...pageProps} />
        <Toaster />
      </SessionProvider>
    );
  }

  // Default layout untuk semua route lainnya
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light">
        <Theme>
          <QueryClientProvider client={queryClient}>
            <ShadLayout>
              <Component {...pageProps} />
              <Toaster />
            </ShadLayout>
          </QueryClientProvider>
        </Theme>
      </ThemeProvider>
    </SessionProvider>
  );
}

export default MyApp;