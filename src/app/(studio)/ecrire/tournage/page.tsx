import type { Metadata } from "next";
import { ChoixSeance } from "@/components/tournage/ChoixSeance";
import { compteSeance } from "@/domaine/tournage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { listerSeances, listerVersionsATourner } from "@/services/tournage";

export const metadata: Metadata = { title: "Tournage" };
export const dynamic = "force-dynamic";

/**
 * TOURNAGE (plan v5 B.6 n° 16, lot G4c) : les versions « je lis » validées à filmer, cochées dans l'ordre voulu,
 * et les séances en cours. `?v=<id>` (bouton « Filmer ici » d'une version) la coche d'avance.
 */
export default async function PageTournage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigerSession();
  const p = await searchParams;
  const pre = ([] as string[]).concat(p.v ?? []);
  const [versions, seances] = await Promise.all([listerVersionsATourner(), listerSeances()]);
  const enCours = seances.filter((s) => s.etat !== "terminee").map((s) => ({ id: s.id, ...compteSeance(s) }));
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/ecrire", libelle: "Écrire" }} titre="Tournage" sousTitre={versions.length ? `${versions.length} à filmer` : undefined} className="mb-4" />
      <ChoixSeance versions={versions} preselection={pre} seances={enCours} />
    </div>
  );
}
