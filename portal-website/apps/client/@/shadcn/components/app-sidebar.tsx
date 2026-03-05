import {
  Building,
  FileText,
  ListPlus,
  Settings,
  SquareKanban
} from "lucide-react";
import * as React from "react";

import { NavMain } from "@/shadcn/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/shadcn/ui/sidebar";
import useTranslation from "next-translate/useTranslation";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import CreateTicketModal from "../../../components/CreateTicketModal";
import ThemeSettings from "../../../components/ThemeSettings";
import { useUser } from "../../../store/session";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useRouter();
  const { loading, user, fetchUserProfile } = useUser();
  
  // PERBAIKAN: Gunakan locale dari router atau default "en"
  const locale = location.locale || user?.language || "en";

  const [keypressdown, setKeyPressDown] = useState(false);

  const { t, lang } = useTranslation("peppermint");
  const sidebar = useSidebar();

  const data = {
    teams: [
      {
        name: "Peppermint",
        plan: `version: ${1.0}`,
      },
    ],
    navMain: [
      {
        title: "New Issue",
        url: ``,
        icon: ListPlus,
        isActive: location.pathname === "/" ? true : false,
        initial: "c",
      },
      {
        title: t("sl_dashboard"),
        url: `/`,
        icon: Building,
        isActive: location.pathname === "/" ? true : false,
        initial: "h",
      },
      {
        title: "Documents",
        url: `/documents`,
        icon: FileText,
        isActive: location.pathname === "/documents" ? true : false,
        initial: "d",
        internal: true,
      },
      {
        title: "Issues",
        url: `/issues`,
        icon: SquareKanban,
        isActive: location.pathname === "/issues" ? true : false,
        initial: "t",
        items: [
          {
            title: "Open",
            url: "/issues/open",
            initial: "o",
          },
          {
            title: "Closed",
            url: "/issues/closed",
            initial: "f",
          },
        ],
      },
      {
        title: "Admin",
        url: "/admin",
        icon: Settings,
        isActive: location.pathname.startsWith("/admin"),
        initial: "a",
      },
    ],
  };

  function handleKeyPress(event: any) {
    const pathname = location.pathname;

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    if (
      document.activeElement!.tagName !== "INPUT" &&
      document.activeElement!.tagName !== "TEXTAREA" &&
      !document.activeElement!.className.includes("ProseMirror") &&
      !pathname.includes("/new")
    ) {
      switch (event.key) {
        case "c":
          setKeyPressDown(true);
          break;
        case "h":
          location.push("/");
          break;
        case "d":
          location.push("/documents");
          break;
        case "t":
          location.push("/issues");
          break;
        case "a":
          location.push("/admin");
          break;
        case "o":
          location.push("/issues/open");
          break;
        case "f":
          location.push("/issues/closed");
          break;
        case "[":
          sidebar.toggleSidebar();
          break;
        default:
          break;
      }
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress, location]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
            <img src="/favicon/logo-seamolec.png" className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-xl">TICKETING</span>
            <span className="truncate text-xs">
              version: {1.0}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <CreateTicketModal
          keypress={keypressdown}
          setKeyPressDown={setKeyPressDown}
        />
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="hidden sm:block">
          <ThemeSettings />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}