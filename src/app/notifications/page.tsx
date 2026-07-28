import { requireUser } from "@/server/auth/current-user";
import { SiteHeader } from "@/components/layout/site-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold">الإشعارات</h1>
        <NotificationList />
      </main>
    </div>
  );
}
