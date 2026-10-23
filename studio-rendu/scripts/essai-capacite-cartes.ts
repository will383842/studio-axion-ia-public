/**
 * ESSAI DE CAPACITÉ de la page dense T02 : pour 2 à 6 cartes (1 carte est refusée), rend la page avec des textes inventés aux longueurs
 * MAXIMALES du schéma, puis cherche (dichotomie) la plus longue valeur de `corps` qui ne déborde pas. Un débordement
 * fait échouer le rendu (mesure de `Carte.tsx`) : l'échec est ici le signal, pas une erreur du script.
 * Avec `--budget` : rend 2 à 6 cartes exactement au budget du schéma (`capaciteCarte`) et sort en erreur si l'une déborde.
 * Usage (depuis `studio-rendu/`) : `npx tsx --tsconfig ../tsconfig.json scripts/essai-capacite-cartes.ts [--max-seul]`
 * Navigateur : `STUDIO_RENDU_NAVIGATEUR`, comme pour `essai-visuel.ts`. Aucun fichier écrit dans le dépôt.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { validerProprietesPage } from "../../src/visuels/proprietes-page.js";
import { capaciteCarte } from "../../src/briques/visuels/registre-pages.js";
import { chargerReglesCarrousel } from "../../src/briques/visuels/regles/charger-regles.js";
import { LIMITES } from "../../src/briques/visuels/limites.js";
import { ID_COMPOSITION_PAGE } from "../compositions/visuels/commun/constantes.js";
import { MINIS_ESSAI, texteInvente } from "./contenu-essai-visuel.js";

const REGLES = chargerReglesCarrousel();
process.env.STUDIO_RENDU_ESSAI ??= "1";

const { renderStill, selectComposition } = await import("@remotion/renderer");
const { paquetCompositions, REGLAGES_RENDU } = await import("../src/remotion.js");
const serveUrl = await paquetCompositions();
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
const options = navigateur ? { browserExecutable: navigateur } : {};
const sortie = resolve(mkdtempSync(resolve(tmpdir(), "capacite-cartes-")), "page.jpg");

/** `true` si la page rend sans débordement. */
async function tient(nbCartes: number, longueurTitre: number, longueurCorps: number): Promise<boolean> {
  const cartes = Array.from({ length: nbCartes }, (_, i) => ({
    titre: texteInvente(longueurTitre, i),
    corps: texteInvente(longueurCorps, i + 3),
    mini: MINIS_ESSAI[i % MINIS_ESSAI.length],
  }));
  const spec = { version: "carrousel/1", alt: "Essai de capacité", pages: [{ type: "T02", titre: "Capacité des cartes", cartes }] };
  const inputProps = validerProprietesPage({ spec, index: 0 }) as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: ID_COMPOSITION_PAGE, inputProps, ...options });
  try {
    await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output: sortie, frame: 0, imageFormat: "jpeg", inputProps, ...options } as never);
    return true;
  } catch (e) {
    if (/déborde de son cadre/.test(String(e))) return false;
    throw e;
  }
}

const titreArg = process.argv.find((a) => a.startsWith("--titre="));
const longueurTitre = titreArg ? Number(titreArg.slice(8)) : LIMITES.titreMax;
if (process.argv.includes("--budget")) {
  let echec = false;
  for (let n = REGLES.cartes.min; n <= 6; n++) {
    const c = capaciteCarte(n);
    const ok = await tient(n, c.titre, c.corps);
    console.log(`${n} carte(s), budget titre ${c.titre} + corps ${c.corps} : ${ok ? "tient" : "DÉBORDE"}`);
    echec ||= !ok;
  }
  process.exit(echec ? 1 : 0);
}
const seulementMax = process.argv.includes("--max-seul");
for (let n = REGLES.cartes.min; n <= 6; n++) {
  const auMax = await tient(n, longueurTitre, LIMITES.corpsMax);
  if (seulementMax) {
    console.log(`${n} carte(s), titre ${longueurTitre} + corps ${LIMITES.corpsMax} : ${auMax ? "tient" : "DÉBORDE"}`);
    continue;
  }
  let bas = 0;
  let haut = LIMITES.corpsMax;
  if (auMax) bas = haut;
  while (haut - bas > 4) {
    const milieu = Math.floor((bas + haut) / 2);
    if (await tient(n, longueurTitre, milieu)) bas = milieu;
    else haut = milieu;
  }
  console.log(`${n} carte(s) : corps maximal sans débordement ≈ ${bas} caractères (titre de ${longueurTitre})`);
}
