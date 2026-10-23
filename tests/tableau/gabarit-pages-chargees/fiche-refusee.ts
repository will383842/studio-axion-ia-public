/**
 * La fiche REFUSÉE le 14/10/2026 (vidéo v-b19aefb21d57, style « reference/2 ») : le témoin réel du gabarit (même série,
 * même texte dit) avec les lignes telles que Claude les avait écrites, avant la retouche à la main. Partagé par le test
 * (`pages-chargees.test.ts`) et la planche (`planche.mts`).
 */
import type { ElementLigne, FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { temoinGabarit } from "../gabarit-finitions/temoin";

/** Les lignes EXACTES du découpage refusé (page 6 : étape « Automatisez » ; page 7 : l'exemple du plombier). */
export const DETAIL_PAGE_6 = "Mettez sa réponse dans le message d'accueil automatique : il part au premier message.";
export const AVANT_PAGE_7 = "Il retape ses délais six fois par jour, sur le chantier.";
export const APRES_PAGE_7 = "Son message d'accueil annonce ses délais et ses horaires.";

/**
 * La fiche refusée : le témoin réel du gabarit (même vidéo, même texte dit) avec les lignes telles que Claude les avait
 * écrites, avant la retouche à la main.
 */
export function ficheRefusee(cas: { page6?: boolean; page7?: boolean }): FicheTableau {
  const f = structuredClone(temoinGabarit().fiche);
  const s06 = f.scenes.find((s) => s.id === "s06")!;
  const s08 = f.scenes.find((s) => s.id === "s08")!;
  if (cas.page6) {
    s06.elements = s06.elements.filter((e) => e.id !== "e27");
    (s06.elements.find((e) => e.id === "e26") as ElementLigne).texte = DETAIL_PAGE_6;
  }
  if (cas.page7) {
    (s08.elements.find((e) => e.id === "e32") as ElementLigne).texte = AVANT_PAGE_7;
    (s08.elements.find((e) => e.id === "e33") as ElementLigne).texte = APRES_PAGE_7;
  }
  return f;
}

/**
 * Plus chargée encore : la page 7 refusée, avec un détail de plus dit à la fin de l'exemple (« Il gagne du temps. ») :
 * même aux tailles minimales, écarts resserrés, elle ne tient plus en carré ; sa dernière scène passe sur une page de plus.
 */
export function ficheTropChargee(): FicheTableau {
  const f = ficheRefusee({ page7: true });
  const s08 = f.scenes.find((s) => s.id === "s08")!;
  const ancre = s08.texteDit.split(/\s+/).length;
  s08.texteDit += " Il gagne du temps.";
  s08.elements.splice(3, 0, { id: "nouveau", type: "ligne", texte: "Il gagne du temps.", niveau: "texte", role: "resultat", bloc: "detail", ancre });
  // Identifiants renumérotés dans l'ordre (e01…), cibles des gestes comprises.
  const ids = new Map(f.scenes.flatMap((s) => s.elements).map((e, i) => [e.id, `e${String(i + 1).padStart(2, "0")}`]));
  for (const e of f.scenes.flatMap((s) => s.elements)) {
    e.id = ids.get(e.id)!;
    if (e.type === "geste") e.cibleId = ids.get(e.cibleId) ?? e.cibleId;
  }
  return f;
}
