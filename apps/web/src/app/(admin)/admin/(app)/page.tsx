import { ApiStatus } from "@/components/admin/api-status";
import { PageHeading } from "@/components/admin/ui";

export default function HomePage() {
  return (
    <>
      <PageHeading caption="Admin" title="Home" />
      <ApiStatus />
    </>
  );
}
