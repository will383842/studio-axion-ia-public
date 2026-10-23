/**
 * 16 VARIANTES des fiches d'exemple (TB-03) : avec les 4 exemples, les 20 fiches de test de la mise en page
 * (critère § 16 point 5). Chacune pousse un cas de disposition et reste valide, règle 4 comprise : la mise en page
 * coupe une ligne trop longue, la règle 4 vérifie chaque mot et la mise en page réelle (voir `REFERENCE_CONTROLE`).
 */
import type { ElementTableau, FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { EXEMPLES, copie, ficheAvantApres, ficheDemonstration, ficheErreurCorrigee, ficheQuestionAbonne } from "../regles/exemples";

const scene = (f: FicheTableau, id: string) => f.scenes.find((s) => s.id === id)!;
function element<T extends ElementTableau["type"]>(f: FicheTableau, id: string, type: T): Extract<ElementTableau, { type: T }> {
  const e = f.scenes.flatMap((s) => s.elements).find((x) => x.id === id);
  if (!e || e.type !== type) throw new Error(`élément ${id} de type ${type} absent`);
  return e as Extract<ElementTableau, { type: T }>;
}

type Variante = { nom: string; fiche: FicheTableau };

function variante(nom: string, base: FicheTableau, changer: (f: FicheTableau) => void): Variante {
  const f = copie(base);
  f.videoId = `${base.videoId}-${nom}`;
  changer(f);
  return { nom, fiche: f };
}

/** Remplace chaque dessin par un soulignement de la première ligne de sa scène (le rythme reste tenu). */
function sansDessin(f: FicheTableau): void {
  for (const s of f.scenes) {
    const cible = s.elements.find((e) => e.type === "ligne" || e.type === "preuve");
    s.elements = s.elements.map((e) => (e.type === "dessin" && cible ? { id: e.id, type: "geste", geste: "souligner", cibleId: cible.id, ancre: e.ancre } : e));
  }
}

const dessins = (f: FicheTableau) => f.scenes.flatMap((s) => s.elements).filter((e): e is Extract<ElementTableau, { type: "dessin" }> => e.type === "dessin");

export const VARIANTES: readonly Variante[] = [
  variante("dessins-au-centre", ficheErreurCorrigee, (f) => dessins(f).forEach((d) => (d.cote = "centre"))),
  variante("dessins-a-gauche", ficheAvantApres, (f) => dessins(f).forEach((d) => (d.cote = "gauche"))),
  variante("dessins-a-droite", ficheDemonstration, (f) => dessins(f).forEach((d) => (d.cote = "droite"))),
  variante("dessins-alternes", ficheQuestionAbonne, (f) => dessins(f).forEach((d, i) => (d.cote = (["centre", "gauche", "droite"] as const)[i % 3]))),
  variante("lignes-longues", ficheDemonstration, (f) => {
    element(f, "e03", "ligne").texte = "Notez la dernière question d'un client";
    element(f, "e05", "ligne").texte = "Demandez trois idées de publication";
    element(f, "e11", "ligne").texte = "Publiez sans chercher pendant une heure";
  }),
  variante("preuve-une-ligne", ficheQuestionAbonne, (f) => {
    element(f, "e10", "preuve").lignes = ["Fermée : réponse claire"];
  }),
  variante("avant-apres-longues", ficheAvantApres, (f) => {
    element(f, "e09", "preuve").lignes = ["Avant : une heure de recopie", "Après : deux minutes de relecture"];
  }),
  variante("avant-apres-une-ligne", ficheAvantApres, (f) => {
    element(f, "e09", "preuve").lignes = ["Après : deux minutes"];
  }),
  variante("titres-partout", ficheErreurCorrigee, (f) => {
    for (const s of f.scenes) for (const e of s.elements) if (e.type === "ligne") e.niveau = "titre";
  }),
  variante("tout-en-texte", ficheAvantApres, (f) => {
    for (const s of f.scenes) for (const e of s.elements) if (e.type === "ligne") e.niveau = "texte";
  }),
  variante("sans-dessin", ficheErreurCorrigee, sansDessin),
  variante("deux-dessins-meme-cote", ficheDemonstration, (f) => {
    scene(f, "s02").elements.push({ id: "e20", type: "dessin", dessinId: "ampoule", cote: "gauche", ancre: 6 });
  }),
  variante("pages-chargees", ficheAvantApres, (f) => {
    // Page 2 : deux lignes de plus dans la scène s04 (6 lignes au plus par page).
    scene(f, "s04").elements.splice(1, 0, { id: "e21", type: "ligne", texte: "Collez vos notes", niveau: "texte", role: "condition", ancre: 2 });
    scene(f, "s03").elements.push({ id: "e22", type: "ligne", texte: "Phrase par phrase", niveau: "texte", role: "alerte", ancre: 6 });
  }),
  variante("chiffre-et-mention", ficheQuestionAbonne, (f) => {
    element(f, "e06", "chiffre").unite = "jours après l'envoi";
  }),
  variante("une-scene-par-page", ficheQuestionAbonne, (f) => f.scenes.forEach((s, i) => (s.page = Math.min(6, i + 1)))),
  variante("tout-sur-deux-pages", ficheErreurCorrigee, (f) => {
    f.scenes.forEach((s, i) => (s.page = i < 3 ? 1 : 2));
    sansDessin(f);
  }),
];

/** Les 20 fiches de test : les 4 exemples, puis les 16 variantes. */
export const VINGT_FICHES: readonly Variante[] = [...Object.entries(EXEMPLES).map(([nom, fiche]) => ({ nom, fiche })), ...VARIANTES];
