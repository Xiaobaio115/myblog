import AdminGate from "./AdminGate";
import { hasAdminSession } from "@/lib/admin-session";


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await hasAdminSession();
  return <AdminGate serverAuthenticated={authenticated}>{authenticated ? children : null}</AdminGate>;
}
