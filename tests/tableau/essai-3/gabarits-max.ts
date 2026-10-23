/**
 * GABARITS AU MAXIMUM DES BORNES (fiche témoin « Formation », une scène remplacée par le gabarit plein) : partagé par
 * les tests de l'essai 3 (bornes) et de la relecture du dessin 3 (remplissage). Aucun appel.
 */
import { BORNES_ECRAN, type EcranTableau, type ElementTableau, type FicheTableau, type GabaritEcran, type SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { PAGE_MOTS_MAX } from "../../../src/moteurs/montage-tableau/regles";
import { ficheFormation } from "../style-v2/temoin-formation";

/** Un texte d'exactement `n` caractères, fait de mots français (le dernier coupé au besoin, jamais un mot d'une lettre). */
export function texteDe(n: number, graine: number): string {
  const mots = ["relances", "programmées", "supprimées", "envoyées", "réponse", "devis", "chantier", "client", "messages", "semaine", "rappel", "prêtes"];
  let t = "";
  for (let i = graine; t.length < n; i++) t = t ? `${t} ${mots[i % mots.length]}` : mots[i % mots.length];
  t = t.slice(0, n).trimEnd();
  while (t.length < n) t += "s";
  return t;
}

export const MOMENT: Record<GabaritEcran, EcranTableau["moment"]> = {
  "accroche-cases": "accroche",
  "accroche-compteur": "accroche",
  constat: "douleur",
  "idee-recue": "retournement",
  etape: "etape",
  liste: "etape",
  semaine: "promesse",
  exemple: "exemple",
  recapitulatif: "recapitulatif",
  "appel-commentaire": "appel",
  "appel-diagnostic": "appel",
};

const AVEC_LISTE = new Set<GabaritEcran>(["accroche-cases", "constat", "etape", "liste", "semaine", "exemple", "recapitulatif"]);
const AVEC_DETAIL = new Set<GabaritEcran>(["liste", "semaine", "exemple", "recapitulatif"]);

/** Une scène qui remplit le gabarit au maximum de ses bornes. */
export function sceneMax(g: GabaritEcran, id: string): SceneTableau {
  const items = AVEC_LISTE.has(g)
    ? Array.from({ length: BORNES_ECRAN.itemsMax }, (_, i) => ({ texte: texteDe(BORNES_ECRAN.itemMax, i), ...(AVEC_DETAIL.has(g) ? { detail: texteDe(BORNES_ECRAN.detailMax, i + 3) } : {}), ancre: i }))
    : [];
  const motsItems = items.reduce((n, it) => n + it.texte.split(" ").length + (it.detail?.split(" ").length ?? 0), 0);
  // Les lignes écrites prennent les mots qui restent (40 au plus par écran), deux lignes au moins, six au plus.
  const reste = Math.max(4, PAGE_MOTS_MAX - motsItems);
  const nbLignes = Math.min(6, Math.max(2, Math.ceil(reste / 7)));
  const parLigne = Math.max(2, Math.floor(reste / nbLignes));
  const vocab = ["Vos", "relances", "partent", "seules", "chaque", "semaine", "sans", "rien", "oublier", "devant", "le", "client"];
  const lignes: ElementTableau[] = Array.from({ length: nbLignes }, (_, i) => ({
    id: `${id}-l${i}`,
    type: "ligne" as const,
    texte: Array.from({ length: parLigne }, (_, j) => vocab[(i * 3 + j) % vocab.length]).join(" "),
    niveau: i === 0 ? ("titre" as const) : ("texte" as const),
    role: "regle" as const,
    ancre: i,
  }));
  const appel = g === "appel-commentaire";
  if (appel) lignes[lignes.length - 1] = { ...(lignes[lignes.length - 1] as Extract<ElementTableau, { type: "ligne" }>), texte: "Écrivez RELANCES en commentaire" };
  const elements: ElementTableau[] = [
    ...lignes,
    ...(g === "accroche-compteur" ? [{ id: `${id}-c`, type: "chiffre" as const, valeur: "1000", unite: "euros", sourceId: "s", ancre: 0 }] : []),
    ...(g === "exemple" ? [{ id: `${id}-p`, type: "preuve" as const, preuveId: "p", lignes: [texteDe(40, 1), texteDe(40, 2)], ancre: 1 }, { id: `${id}-m`, type: "mention" as const, texte: "Exemple illustratif" as const }] : []),
  ];
  const ecran: EcranTableau = {
    moment: MOMENT[g],
    gabarit: g,
    etiquette: texteDe(BORNES_ECRAN.etiquetteMax, 5),
    ...(items.length ? { liste: items } : {}),
    ...(MOMENT[g] === "etape" ? { etape: { n: 1, total: 6, nom: texteDe(BORNES_ECRAN.nomEtapeMax, 2) } } : {}),
    ...(appel ? { motCommentaire: "RELANCES" } : {}),
  };
  return { id, role: MOMENT[g] === "appel" ? "fin" : MOMENT[g] === "recapitulatif" ? "resultat" : MOMENT[g] === "etape" ? "etape" : MOMENT[g] === "exemple" ? "exemple" : "douleur", page: 1, texteDit: "Texte dit.", elements, ecrans: [ecran] } as SceneTableau;
}

/** La fiche témoin, une scène remplacée par le gabarit plein (au même rang que son moment dans la vidéo). */
export function ficheAvec(g: GabaritEcran): FicheTableau {
  const f = ficheFormation();
  const scenes = [...f.scenes];
  const rang = MOMENT[g] === "appel" ? scenes.length - 1 : 4;
  scenes[rang] = { ...sceneMax(g, scenes[rang].id), page: scenes[rang].page };
  return { ...f, scenes };
}


/** Une scène qui remplit le gabarit au MINIMUM : une ligne courte, deux éléments courts s'il en prend, aucun dessin. */
export function sceneMin(g: GabaritEcran, id: string): SceneTableau {
  const scene = sceneMax(g, id);
  const ecran = scene.ecrans![0];
  const items = ecran.liste ? ecran.liste.slice(0, 2).map((it, i) => ({ ...it, texte: ["Devis", "Relance"][i], ...(it.detail ? { detail: ["lundi", "vendredi"][i] } : {}) })) : undefined;
  const lignes = scene.elements.filter((e) => e.type === "ligne");
  const garder = new Set([lignes[0]?.id, ...(g === "appel-commentaire" ? [lignes[lignes.length - 1]?.id] : [])]);
  const elements = scene.elements.filter((e) => e.type !== "ligne" || garder.has(e.id)).map((e) => (e.type === "ligne" && e.id === lignes[0]?.id ? { ...e, texte: "Relances prêtes" } : e));
  return { ...scene, elements, ecrans: [{ ...ecran, ...(items ? { liste: items } : {}) }] };
}

/** La fiche témoin, une scène remplacée par le gabarit au minimum. */
export function ficheMin(g: GabaritEcran): FicheTableau {
  const f = ficheFormation();
  const scenes = [...f.scenes];
  const rang = MOMENT[g] === "appel" ? scenes.length - 1 : 4;
  scenes[rang] = { ...sceneMin(g, scenes[rang].id), page: scenes[rang].page };
  return { ...f, scenes };
}
