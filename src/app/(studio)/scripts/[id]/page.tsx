import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FicheScript } from "@/components/ecrire/FicheScript";
import { trouverFormat } from "@/formats";
import { obtenirScript, versionsScript } from "@/services/scripts";
import { exigerSession } from "@/services/auth";
import { claudeBranche } from "@/services/generation-claude";

export const metadata: Metadata = { title: "Script" };
export const dynamic = "force-dynamic";

/** FICHE SCRIPT (B.8 #12) : éditeur par blocs, versions comparées, durée en direct, « Créer la vidéo ». */
export default async function PageScript({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;
  const s = await obtenirScript(id);
  if (!s || !trouverFormat(s.formatId)) notFound();
  const versions = (await versionsScript(id)).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  return <FicheScript key={s.id} script={s} versions={versions.length ? versions : [s]} ecritureReelle={await claudeBranche()} />;
}
