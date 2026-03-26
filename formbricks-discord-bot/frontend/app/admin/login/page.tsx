// app/admin/login/page.tsx
import { Metadata } from "next";
import AdminLoginClient from "./AdminLoginClient";

export const metadata: Metadata = {
  title: "Login — Admin Portal",
};

export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
