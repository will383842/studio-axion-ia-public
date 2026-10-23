/**
 * Lot B · MESURE de la part de `v4-centree` dans les vidéos du cas concret (22 cas du catalogue, 20 vidéos par cas) :
 * pour chaque écran posé en `v4-centree` (hors fond fort, hors tirage v4), la cause : aucune maquette L6 éligible, seules
 * des maquettes exclues (même type de suite / même rang que la vidéo précédente du canal) ou tirage au poids.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { MISE_EN_PAGE_V4, MISES_EN_PAGE_L6, misesEnPageEligibles } from "@/briques/ecrans-motion/mises-en-page";
import { ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { ajouterAHistorique, entreeHistorique, estV4, maquettesPrecedentes, mettre, tirer, type EcranAMettre, type EntreeHistorique } from "@/moteurs/montage-cas-concret/variete";

const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const CANAUX = [["facebook", "instagram", "tiktok", "linkedin"], ["linkedin"], ["instagram", "tiktok"], ["facebook"]] as const;
const VIDEOS_PAR_CAS = 20;

describe("Lot B · mesure de la part de v4-centree", () => {
  it("compte les écrans v4-centree par cause", () => {
    const total = { ecrans: 0, v4: 0, aucune: 0, exclue: 0, exclueCanal: 0, exclueEcran: 0, exclueMixte: 0, uneSeuleL6: 0, maxPoidsParVideo: 0, videosPoidsPlusDe2: 0, poids: 0, videos: 0, videosPlusDe2: 0, maxParVideo: 0 };
    const parType: Record<string, { n: number; v4: number; aucune: number }> = {};
    for (const cas of CATALOGUE) {
      const fiche = ficheParGabarit(cas, FIXE);
      let debut = 0;
      const corrige = fiche.ecrans.map((e) => ({ ...e, debutMs: debut, finMs: (debut += 3000) }));
      const captures = Object.fromEntries(corrige.filter((e) => e.type === "etape" && e.visuel.sorte === "ecran").map((e) => [e.id, { cle: `cap-${e.id}.jpg` }]));
      const cales = ecransCales(corrige as never, [], null, captures, cas.faits);
      const aMettre: EcranAMettre[] = cales.map((e) => ({ id: e.id, type: e.type, fond: e.fond, contenu: e }));
      let historique: EntreeHistorique[] = [];
      for (let i = 0; i < VIDEOS_PAR_CAS; i++) {
        const videoId = `${cas.id}-${i}`;
        const canaux = CANAUX[(i + cas.id.length) % CANAUX.length]!;
        const tirage = tirer({ videoId, canaux, historique });
        const mise = mettre(tirage, aMettre, historique, canaux);
        const interdites = maquettesPrecedentes(mise.tirage, historique, canaux);
        let parVideo = 0;
        let poidsVideo = 0;
        total.videos++;
        if (!estV4(mise.tirage)) {
          aMettre.forEach((e, k) => {
            const te = mise.ecrans[e.id]!;
            if (te.fondFort) return;
            total.ecrans++;
            const t = (parType[e.type] ??= { n: 0, v4: 0, aucune: 0 });
            t.n++;
            if (te.miseEnPage !== MISE_EN_PAGE_V4) return;
            total.v4++;
            t.v4++;
            parVideo++;
            const l6 = misesEnPageEligibles(e.contenu!).filter((c) => c !== MISE_EN_PAGE_V4);
            if (!l6.length) {
              total.aucune++;
              t.aucune++;
              return;
            }
            const rang = aMettre.slice(0, k).filter((x) => x.type === e.type).length;
            const precedent = k > 0 && aMettre[k - 1]!.type === e.type ? mise.ecrans[aMettre[k - 1]!.id]!.miseEnPage : "";
            const parCanal = (c: string) => interdites[e.type]?.[rang]?.has(c) === true;
            const parEcran = (c: string) => c === precedent;
            if (l6.every((c) => parCanal(c) || parEcran(c))) {
              total.exclue++;
              if (l6.every(parCanal)) total.exclueCanal++;
              else if (l6.every(parEcran)) total.exclueEcran++;
              else total.exclueMixte++;
              if (l6.length === 1) total.uneSeuleL6++;
            } else {
              total.poids++;
              poidsVideo++;
            }
          });
        }
        total.maxParVideo = Math.max(total.maxParVideo, parVideo);
        if (poidsVideo > 2) total.videosPoidsPlusDe2++;
        total.maxPoidsParVideo = Math.max(total.maxPoidsParVideo, poidsVideo);
        if (parVideo > 2) total.videosPlusDe2++;
        historique = ajouterAHistorique(historique, entreeHistorique(videoId, canaux, mise.tirage, "2026-10-18T12:00:00.000Z"));
      }
    }
    const pct = (n: number) => (total.ecrans ? Math.round((1000 * n) / total.ecrans) / 10 : 0);
    const rapport = {
      ...total,
      partV4: pct(total.v4),
      partAucune: pct(total.aucune),
      partExclue: pct(total.exclue),
      partPoids: pct(total.poids),
      parType: Object.fromEntries(Object.entries(parType).map(([k, v]) => [k, { ...v, partV4: Math.round((1000 * v.v4) / v.n) / 10 }])),
      typesAvecL6: Object.keys(MISES_EN_PAGE_L6),
    };
    if (process.env.MESURE_SORTIE) writeFileSync(process.env.MESURE_SORTIE, JSON.stringify(rapport, null, 1));
    expect(total.ecrans).toBeGreaterThan(0);
    // « aucune L6 éligible » ne domine pas : sinon le poids ne servirait à rien (rapport à faire, pas de correctif).
    expect(total.aucune).toBeLessThan(total.v4 / 2);
    // Part RÉELLE de v4-centree (hors fond fort, hors tirage v4, hors écrans sans maquette éligible) : mesuré 11,8 % (12,0 % avec les tirages du lot C),
    // plafond 12,5 %. La cible de 10 % du plan n'est pas atteinte : il reste des écrans dont l'unique maquette éligible
    // est exclue (même type de suite, ou vidéo précédente du canal).
    expect((total.v4 - total.aucune) / (total.ecrans - total.aucune)).toBeLessThanOrEqual(0.125);
    // Maximum de v4-centree dans une vidéo : mesuré 6.
    expect(total.maxParVideo).toBeLessThanOrEqual(6);
  });
});
