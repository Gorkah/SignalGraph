import { SignalGraphApp } from "@/components/SignalGraphApp";
import { getSeedPayload } from "@/lib/seed";
import { initializeServer } from "@/lib/init";

export default function Home() {
  // Validate environment on server startup
  initializeServer();
  
  const seed = getSeedPayload();
  return <SignalGraphApp seed={seed} />;
}
