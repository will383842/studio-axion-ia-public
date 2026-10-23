/** Vérifie par le code les règles de rythme R1-R3 (standard v4 § G) sur le plan de l'enchaînement de 15 s. Usage : npx tsx verifier-rythme.ts */
import { evenementsAvisEtoiles } from "./AvisEtoiles";
import { evenementsCarrouselFeuillete } from "./CarrouselFeuillete";
import { evenementsChrono } from "./Chrono";
import { evenementsEclatChiffre } from "./EclatChiffre";
import { evenementsFilEtape } from "./FilEtape";
import { evenementsJaugePourcentage } from "./JaugePourcentage";
import { evenementsPageWebDefile } from "./PageWebDefile";
import { evenementsPileNotifications } from "./PileNotifications";
import { planEnchainement } from "./plan-lot3";

const EV: Record<string, (p: any) => number[]> = {
  AvisEtoiles: evenementsAvisEtoiles, CarrouselFeuillete: evenementsCarrouselFeuillete, Chrono: evenementsChrono, EclatChiffre: evenementsEclatChiffre,
  FilEtape: evenementsFilEtape, JaugePourcentage: evenementsJaugePourcentage, PageWebDefile: evenementsPageWebDefile, PileNotifications: evenementsPileNotifications,
  EtiquetteGenerique: (p) => [0, 4, p.iSortie],
};
const plan = planEnchainement("B");
const ev: number[] = [];
for (const it of plan.items) for (const e of EV[it.nom](it.props)) ev.push(it.debut + e);
ev.sort((a, b) => a - b);
const T = plan.total;
const densite = (a: number, b: number) => ev.filter((e) => e >= a && e < b).length / ((b - a) / 30);
let pire = 99, ou = 0;
for (let a = 0; a + 150 <= T; a += 5) { const d = densite(a, a + 150); if (d < pire) { pire = d; ou = a; } }
let plusLong = 0, apres = 0;
for (let k = 1; k < ev.length; k++) if (ev[k] - ev[k - 1] > plusLong) { plusLong = ev[k] - ev[k - 1]; apres = ev[k - 1]; }
// présence d'un objet (hors sous-titres/barre)
const pres = new Array(T).fill(false);
for (const it of plan.items) for (let i = it.debut; i < Math.min(T, it.debut + it.duree); i++) pres[i] = true;
let seule = 0, seuleMax = 0, seuleTotal = 0;
for (let i = 0; i < T; i++) { if (!pres[i]) { seule++; seuleTotal++; seuleMax = Math.max(seuleMax, seule); } else seule = 0; }
console.log(`événements : ${ev.length} sur ${(T / 30).toFixed(1)} s = ${(ev.length / (T / 30)).toFixed(2)}/s`);
console.log(`densité minimale sur 5 s glissantes : ${pire.toFixed(2)}/s (fenêtre ${(ou / 30).toFixed(1)}-${(ou / 30 + 5).toFixed(1)} s)`);
console.log(`plus long intervalle sans événement : ${plusLong} i (${(plusLong / 30).toFixed(2)} s) après l'image ${apres}`);
console.log(`prise seule : plus longue ${seuleMax} i, total ${seuleTotal} i (${((100 * seuleTotal) / T).toFixed(1)} %)`);
