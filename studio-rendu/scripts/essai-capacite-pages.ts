/**
 * ESSAI DE CAPACITÉ des types de pages M3a (comme `essai-capacite-cartes.ts` pour T02) : pour chaque type et chaque nombre
 * d'éléments, cherche (dichotomie) la plus longue valeur de chaque champ qui ne déborde pas, les autres champs restant à leur
 * budget actuel. Un débordement fait échouer le rendu : l'échec est ici le signal. Les budgets de `registre-pages.ts` se règlent
 * sur ces mesures (avec de la marge : un texte réel n'est pas aussi régulier qu'un texte inventé).
 * Usage (depuis `studio-rendu/`) : `npx tsx --tsconfig ../tsconfig.json scripts/essai-capacite-pages.ts [T06 T20 ...]`
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PAGES, type TypePage } from "../../src/briques/visuels/registre-pages.js";
import { LIMITES } from "../../src/briques/visuels/limites.js";
import { casMax, specAutour, texteInvente } from "./contenu-essai-visuel.js";
import { ouvrirRendeur } from "./rendu-visuel.js";

const rendeur = await ouvrirRendeur();
const sortie = resolve(mkdtempSync(resolve(tmpdir(), "capacite-pages-")), "page.jpg");

async function tient(page: Record<string, unknown>): Promise<boolean> {
  try {
    const { spec, index } = specAutour(page);
    await rendeur.pageSansSchema(spec, index, sortie);
    return true;
  } catch (e) {
    if (/déborde de son cadre|ne tient pas dans la largeur/.test(String(e))) return false;
    throw e;
  }
}

/** Plus grande longueur de 1 à `plafond` pour laquelle `construire(longueur)` tient. */
async function chercher(construire: (longueur: number) => Record<string, unknown>, plafond: number): Promise<number> {
  if (await tient(construire(plafond))) return plafond;
  let bas = 1;
  let haut = plafond;
  while (haut - bas > 1) {
    const milieu = Math.floor((bas + haut) / 2);
    if (await tient(construire(milieu))) bas = milieu;
    else haut = milieu;
  }
  return bas;
}

const demandes = process.argv.slice(2) as TypePage[];
const types = (demandes.length > 0 ? demandes : (Object.keys(PAGES) as TypePage[])).filter((t) => t !== "T21");

for (const type of types) {
  const cas = casMax(type);
  const dernier = cas[cas.length - 1].page;
  if (type !== "T10") {
    const titreMax = await chercher((l) => ({ ...dernier, titre: texteInvente(l) }), LIMITES.titreMax);
    console.log(`${type} : titre de page tenant (budget actuel ${PAGES[type].titreMax}) = ${titreMax} signes`);
  }
  for (const c of cas) {
    const page = c.page as Record<string, unknown>;
    const tableau = (["cartes", "points", "etapes"] as const).find((k) => Array.isArray(page[k]));
    if (tableau) {
      const elements = page[tableau] as Record<string, string>[];
      for (const champ of Object.keys(elements[0]).filter((k) => k !== "mini")) {
        const plafond = champ === "titre" ? LIMITES.titreMax : LIMITES.corpsMax;
        const trouve = await chercher((l) => ({ ...page, [tableau]: elements.map((e, i) => ({ ...e, [champ]: texteInvente(l, i + 3) })) }), plafond);
        console.log(`${type} ${c.nom} : ${tableau}[].${champ} tenant = ${trouve} signes (budget actuel ${elements[0][champ].length})`);
      }
    } else if (type === "T08") {
      for (const champ of ["avant", "apres"]) console.log(`T08 : ${champ} tenant = ${await chercher((l) => ({ ...page, [champ]: texteInvente(l) }), LIMITES.corpsMax)} signes (budget actuel ${(page[champ] as string).length})`);
    } else if (type === "T10") {
      console.log(`T10 : message tenant = ${await chercher((l) => ({ ...page, message: texteInvente(l) }), LIMITES.corpsMax)} signes (budget actuel ${(page.message as string).length})`);
      console.log(`T10 : légende tenant = ${await chercher((l) => ({ ...page, legende: texteInvente(l) }), LIMITES.corpsMax)} signes (budget actuel ${(page.legende as string).length})`);
    }
  }
}
