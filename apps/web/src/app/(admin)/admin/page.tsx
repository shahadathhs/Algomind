import { readApiStatus } from "@/lib/api";

// Always dynamic: it reports live API status.
export const dynamic = "force-dynamic";

// Placeholder. Sign-in and the dashboard screens are specified in docs/README_DASHBOARD_PLAN.md.
export default async function AdminPage() {
  const status = await readApiStatus();
  const label = !status.reachable ? "UNREACHABLE" : status.database ? "READY" : "UP, DATABASE DOWN";
  return (
    <>
      <div className="mb-2 text-xs tracking-[2px] text-mute">ADMIN</div>
      <h1 className="text-[38px] leading-tight tracking-[1px]">DASHBOARD</h1>
      <p className="mt-4 text-lg font-semibold text-mute">Sign-in and level tools come next.</p>
      <p className="mt-8 text-sm tracking-[2px]">API STATUS: {label}</p>
    </>
  );
}
