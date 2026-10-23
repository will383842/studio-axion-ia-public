/**
 * MAQUETTES DE VARIÉTÉ (lot L1) · étape 1 : sous-titres RÉELS de 3 maquettes, calculés par la brique centrale
 * (`src/briques/sous-titres`, style du format « Cas concret » : `STYLE_SOUS_TITRES_DUO`, centre pleine image), pour
 * montrer la variation selon l'importance des mots : mot fort en Impact, mot souligné, base avec mots orange.
 * Jamais sur un titre (le haut de l'image est déclaré occupé, comme en production).
 *
 * Calcul PUR, sans réseau : `pnpm exec tsx outils/maquettes-variete/sous-titres.mts`
 * → `outils/maquettes-variete/sortie/sous-titres.json` (lu par `rendre.mjs` sur le serveur).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SegmentSousTitres } from "@/domaine/types";
import * as moduleBrique from "@/briques/sous-titres";

const brique = ((moduleBrique as unknown as { default?: typeof moduleBrique }).default ?? moduleBrique) as typeof moduleBrique;
const { appliquerChoixGroupe, donneesCalque, fabriquerSousTitres } = brique;
const fab = await import("@/moteurs/montage-cas-concret/fabriquer");
const { STYLE_SOUS_TITRES_DUO, LARGEUR_SOUS_TITRES_PCT, zonesOccupeesSousTitres } = ((fab as unknown as { default?: typeof fab }).default ?? fab) as typeof fab;
const zo = await import("@/moteurs/montage-cas-concret/zone-objets");
const { centreSousTitresPleineImagePct } = ((zo as unknown as { default?: typeof zo }).default ?? zo) as typeof zo;

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, "sortie");
mkdirSync(SORTIE, { recursive: true });
const style = { ...STYLE_SOUS_TITRES_DUO, positionPct: centreSousTitresPleineImagePct(), largeurMaxPct: LARGEUR_SOUS_TITRES_PCT };
const RESEAUX = ["tiktok", "instagram", "facebook", "linkedin"] as const;

type Sortie = Record<string, { donnees: ReturnType<typeof donneesCalque>; instantSec: number; resume: string }>;
const sortie: Sortie = {};

/** Une phrase, groupée par la brique ; `choix` force le style d'un groupe (Impact, souligné), comme le mélange le ferait. */
function phrase(nom: string, texte: string, emphase: string[], choix: "impact" | "souligne" | "base", motFort: string) {
  const dureeSec = 2.4;
  let segs: SegmentSousTitres[] = fabriquerSousTitres({ texte, dureeSec, emphase, style, base: "minimal", intensite: "sobre", occupe: zonesOccupeesSousTitres(dureeSec), ratio: "9:16", reseaux: [...RESEAUX] } as Parameters<typeof fabriquerSousTitres>[0]);
  // Un seul groupe d'une ligne : la phrase entière (courte), pour la maquette.
  segs = [{ ...segs[0], id: "g1", finSec: segs.at(-1)!.finSec, mots: segs.flatMap((s) => s.mots) }];
  const i = segs[0].mots.findIndex((m) => m.mot.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === motFort);
  if (choix === "impact") segs = appliquerChoixGroupe(segs, "g1", "impact");
  if (choix === "souligne") segs = [{ ...segs[0], style: "base", souligne: i >= 0 ? i : null, importance: 2 }];
  const donnees = donneesCalque({ segments: segs, base: "minimal", ratio: "9:16", reseaux: [...RESEAUX], style });
  sortie[nom] = { donnees, instantSec: 2.2, resume: `${choix} · « ${segs[0].mots.map((m) => (m.enValeur ? `[${m.mot}]` : m.mot)).join(" ")} »` };
}

phrase("m01-ouverture-chiffre", "Deux cents par jour !", ["deux cents"], "impact", "cents");
phrase("m03-etape-plein-cadre", "L'IA écrit l'article entier.", ["l'article"], "souligne", "larticle");
phrase("m15-jauge-13-criteres", "Une note sur 100, sur 13 critères.", ["13 critères"], "base", "");

writeFileSync(join(SORTIE, "sous-titres.json"), JSON.stringify(sortie), "utf-8");
for (const [n, s] of Object.entries(sortie)) console.log(n, s.resume);
