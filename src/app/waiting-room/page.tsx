import { AppShell } from "@/components/shell";
import { WaitingRoomBoard } from "./board";

export const metadata = { title: "Waiting room" };

export default function WaitingRoomPage() {
  return (
    <AppShell title="Live waiting room">
      <WaitingRoomBoard />
    </AppShell>
  );
}
