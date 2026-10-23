import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { listerElements } from "@/services/bibliotheque";
import { Vitrine } from "./Vitrine";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Composants" };
export const dynamic = "force-dynamic";

/** STYLEGUIDE (B.8 #18) : tous les composants, connecté seulement, EN DÉVELOPPEMENT seulement (E2E-1 n° 24). */
export default async function PageStyleguide() {
  if (process.env.NODE_ENV === "production") notFound();
  await exigerSession();
  const elements = await listerElements({ type: ["illustration-image", "illustration-video", "musique", "lut"] });
  return (
    <div>
      <EnTetePage titre="Composants" sousTitre="Le système de design « Studio »." />
      <Vitrine elements={elements} />
    </div>
  );
}
