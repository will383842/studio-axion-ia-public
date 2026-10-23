/** IMG_7747 (données réelles) : coupes → mots montés → réalisation → habillage → cartes RENDUES par le vrai studio-rendu. */
import { readFileSync, writeFileSync } from "node:fs";
import { appliquerRecalages, calculerCoupes, controlerCoupes, motsDuMontage } from "@/briques/coupes";
import { horodaterMotsPrononces } from "@/briques/calage/report";
import { realiser, controlerRealisation } from "@/briques/realisation";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { demandeRenduCarte } from "@/moteurs/montage-facecam/raccords";
import { creerServiceRenduHttp, suivreRendu } from "@/fournisseurs/rendu/client";
import type { MotHorodate } from "@/domaine/types";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };
const src = readFileSync("tests/facecam-reprise-cartes.test.ts", "utf-8");
const SCRIPT = /const SCRIPT =\s*"([^"]+)"/.exec(src)![1];
const plan = calculerCoupes({ mots: reel.mots, dureeSec: 130.732, texteValide: SCRIPT });
const mots = appliquerRecalages(reel.mots, plan.recalages);
const montes = motsDuMontage(mots, plan.gardes);
const texteMonte = plan.phrases.filter((p) => p.debutSec !== undefined).map((p) => p.texte).join(" ");
const motsTexte = horodaterMotsPrononces(texteMonte.split(/\s+/).filter(Boolean), montes);
const r = realiser({ gardes: plan.gardes, mots, piste: null, source: { largeur: 1080, hauteur: 1920 } });
const coupesSec: number[] = [];
let t = 0;
for (const g of plan.gardes.slice(0, -1)) coupesSec.push(+(t += g.finSec - g.debutSec).toFixed(3));
const h = habillageFacecam({ pisteMonteeCle: "x/montage.mov", dureeSec: plan.dureeSortieSec, mots: motsTexte, coupesSec, prefixeCartes: "facecam/img7747/cartes" });
const rapport = {
  dureeSortieSec: plan.dureeSortieSec,
  dureeRealisation: r.dureeSec,
  dernierMotMonte: montes.at(-1),
  dernierMotTexte: motsTexte.at(-1),
  nbMotsMontes: montes.length,
  nbMotsTexte: motsTexte.length,
  phrasesManquantes: controlerCoupes(plan, reel.mots).phrasesManquantes,
  coupesDansUnMot: controlerCoupes(plan, reel.mots).coupesDansUnMot,
  gardesHorsGrille: plan.gardes.filter((g) => Math.abs(g.debutSec * 25 - Math.round(g.debutSec * 25)) > 1e-6 || Math.abs(g.finSec * 25 - Math.round(g.finSec * 25)) > 1e-6).length,
  realisation: controlerRealisation(r),
  tailles: r.plans.map((p) => p.taille).join(","),
  segments: h.segments.length,
  segmentsChevauchants: h.segments.filter((s, i) => i > 0 && s.debutSec < h.segments[i - 1].finSec - 1e-6).length,
  segmentsHors: h.segments.filter((s) => s.finSec > plan.dureeSortieSec + 1e-6).length,
  doublons: h.segments.filter((s, i) => i > 0 && s.texte === h.segments[i - 1].texte).map((s) => s.texte),
  cartes: h.cartes.map((c) => ({ id: c.id, cle: c.cle, erreurs: c.erreurs, repli: c.repli, modele: (c.parametres as { carte?: { modele?: string } }).carte?.modele })),
  ecransPartages: h.entree.ecransPartages,
};
writeFileSync("/tmp/claude-0/v2/img7747/rapport.json", JSON.stringify(rapport, null, 1));
writeFileSync("/tmp/claude-0/v2/img7747/segments.json", JSON.stringify(h.segments, null, 1));
writeFileSync("/tmp/claude-0/v2/img7747/cartes.json", JSON.stringify(h.cartes, null, 1));
console.log(JSON.stringify({ ...rapport, ecransPartages: undefined, cartes: rapport.cartes.length }, null, 1));
if (process.env.RENDRE !== "1") process.exit(0);
const rendu = creerServiceRenduHttp("http://127.0.0.1:4100", { cle: "cle-essai" });
const demandes = h.cartes.map((c) => demandeRenduCarte(c, `http://127.0.0.1:4700/${c.cle}`));
for (const d of demandes) await rendu.soumettre(d);
const t0 = Date.now();
for (const d of demandes) {
  for (;;) {
    const s = await suivreRendu(rendu, d);
    if (s.statut === "termine") { console.log("carte rendue", d.sortie.cle, ((Date.now() - t0) / 1000).toFixed(0), "s"); break; }
    if (s.statut === "echec") { console.log("carte ÉCHEC", d.sortie.cle, JSON.stringify(s.erreur)); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
