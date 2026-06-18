import { SportsSocketProvider } from "@/context/SportsSocketContext";

export default function SportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SportsSocketProvider>{children}</SportsSocketProvider>;
}
