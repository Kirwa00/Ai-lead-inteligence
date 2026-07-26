import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
    : null;

  return (
    <SidebarProvider>
      <Sidebar orgName={org?.name} />
      <TopBar orgName={org?.name} />
      <main className="lg:ml-64 pt-16 p-lg bg-background min-h-screen">
        <div className="max-w-[1440px] mx-auto">{children}</div>
      </main>
    </SidebarProvider>
  );
}
