import AdminGate from "@/app/admin/AdminGate";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminGate>{children}</AdminGate>;
}
