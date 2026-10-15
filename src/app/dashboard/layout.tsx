import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import AiShoppingAssistant from "@/components/marketplace/AiShoppingAssistant";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-gray-50">
        <Sidebar />
        <div className="farmer-module flex-1 flex flex-col min-w-0">
          <DashboardNavbar />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
        {/* Global AI Shopping Assistant floating panel */}
        <AiShoppingAssistant />
      </div>
    </ProtectedRoute>
  );
}
