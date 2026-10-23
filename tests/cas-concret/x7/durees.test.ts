/**
 * X7 · Durées : l'écriture estime la durée dite en caractères par seconde, avec la valeur du tableau animé (calée sur la
 * voix réelle, même recette), et vise toujours la vidéo la plus courte de 40 à 47 s (V4-2 ; 45 à 55 s avant). Un cas à peu de matière atteint la
 * visée par des écrans qui ne portent AUCUN fait nouveau. Vérifié sur les 7 cas × réseaux × avec et sans le mot (le mot
 * branché sur Instagram et Facebook, pour que la fin au mot soit réellement planifiée).
 */
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import { CARACTERES_PAR_SECONDE_ATEMPO_108, MESURES_CALAGE, dureeDiteBrute } from "@/domaine/duree-tableau";
import type { ReseauCas } from "@/formats/cas-concret";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { CONSIGNE_ECRITURE, DUREE_SORTIE_COURTE_VISEE_MS, dureeDiteMs, dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { nombresDe, sansPointsDeSigle, TENUE_FINALE_MS, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";

const FIXE = { videoId: "v-x7", versionId: "ver-x7", habillage: "charte-duo/1", origine: "porte-a" } as const;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const CHOIX: ReseauCas[][] = [...TOUS.map((r) => [r]), TOUS];

function sortie(cas: (typeof CATALOGUE)[number], reseaux: ReseauCas[], avecMot: boolean) {
  const plan = regrouperFins(planDesFins({ reseaux, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: cas.mot, ...(cas.motDit ? { motDit: cas.motDit } : {}), avecMot, motSur: avecMot ? ["instagram", "facebook"] : [], table: TABLE_FINS_DIAGNOSTIC }));
  const fiche = ficheParGabarit(cas, FIXE, dureesDesFins(plan.fins));
  const corps = dureeDiteMs(fiche.ecrans);
  const durees = plan.fins.map((f) => (corps + dureeDiteMs(f.ecrans) + TENUE_FINALE_MS) / 1000);
  return { plan, fiche, durees };
}

describe("X7 · l'estimateur de durée en caractères", () => {
  it("la valeur est celle du domaine commun (20,5 caractères dits par seconde), lue et non recopiée", () => {
    // Le cas concret garde sa voix à `atempo` 1,08 (le tableau est passé à 1,04 le 18/10) : son débit reste 20,5.
    expect(CARACTERES_PAR_SECONDE_ATEMPO_108).toBe(20.5);
    // Les deux mesures réelles du calage, retrouvées à 5 % près par l'estimateur de l'écriture.
    for (const m of MESURES_CALAGE) {
      const texte = "a".repeat(m.caracteres);
      expect(Math.abs(dureeDiteMs([{ texteDit: texte }]) / 1000 - m.dureeSec) / m.dureeSec).toBeLessThan(0.05);
    }
    expect(dureeDiteMs([{ texteDit: "Bonjour" }, { texteDit: "à vous." }])).toBe(Math.round(dureeDiteBrute("Bonjour à vous.", CARACTERES_PAR_SECONDE_ATEMPO_108) * 1000));
  });

  it("la consigne donnée à Claude dit le débit en caractères et la manière d'allonger sans fait nouveau", () => {
    expect(CONSIGNE_ECRITURE).toContain("20,5 caractères dits par seconde");
    expect(CONSIGNE_ECRITURE).toContain("ajoutez des écrans qui ne portent AUCUN fait nouveau");
    // B3 : la suggestion « écran titre de transition » a été retirée de R21 (volontairement).
    expect(CONSIGNE_ECRITURE).not.toContain("un écran « titre » de transition qui redit la promesse");
    expect(CONSIGNE_ECRITURE).toContain("une « question » plus développée");
    expect(CONSIGNE_ECRITURE).toContain("le geste, puis ce qu'il évite");
  });
});

describe("X7 · 7 cas × réseaux × avec et sans le mot : la visée est tenue, sans fait nouveau", () => {
  const lignes = CATALOGUE.flatMap((cas) => [true, false].flatMap((avecMot) => CHOIX.map((reseaux) => [`${cas.id} · ${reseaux.join("+")} · ${avecMot ? "avec" : "sans"} le mot`, cas, reseaux, avecMot] as const)));

  it.each(lignes)("%s", (_nom, cas, reseaux, avecMot) => {
    const { plan, fiche, durees } = sortie(cas, reseaux, avecMot);
    expect(plan.sansFin).toEqual([]);
    // La sortie la plus courte dans la visée (40 à 47 s depuis V4-2), la plus longue sous la borne de refus (65 s).
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(DUREE_SORTIE_COURTE_VISEE_MS.min / 1000);
    expect(Math.min(...durees)).toBeLessThanOrEqual(DUREE_SORTIE_COURTE_VISEE_MS.max / 1000);
    expect(Math.max(...durees)).toBeLessThanOrEqual(65);
    // La fiche passe les 22 règles, et aucun nombre n'est hors des faits du cas.
    const v = validerFicheEcrans(fiche, { cas, texteScript: texteDuCorps(fiche), fins: plan.fins });
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    const permis = new Set([...cas.faits.flatMap((f) => f.valeurs), ...nombresDe(sansPointsDeSigle(cas.conformite?.rgpd?.phrase ?? ""))]);
    for (const e of fiche.ecrans) for (const n of nombresDe(sansPointsDeSigle(e.texteDit))) expect(permis.has(n), `${e.id} : ${n}`).toBe(true);
  });

  it("le cas à peu de matière (devis-signe-alerte) atteint la visée sans fait nouveau", () => {
    const cas = CATALOGUE.find((c) => c.id === "devis-signe-alerte")!;
    const { fiche, durees } = sortie(cas, ["facebook"], false);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(DUREE_SORTIE_COURTE_VISEE_MS.min / 1000);
    // V4-2 : la visée de 40 à 47 s n'a plus besoin des écrans de reprise (« En résumé : », question développée) pour ce
    // cas ; ils restent possibles (test suivant).
    expect(fiche.ecrans.map((e) => e.texteDit).some((t) => t.startsWith("En résumé : "))).toBe(false);
  });

  it("les écrans de reprise restent possibles quand la visée les demande (fin très courte)", () => {
    const cas = CATALOGUE.find((c) => c.id === "devis-signe-alerte")!;
    const fiche = ficheParGabarit(cas, FIXE, { plusCourteMs: 1_000, plusLongueMs: 1_000 });
    expect(fiche.ecrans.map((e) => e.texteDit).some((t) => t.startsWith("En résumé : "))).toBe(true);
  });
});
