import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import VerifyEmailBanner from "@/components/ui/VerifyEmailBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; organizationId?: string } | undefined;

  const [org, user] = await Promise.all([
    sessionUser?.organizationId
      ? prisma.organization.findUnique({
          where: { id: sessionUser.organizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
    sessionUser?.id
      ? prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { email: true, emailVerified: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <SidebarProvider>
      <Sidebar orgName={org?.name} />
      <TopBar orgName={org?.name} />
      <main className="lg:ml-64 pt-16 p-lg bg-background min-h-screen">
        <div className="max-w-[1440px] mx-auto">
          {user && !user.emailVerified && <VerifyEmailBanner email={user.email} />}
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
