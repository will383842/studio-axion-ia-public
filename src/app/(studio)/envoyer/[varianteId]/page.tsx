import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnvoiIphone } from "@/components/facecam/EnvoiIphone";
import { vueEnvoiFacecam } from "@/services/envoi-facecam";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Envoyer ma vidéo" };
export const dynamic = "force-dynamic";

/** « Envoyer ma vidéo de : <titre> » (plan facecam v4, § C.3 ; lot D) : depuis l'iPhone, 2 touchers. */
export default async function PageEnvoyer({ params }: { params: Promise<{ varianteId: string }> }) {
  await exigerSession();
  const vue = await vueEnvoiFacecam((await params).varianteId);
  if (!vue) notFound();
  return <EnvoiIphone vue={vue} />;
}
