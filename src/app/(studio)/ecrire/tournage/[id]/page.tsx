import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Seance } from "@/components/tournage/Seance";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { vueSeance } from "@/services/tournage";

export const metadata: Metadata = { title: "Séance" };
export const dynamic = "force-dynamic";

/** Séance de tournage (lot G4c) : ordre de passage, état de chaque prise, caméra du téléphone. */
export default async function PageSeance({ params }: { params: Promise<{ id: string }> }) {
  await exigerSession();
  const { id } = await params;
  const vue = await vueSeance(id);
  if (!vue) notFound();
  const n = vue.seance.varianteIds.length;
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/ecrire/tournage", libelle: "Tournage" }} titre="Séance" sousTitre={`${n} version${n > 1 ? "s" : ""}`} className="mb-4" />
      <Seance seanceId={vue.seance.id} groupes={vue.groupes} prochaineId={vue.prochaineId} />
    </div>
  );
}
