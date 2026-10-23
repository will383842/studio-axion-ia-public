/**
 * Prépare la prise complète de Will (IMG_7747, 130,7 s) pour la répétition générale v4 :
 *  1. transcription horodatée RÉELLE de la prise (celle du générateur, `tests/fixtures/img7747-v2-montage-reel.json`, faite par
 *     faster-whisper sur CE fichier ; le modèle n'est pas téléchargeable depuis cette session, voir COMPTE-RENDU) ;
 *  2. coupes de la chaîne réelle (`calculerCoupes` : silences, reprises) → intervalles gardés → mots de la vidéo MONTÉE ;
 *  3. écrit `docs/facecam-animee-v4/repetition-generale/transcription.json` (mots bruts + gardes + mots montés).
 * À lancer depuis la racine : npx tsx outils/facecam-animee-v4/preparer-prise.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { appliquerRecalages, calculerCoupes, motsDuMontage, versPrise } from "../../src/briques/coupes";
import { horodaterMotsPrononces } from "../../src/briques/calage/report";
import type { MotHorodate } from "../../src/domaine/types";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const src = readFileSync("tests/facecam-reprise-cartes.test.ts", "utf-8");
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(src)![1];
const DUREE_PRISE = 130.732;
const plan = calculerCoupes({ mots: reel.mots, dureeSec: DUREE_PRISE, texteValide: SCRIPT });
const mots = appliquerRecalages(reel.mots, plan.recalages);
const montes = motsDuMontage(mots, plan.gardes);
// Orthographe du texte validé posée sur les instants de la voix (chaîne réelle : comme `outils/verification-v2/img7747.mts`).
const texteMonte = plan.phrases.filter((p) => p.debutSec !== undefined).map((p) => p.texte).join(" ");
const motsTexte = horodaterMotsPrononces(texteMonte.split(/\s+/).filter(Boolean), montes);
// Rendu à 30 i/s (les coupes du studio sont sur la grille de 25 i/s) : chaque intervalle gardé est recalé sur la grille de 30 i/s, et les
// instants des mots sont refaits sur CES intervalles, de sorte que la ligne de temps des mots est exactement celle du fichier monté.
const G = 30;
const gardes = plan.gardes.map((g) => ({ debutSec: Math.round(g.debutSec * G) / G, finSec: Math.round(g.finSec * G) / G, debutOrigine: g.debutSec, finOrigine: g.finSec }));
const debuts: number[] = [];
let cumul = 0;
for (const g of gardes) { debuts.push(cumul); cumul += g.finSec - g.debutSec; }
/** Mot (sur la ligne de temps de la prise brute) → ligne de temps montée à 30 i/s, ou null s'il n'est pas dans un intervalle gardé. */
const versMontee = (t: number, milieu: number) => {
  const k = gardes.findIndex((g) => milieu >= g.debutOrigine && milieu <= g.finOrigine);
  if (k < 0) return null;
  const g = gardes[k];
  return +(debuts[k] + Math.min(Math.max(t, g.debutOrigine), g.finOrigine) - g.debutOrigine).toFixed(3);
};
const enMontee = (m: { mot: string; debutSec: number; finSec: number }) => {
  const milieu = (m.debutSec + m.finSec) / 2;
  const a = versMontee(m.debutSec, milieu);
  const f = versMontee(m.finSec, milieu);
  return a === null || f === null ? null : { w: m.mot, a, f: Math.max(f, +(a + 0.04).toFixed(3)) };
};
// `montes` et `motsTexte` sont sur la ligne de temps 25 i/s ; on repart des mots de la prise brute pour les deux listes.
const motsMontes = mots.map(enMontee).filter((x): x is NonNullable<typeof x> => x !== null);
const versBrut = (m: { debutSec: number }) => versPrise(m.debutSec, plan.gardes);
const motsTexte30 = motsTexte.map((m) => {
  const brut = versBrut(m);
  const fin = versPrise(m.finSec, plan.gardes);
  return enMontee({ mot: m.mot, debutSec: brut, finSec: Math.max(fin, brut + 0.04) });
}).filter((x): x is NonNullable<typeof x> => x !== null);
writeFileSync("docs/facecam-animee-v4/repetition-generale/transcription.json", JSON.stringify({
  prise: "studio-rendu/compositions/interface-claire/motion-v4/communs/prise-complete-IMG7747.mp4",
  dureePriseSec: DUREE_PRISE,
  origine: "transcription du générateur (faster-whisper, mots horodatés de la prise brute), tests/fixtures/img7747-v2-montage-reel.json",
  motsPriseBrute: reel.mots.map((m) => ({ w: m.mot, a: m.debutSec, f: m.finSec })),
  gardes: gardes.map((g) => ({ debutSec: g.debutSec, finSec: g.finSec })),
  dureeMonteeSec: +cumul.toFixed(3),
  motsMontes,
  motsMontesTexteValide: motsTexte30,
}, null, 1));
console.log({ texte: motsTexte30.length, gardes: gardes.length, dureeMonteeSec: cumul, mots: motsMontes.length, bruts: reel.mots.length, premier: motsMontes[0], dernier: motsMontes.at(-1) });
