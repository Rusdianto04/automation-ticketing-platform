// app/admin/layout.tsx
import { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: {
    default: "Admin Panel — Support & Incident Portal",
    template: "%s | Admin Panel",
  },
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
