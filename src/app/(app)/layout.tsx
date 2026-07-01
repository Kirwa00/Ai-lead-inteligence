import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="ml-64 pt-16 p-lg bg-background min-h-screen">
        <div className="max-w-[1440px] mx-auto">{children}</div>
      </main>
    </>
  );
}
