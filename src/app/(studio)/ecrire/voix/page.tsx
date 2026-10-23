import type { Metadata } from "next";
import { MaVoix } from "@/components/voix/MaVoix";
import { EnTetePage } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { lireContexte, lireInterdits, proposerExpressions } from "@/services/contexte-axion";
import { listerMatieres } from "@/services/matieres";
import { fileAValider, lireFicheStyle, listerReglesDatees, listerTextesWill, listerTournures } from "@/services/voix";

export const metadata: Metadata = { title: "Ma voix" };
export const dynamic = "force-dynamic";

const RUBRIQUES = ["facon", "textes", "carnet", "positions", "themes", "interdits", "tournures", "regles", "prononciation"];

/**
 * MA VOIX (générateur, lot G2) : le contenu de l'onglet « Ma voix » d'Écrire, aussi joignable seul.
 * ?rubrique=<id> ouvre une rubrique (redirections de G1b : `?onglet=facon` → `facon`, `?onglet=references` → `textes`).
 */
export default async function PageMaVoix({ searchParams }: { searchParams: Promise<{ rubrique?: string }> }) {
  await exigerSession();
  const { rubrique } = await searchParams;
  // Le contexte d'abord : sur une base sans la migration du générateur, il la joue (idempotente) avant les lectures.
  const contexte = await lireContexte();
  const [fiche, textes, expressions, vues, interdits, tournures, regles, file] = await Promise.all([
    lireFicheStyle(),
    listerTextesWill(),
    proposerExpressions(),
    listerMatieres({ type: "avis-will", avecRetirees: false }),
    lireInterdits(),
    listerTournures(),
    listerReglesDatees(),
    fileAValider(),
  ]);
  const avis = vues.filter((v) => v.etat.disponible).map((v) => v.matiere);
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/ecrire", libelle: "Écrire" }} titre="Ma voix" className="mb-4" />
      <MaVoix d={{ fiche, textes, expressions, avis, contexte, interdits, tournures, regles, file }} ouverteInitiale={RUBRIQUES.includes(rubrique ?? "") ? rubrique : undefined} />
    </div>
  );
}
