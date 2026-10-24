import { LIMITES } from "../../briques/visuels/limites";
import { PAGES, TYPES_PAGE, type TypePage } from "../../briques/visuels/registre-pages";
import { Page } from "../../domaine/visuels/schema";
import { accorder, LIBELLES_CHAMPS, LIBELLES_LISTES } from "./libelles-champs";

/**
 * Aide au format d'un texte écrit en session : un modèle JSON copiable et, pour chaque type de page, ses limites.
 * Les limites sont MESURÉES sur le schéma (`Page.safeParse`) : jamais recopiées à la main. Seuls les exemples (textes courts et neutres,
 * sans chiffre) sont écrits ici ; un test prouve qu'ils passent le schéma et que les limites rejoignent le registre.
 */

type Chemin = (string | number)[];

/** Une page minimale valide par type du registre ; chaque champ texte, même facultatif, y figure pour être mesuré. */
export const EXEMPLES_PAGES: Record<TypePage, Record<string, unknown>> = {
  T01: { type: "T01", titre: "Le titre de votre couverture", sousTitre: "Une phrase pour donner envie de lire" },
  T01B: { type: "T01B", titre: "Le titre de votre couverture", sousTitre: "Une phrase pour donner envie de lire" },
  T01C: { type: "T01C", titre: "Le titre de votre couverture", sousTitre: "Une phrase pour donner envie de lire" },
  T02: { type: "T02", titre: "Les bases", cartes: [{ titre: "Planifier", corps: "Poser ses priorités." }, { titre: "Déléguer", corps: "Confier ce qui peut l’être." }] },
  T06: { type: "T06", titre: "Votre routine", points: [{ texte: "Un café avant de commencer" }, { texte: "Une liste courte et claire" }, { texte: "Une pause à midi" }] },
  T08: { type: "T08", titre: "Avant et après", avant: "Des journées qui débordent", apres: "Des journées plus calmes" },
  T10: { type: "T10", message: "Le calme se prépare", legende: "Une phrase à retenir" },
  T20: { type: "T20", titre: "Le parcours", etapes: [{ titre: "Noter", corps: "Écrire ce qui compte." }, { titre: "Trier", corps: "Garder l’essentiel." }, { titre: "Agir", corps: "Avancer pas à pas." }] },
  T21: { type: "T21" },
  T22: { type: "T22", titre: "Idée reçue", mythe: "Il faut tout changer d’un coup.", realite: "Un petit pas suffit pour commencer." },
  T23: { type: "T23", titre: "Pour y voir clair", questions: [{ question: "Que voulez-vous alléger ?", aide: "Pensez à une tâche répétée." }, { question: "Qui peut vous aider ?", aide: "Un collègue de confiance." }], annotation: "Notez vos réponses" },
  T24: { type: "T24", titre: "Sans et avec", lignes: [{ sans: "Des notes éparses", avec: "Un carnet unique" }, { sans: "Des oublis", avec: "Un rappel clair" }, { sans: "Du stress", avec: "Du calme" }] },
  T26: { type: "T26", titre: "Un cas simple", avant: ["Des dossiers dispersés", "Des oublis fréquents"], avec: ["Un classement clair", "Des rappels utiles"], outils: ["Agenda"], vous: "Vous gardez la main" },
  T27: { type: "T27", titre: "Votre liste", lignes: [{ texte: "Vos tâches sont notées" }, { texte: "Vos priorités sont claires" }, { texte: "Vos pauses sont prévues" }, { texte: "Votre semaine est lisible" }] },
  T28: { type: "T28", titre: "Le trajet", noeuds: [{ texte: "Une demande" }, { texte: "Un tri" }, { texte: "Une réponse" }] },
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const valide = (page: unknown) => Page.safeParse(page).success;

function lire(o: unknown, chemin: Chemin): unknown {
  return chemin.reduce<unknown>((x, k) => (x as Record<string | number, unknown>)[k], o);
}
function poser(o: unknown, chemin: Chemin, valeur: unknown): void {
  const parent = lire(o, chemin.slice(0, -1)) as Record<string | number, unknown>;
  parent[chemin[chemin.length - 1]!] = valeur;
}

/** Plus grand nombre de signes accepté à ce chemin (0 : la valeur n'est pas un texte libre, p. ex. une énumération). */
function maxSignes(page: unknown, chemin: Chemin): number {
  const essai = (n: number) => {
    const copie = clone(page);
    poser(copie, chemin, "a".repeat(n));
    return valide(copie);
  };
  if (!essai(1)) return 0;
  let bas = 1;
  let haut = 400;
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2);
    if (essai(milieu)) bas = milieu;
    else haut = milieu - 1;
  }
  return bas;
}

/** Nombres d'éléments acceptés pour une liste (en répétant le premier élément). */
function nombresAcceptes(page: Record<string, unknown>, cle: string): number[] {
  const liste = page[cle] as unknown[];
  const res: number[] = [];
  for (let n = 0; n <= 8; n++) {
    const copie = clone(page);
    copie[cle] = n === 0 ? [] : Array.from({ length: n }, () => clone(liste[0]));
    if (valide(copie)) res.push(n);
  }
  return res;
}

const facultatif = (page: Record<string, unknown>, cle: string) => {
  const copie = clone(page);
  delete copie[cle];
  return valide(copie);
};

/** « 48 signes (2 cartes), 44 (3), … » : les valeurs identiques qui se suivent sont regroupées. */
function parNombre(valeurs: { n: number; max: number }[], nom: [string, string]): string {
  const groupes: { de: number; a: number; max: number }[] = [];
  for (const v of valeurs) {
    const dernier = groupes.at(-1);
    if (dernier && dernier.max === v.max) dernier.a = v.n;
    else groupes.push({ de: v.n, a: v.n, max: v.max });
  }
  return groupes.map((g) => `${g.max} signes (${g.de === g.a ? `${g.de} ${accorder(g.de, nom)}` : `${g.de} à ${g.a} ${nom[1]}`})`).join(", ");
}

function lignesDeLaPage(id: TypePage): string[] {
  const page = EXEMPLES_PAGES[id];
  const lignes: string[] = [];
  for (const [cle, valeur] of Object.entries(page)) {
    if (cle === "type") continue;
    const nom = LIBELLES_CHAMPS[cle] ?? cle;
    if (!Array.isArray(valeur)) {
      const max = maxSignes(page, [cle]);
      if (max > 0) lignes.push(`${nom} : ${max} signes au plus${facultatif(page, cle) ? " (facultatif)" : ""}`);
      continue;
    }
    const noms = LIBELLES_LISTES[cle] ?? [cle, cle];
    const nombres = nombresAcceptes(page, cle);
    const min = Math.min(...nombres.filter((n) => n > 0));
    const max = Math.max(...nombres);
    lignes.push(`${noms[1]} : ${min} à ${max}${nombres.includes(0) ? " (facultatif)" : ""}`);
    const premier = valeur[0];
    const sousChamps = typeof premier === "string" ? [[] as string[]] : Object.keys(premier as object).map((k) => [k]);
    for (const sous of sousChamps) {
      const chemin: Chemin = [cle, 0, ...sous];
      const mesures = nombres.filter((n) => n > 0).map((n) => {
        const copie = clone(page);
        copie[cle] = Array.from({ length: n }, () => clone(valeur[0]));
        return { n, max: maxSignes(copie, chemin) };
      });
      if (mesures.every((m) => m.max === 0)) continue;
      const champ = sous[0] ?? "texte";
      lignes.push(`${LIBELLES_CHAMPS[champ] ?? champ} de chaque ${noms[0]} : ${parNombre(mesures, noms)}`);
    }
  }
  if (lignes.length === 0) lignes.push("aucun texte à écrire : la page est posée par le code");
  return lignes;
}

export interface TypePageAide {
  id: TypePage;
  nom: string;
  role: string;
  lignes: string[];
}
export interface AideFormat {
  modele: string;
  plafondTitre: number;
  pagesMin: number;
  pagesMax: number;
  types: TypePageAide[];
}

let cache: AideFormat | undefined;

/** Modèle + limites par type de page, générés depuis le registre et le schéma (calculés une fois). */
export function aideFormat(): AideFormat {
  cache ??= {
    modele: MODELE_PAQUET,
    plafondTitre: LIMITES.titreMax,
    pagesMin: LIMITES.pagesMin,
    pagesMax: LIMITES.pagesMax,
    types: TYPES_PAGE.map((id) => ({ id, nom: PAGES[id].nom, role: PAGES[id].role, lignes: lignesDeLaPage(id) })),
  };
  return cache;
}

/** Modèle de paquet valide : mêmes pages que les exemples, aucun chiffre, passe la porte en vert. À copier, puis à adapter. */
export const MODELE_PAQUET: string = JSON.stringify(
  {
    version: "paquet-session-carrousel/1",
    sujet: "Mieux organiser sa semaine",
    titre: "Mieux organiser sa semaine",
    pourquoi: [
      "La couverture pose le sujet.",
      "Les cartes donnent les bases.",
      "La liste décrit une routine.",
      "Avant et après montrent le changement.",
      "Les étapes donnent le chemin.",
      "Le message clé se retient.",
      "La dernière page invite à écrire.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel d’exemple sur l’organisation de la semaine",
      pages: [
        { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" },
        EXEMPLES_PAGES.T02,
        EXEMPLES_PAGES.T06,
        EXEMPLES_PAGES.T08,
        EXEMPLES_PAGES.T20,
        { type: "T10", message: "Le calme se prépare" },
        EXEMPLES_PAGES.T21,
      ],
    },
  },
  null,
  2,
);
