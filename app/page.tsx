import { SignalGraphApp } from "@/components/SignalGraphApp";
import { getSeedPayload } from "@/lib/seed";

export default function Home() {
  const seed = getSeedPayload();
  return <SignalGraphApp seed={seed} />;
}
