import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { compterEchecs, type FamilleEchec, type LigneEchec } from "@/domaine/journal-echecs";
import { dateCourte, heure } from "@/lib/dates";
import { nomCourtFormat } from "@/formats";
import { exigerSession } from "@/services/auth";
import { lireEchecs } from "@/services/journal-echecs";

export const metadata: Metadata = { title: "Échecs" };
export const dynamic = "force-dynamic";

const NOMS_FAMILLE: Record<FamilleEchec, string> = {
  "attente-validation": "À valider",
  fournisseur: "Un outil externe",
  "entree-a-corriger": "Une entrée à corriger",
  controle: "Un contrôle",
  reglage: "Un réglage manquant",
  panne: "Une panne",
  autre: "Autre cause",
};

function nomFamille(f: string): string {
  return NOMS_FAMILLE[f as FamilleEchec] ?? f;
}

function nomGenerateur(id: string): string {
  try {
    return nomCourtFormat({ id });
  } catch {
    return id;
  }
}

/** Tableau « nom, nombre » trié du plus fréquent au plus rare. */
function Tableau({ titre, colonne, lignes }: { titre: string; colonne: string; lignes: Record<string, number> }) {
  const rangs = Object.entries(lignes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return (
    <section className="rounded-2xl border border-trait p-4">
      <h2 className="mb-2 text-base font-semibold">{titre}</h2>
      {rangs.length === 0 ? (
        <p className="text-sm text-texte-doux">Rien à signaler.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-texte-doux">
              <th className="py-1 font-medium">{colonne}</th>
              <th className="py-1 text-right font-medium">Nombre</th>
            </tr>
          </thead>
          <tbody>
            {rangs.map(([nom, n]) => (
              <tr key={nom} className="border-t border-trait">
                <td className="py-1">{nom}</td>
                <td className="py-1 text-right">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Une phrase simple : « 30 jours : 4 échecs, dont 3 pour un contrôle, 1 pour un outil ». */
function resume(jours: number, total: number, parFamille: Record<string, number>, attentes: number): string {
  if (total === 0) return `Aucun échec sur ${jours} jours`;
  const dont: string[] = [];
  if (parFamille.controle) dont.push(`${parFamille.controle} pour un contrôle`);
  if (parFamille.fournisseur) dont.push(`${parFamille.fournisseur} pour un outil`);
  const autres = total - (parFamille.controle ?? 0) - (parFamille.fournisseur ?? 0);
  if (autres > 0) dont.push(`${autres} pour une autre cause`);
  const fin = attentes > 0 ? ` (et ${attentes} en attente de votre validation, non comptées)` : "";
  return `${jours} jours : ${total} échec${total > 1 ? "s" : ""}, dont ${dont.join(", ")}${fin}`;
}

function LigneRecente({ l }: { l: LigneEchec }) {
  return (
    <li className="rounded-xl border border-trait p-3 text-sm">
      <p className="text-texte-doux">
        {dateCourte(l.date)} à {heure(l.date)} · {nomGenerateur(l.generateur)} · étape « {l.etape} » ·{" "}
        <Link href={`/videos/${l.videoId}`} className="underline">
          Voir la vidéo
        </Link>
      </p>
      <p className="mt-1 font-semibold">{l.phrase}</p>
      {l.detail ? (
        <details className="mt-1 text-texte-doux">
          <summary className="cursor-pointer">Détail technique</summary>
          <p className="mt-1 break-words">
            {l.code} · {l.detail}
          </p>
        </details>
      ) : null}
    </li>
  );
}

/** Page « Échecs » : combien de vidéos ont échoué, pourquoi, sur quel générateur et à quelle étape (7 et 30 jours). */
export default async function PageEchecs() {
  await exigerSession();
  const lignes = await lireEchecs({ joursMax: 30 });
  const bilan = compterEchecs(lignes, new Date());
  const c30 = bilan.jours30;
  const recents = lignes.filter((l) => l.famille !== "attente-validation").slice(0, 20);
  const nomsGenerateur = Object.fromEntries(Object.entries(c30.parGenerateur).map(([id, n]) => [nomGenerateur(id), n]));
  const nomsFamille = Object.fromEntries(Object.entries(c30.parFamille).map(([f, n]) => [nomFamille(f), n]));
  return (
    <div className="mx-auto w-full max-w-3xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Échecs" sousTitre="Les vidéos qui n'ont pas abouti, et pourquoi." />
      <section className="mb-4 rounded-2xl border border-trait p-4">
        <p className="text-lg font-semibold">{resume(30, c30.total, c30.parFamille, c30.attentes)}</p>
        <p className="mt-1 text-sm text-texte-doux">{resume(7, bilan.jours7.total, bilan.jours7.parFamille, bilan.jours7.attentes)}</p>
      </section>
      {c30.total === 0 && recents.length === 0 ? (
        <p className="rounded-2xl border border-trait p-4 text-sm">Aucun échec sur 30 jours. Tout s&apos;est bien passé.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Tableau titre="Pourquoi (famille)" colonne="Famille" lignes={nomsFamille} />
            <Tableau titre="Sur quel générateur" colonne="Générateur" lignes={nomsGenerateur} />
            <Tableau titre="À quelle étape" colonne="Étape" lignes={c30.parEtape} />
            <Tableau titre="Quel motif précis" colonne="Motif" lignes={c30.parCode} />
          </div>
          <section>
            <h2 className="mb-2 text-base font-semibold">Les 20 derniers échecs</h2>
            <ul className="flex flex-col gap-2">
              {recents.map((l) => (
                <LigneRecente key={`${l.travailId}-${l.essai}`} l={l} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
