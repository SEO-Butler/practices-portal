import { AppShell } from "@/components/shell";
import { requirePage } from "@/lib/page-guard";
import { BookingClient } from "./booking-client";

export const metadata = { title: "Book appointment" };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  await requirePage(["PATIENT"]);
  return (
    <AppShell title="Book an appointment">
      <BookingClient />
    </AppShell>
  );
}
