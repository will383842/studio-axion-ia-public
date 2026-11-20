// Réglage du socle (§ 3.4). Seul `true` ou `{ capacites: […] }` allume.
// Ce fichier ne décide pas si une capacité listée est permise : C1-U8 la croise
// avec le profil du code (connue du profil, état ni `coulisse` ni `absent`,
// aucun verrou). Absent = rien n'est ajouté à la commande.
import type { IdCapacite } from "./types";

export type ReglageBibliotheque = { actif: false } | { actif: true; capacites: IdCapacite[] };

const FORME_CAPACITE = /^[a-z-]+\.[a-z0-9.-]+$/;

export function cleReglageBibliotheque(formatId: string): string {
  return `bibliothequeVideo.${formatId}`;
}

export function interpreterReglageBibliotheque(valeur: unknown): ReglageBibliotheque {
  try {
    if (valeur === true) return { actif: true, capacites: [] };
    if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return { actif: false };
    const cles = Object.keys(valeur);
    if (cles.length !== 1 || cles[0] !== "capacites") return { actif: false };
    const liste = (valeur as { capacites: unknown }).capacites;
    if (!Array.isArray(liste)) return { actif: false };
    const vues = new Set<string>();
    const capacites: IdCapacite[] = [];
    for (const e of liste) {
      if (typeof e === "string" && FORME_CAPACITE.test(e) && !vues.has(e)) {
        vues.add(e);
        capacites.push(e as IdCapacite);
      }
    }
    return { actif: true, capacites };
  } catch {
    return { actif: false };
  }
}

// ALLUMER-BIBLIO-DEFAUTS-v20g · Williams 20/11 : fini + gratuit allumé par défaut. Valeur utilisée quand la base est vide ;
// une valeur écrite en base (même `false`) l'emporte. Tableau : sans effet tant que son profil garde ces objets non permis.
const PAR_DEFAUT: Readonly<Record<string, unknown>> = Object.freeze({
  avocat: { capacites: ["texte.nom-outil-autonome", "texte.sortie-animee", "texte.style-varie"] },
  "tableau-anime": { capacites: ["objet.chiffre", "objet.etape", "objet.marque"] },
});

export async function lireReglageBibliotheque(
  formatId: string,
  lire: (cle: string) => Promise<unknown>,
): Promise<ReglageBibliotheque> {
  try {
    const v = await lire(cleReglageBibliotheque(formatId));
    return interpreterReglageBibliotheque(v === undefined || v === null ? PAR_DEFAUT[formatId] : v);
  } catch {
    return { actif: false };
  }
}
