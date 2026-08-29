import { CaseChooser } from "@/components/CaseChooser";
import { SignalGraphApp } from "@/components/SignalGraphApp";
import { listCaseOptions } from "@/lib/manifest";
import { getSeedPayload } from "@/lib/seed";
import { initializeServer } from "@/lib/init";

export default async function Home({ searchParams }: PageProps<"/">) {
  initializeServer();
  const { case: caseSlug } = await searchParams;
  if (typeof caseSlug !== "string") return <CaseChooser cases={listCaseOptions()} />;
  return <SignalGraphApp seed={getSeedPayload(caseSlug)} />;
}
