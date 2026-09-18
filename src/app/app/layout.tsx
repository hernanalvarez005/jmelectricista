import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireCurrentOrg } from "@/lib/data/current-org";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { organization, userEmail } = await requireCurrentOrg();

  return (
    <SidebarProvider>
      <AppSidebar orgName={organization.name} />
      <SidebarInset>
        <AppHeader title={organization.name} userLabel={userEmail ?? ""} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
