import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { pourcentage } from "@/domaine/tableau-bilan-decoupage";
import { exigerSession } from "@/services/auth";
import { lireChiffreRefusDecoupage } from "@/services/tableau-bilan-decoupage";

export const metadata: Metadata = { title: "Refus du découpage" };
export const dynamic = "force-dynamic";

const JOURS = 30;

/** Règles refusées, en mots simples (clé de `bilan-refus.ts`). Une clé inconnue s'affiche telle quelle. */
const NOMS_REGLE: Record<string, string> = {
  "références internes": "Une référence interne ne mène nulle part",
  "texte dit mot pour mot": "Le texte dit n'est pas celui du script, mot pour mot",
  "accroche courte dès la première image": "L'accroche est trop longue",
  "page lisible : 40 mots et 6 lignes au plus": "Une page est trop chargée",
  "taille du texte": "Le texte est trop petit",
  "une forme en plus de la couleur": "Une couleur seule porte le sens",
  "chiffres sourcés": "Un chiffre n'a pas de source",
  "exemple illustratif signalé": "Un exemple n'est pas signalé",
  "preuve validée à l'écran": "Une preuve n'est pas validée",
  "douleur en tête": "La douleur ne vient pas en tête",
  "dessins de la banque, droits valides": "Un dessin n'est pas de la banque",
  "aucune phrase d'appel": "Une phrase d'appel est de trop",
  "contrôles du script sur les textes écrits et dits": "Un contrôle du script échoue",
  "durée de 180 secondes au plus": "La vidéo est trop longue",
  "série sans numéro": "Un numéro d'épisode est de trop",
  "du rythme : un événement visuel toutes les 4 secondes": "Il manque du mouvement à l'écran",
  "geste fort sur la douleur dès le début": "Le geste fort manque sur la douleur",
  "champ-fixe": "Un champ à recopier a été changé",
  "dessin-non-fourni": "Un dessin n'est pas dans la liste",
  "preuve-non-fournie": "Une preuve n'est pas dans la liste",
  illisible: "La réponse est illisible",
  autre: "Autre cause",
};

/** Sous-clés des pages (règles 4 et 18). */
const NOMS_SOUS_CLE: Record<string, string> = {
  "bloc-hors-partie": "un bloc est sur la mauvaise page",
  "liste-un-element": "une liste n'a qu'un élément",
  "code-orphelin": "un code est seul",
  "blocs-max": "trop de blocs",
  chiffre: "un chiffre que la voix ne dit pas",
  "texte-pas-dit": "un texte qui n'est pas dit",
  "phrases-cles": "plusieurs phrases clés",
  titres: "les titres",
  "idee-recue": "l'idée reçue",
  "bloc-orange": "les blocs orange",
  visuel: "le dessin de la page",
  "numero-etape": "le numéro d'étape",
  "ordre-parties": "l'ordre des parties",
  appel: "la page d'appel",
  "page-ne-tient-pas": "la page ne tient pas",
  autre: "autre",
};

/** Nom simple d'une règle (`regle` ou `regle/sous-cle`). */
function nomRegle(cle: string): string {
  const i = cle.lastIndexOf("/");
  if (i < 0) return NOMS_REGLE[cle] ?? cle;
  const regle = cle.slice(0, i);
  const sous = cle.slice(i + 1);
  const base = /^gabarit de page clair/i.test(regle) ? "Une page n'est pas dans le gabarit" : (NOMS_REGLE[regle] ?? regle);
  return `${base} : ${NOMS_SOUS_CLE[sous] ?? sous}`;
}

/** Page « Refus du découpage » : sur 30 jours, combien de découpages et, règle par règle, ce qui a été refusé. Que des nombres. */
export default async function PageRefusDecoupage() {
  await exigerSession();
  const c = await lireChiffreRefusDecoupage({ joursMax: JOURS });
  return (
    <div className="mx-auto w-full max-w-3xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Refus du découpage" sousTitre="Ce que les règles refusent quand le script est découpé en scènes." />
      {c.decoupages === 0 ? (
        <p className="rounded-2xl border border-trait p-4 text-sm">Aucun découpage sur {JOURS} jours.</p>
      ) : (
        <>
          <section className="mb-4 rounded-2xl border border-trait p-4">
            <p className="text-lg font-semibold">
              {JOURS} jours : {c.decoupages} découpage{c.decoupages > 1 ? "s" : ""} · {pourcentage(c.premierCoup, c.decoupages)} % acceptés du premier coup · {c.parReparation} réparé{c.parReparation > 1 ? "s" : ""} sans IA · {c.apresRelance} accepté{c.apresRelance > 1 ? "s" : ""} après relance · {c.refuses} refusé{c.refuses > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-sm text-texte-doux">Les vidéos d&apos;exemple ne comptent pas.</p>
          </section>
          <section className="rounded-2xl border border-trait p-4">
            <h2 className="mb-2 text-base font-semibold">Par règle, de la plus fréquente à la moins fréquente</h2>
            {c.parRegle.length === 0 ? (
              <p className="text-sm text-texte-doux">Aucun refus à signaler.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-texte-doux">
                    <th className="py-1 font-medium">Règle</th>
                    <th className="py-1 text-right font-medium">Refus vus</th>
                    <th className="py-1 text-right font-medium">Réparés sans IA</th>
                    <th className="py-1 text-right font-medium">Levés par une relance</th>
                    <th className="py-1 text-right font-medium">Restés à corriger</th>
                  </tr>
                </thead>
                <tbody>
                  {c.parRegle.map((l) => (
                    <tr key={l.cle} className="border-t border-trait">
                      <td className="py-1">{nomRegle(l.cle)}</td>
                      <td className="py-1 text-right">{l.refus}</td>
                      <td className="py-1 text-right">{l.reparesSansIA}</td>
                      <td className="py-1 text-right">{l.levesParRelance}</td>
                      <td className="py-1 text-right">{l.restes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
