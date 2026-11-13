/**
 * GV-ST-13 : le .srt d'une face caméra animée suit les groupes de 1 à 2 mots dessinés par la v4.
 * `segmentsSrtV4` (studio) est une copie de `groupesDuPlan` + `grouperMots` (composition) : mêmes groupes, mêmes instants à 1 ms.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { resultatV4 } from "@/moteurs/montage-facecam-animee";
import type { EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { segmentsSrtV4 } from "@/moteurs/montage-facecam-animee/sous-titres-srt";
import { planValide } from "./plan-reference";

type Groupes = PlanFacecamAnimee["groupes"];
const mot = (w: string, a: number, fort?: boolean) => ({ w, a, ...(fort ? { fort: true } : {}) });
/** Plan d'essai : élision coupée, mot interdit, mots de liaison, nombre, dernier mot. */
const ESSAI: Groupes = [
  { mots: [mot("Vos", 0), mot("devis", 0.4), mot("partent,", 0.8)], fin: 1.4 },
  { mots: [mot("l", 1.5), mot("'IA", 1.7, true), mot("de", 2.2), mot("la", 2.5), mot("Certifexemple", 2.8)], fin: 3.4 },
  { mots: [mot("un", 3.5), mot("gain", 3.9), mot("garanti.", 4.2), mot("45", 5), mot("minutes", 5.4)], fin: 6 },
  { mots: [mot("et", 6.2), mot("c'est", 6.4), mot("fini.", 9.5)], fin: 10 },
];
const DUREE = 10.1;
/**
 * La composition v4 importe `remotion`, installé seulement dans `studio-rendu`. Les contrôles obligatoires de GitHub
 * (verifier.yml) n'installent pas ces dépendances : la comparaison stricte avec la composition est alors sautée (et
 * seulement elle). Le contrôle `gv-tests-moteurs.yml` lance ces cas avec les dépendances installées.
 */
const remotionDisponible = (() => {
  try {
    createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion");
    return true;
  } catch {
    return false;
  }
})();
const propre = (t: string) => t.replace(/^[.,;:!?…«»"“”()\s]+|[.,;:!?…«»"“”()\s]+$/g, "").toUpperCase();

describe("srt-identique · segmentsSrtV4 = groupes dessinés par la v4", () => {
  for (const [nom, g, d] of [["plan d'essai", ESSAI, DUREE], ["plan de référence", planValide().groupes, planValide().duree]] as const) {
    it.skipIf(!remotionDisponible)(`${nom} : mêmes groupes, mêmes débuts et fins à 1 ms, mêmes mots`, async () => {
      const { groupesDuPlan } = await import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");
      const attendu = groupesDuPlan(g, d);
      const obtenu = segmentsSrtV4(g, d);
      expect(attendu.length).toBeGreaterThan(0);
      expect(obtenu).toHaveLength(attendu.length);
      obtenu.forEach((s, k) => {
        expect(Math.abs(s.debutSec - attendu[k].debut)).toBeLessThan(0.001);
        expect(Math.abs(s.finSec - attendu[k].fin)).toBeLessThan(0.001);
        expect(s.mots.map((m) => propre(m.mot))).toEqual(attendu[k].mots.map((m) => m.mot));
        s.mots.forEach((m, j) => {
          expect(Math.abs(m.debutSec - attendu[k].mots[j].debut)).toBeLessThan(0.001);
          expect(Math.abs(m.finSec - attendu[k].mots[j].fin)).toBeLessThan(0.001);
          expect(!!m.enValeur).toBe(!!attendu[k].mots[j].fort);
        });
        expect(s.id).toBe(`st-v4-${k}`);
      });
    });
  }

  it("élision recollée, mot interdit absent, texte d'origine gardé", () => {
    const textes = segmentsSrtV4(ESSAI, DUREE).flatMap((s) => s.mots.map((m) => m.mot));
    expect(textes).toContain("l'IA");
    expect(textes).toContain("partent,");
    expect(textes.join(" ")).not.toMatch(/certifexemple|gain|garanti/i);
    expect(segmentsSrtV4(ESSAI, DUREE).some((s) => s.mots.some((m) => m.enValeur))).toBe(true);
  });

  it("la copie `propre` : « 2,5 » reste « 2,5 », « fuite. » devient « FUITE » (le .srt garde le texte d'origine)", () => {
    expect(propre("2,5")).toBe("2,5");
    expect(propre("12:30")).toBe("12:30");
    expect(propre("fuite.")).toBe("FUITE");
    expect(propre("«oui»")).toBe("OUI");
  });

  it.skipIf(!remotionDisponible)("à l'image comme dans le .srt : « 2,5 » et « fuite. »", async () => {
    const { groupesDuPlan } = await import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");
    const g = [{ mots: [{ w: "2,5", a: 0 }, { w: "fuite.", a: 0.5 }], fin: 1 }] as unknown as PlanFacecamAnimee["groupes"];
    const image = groupesDuPlan(g, 2).flatMap((x) => x.mots.map((m) => m.mot));
    expect(image).toContain("2,5");
    expect(image).toContain("FUITE");
  });

  it("la liste de mots de liaison est identique à la composition", async () => {
    const src = (await import("node:fs")).readFileSync("studio-rendu/compositions/interface-claire/motion-v4/communs/briques-v4.tsx", "utf8");
    const copie = (await import("node:fs")).readFileSync("src/moteurs/montage-facecam-animee/sous-titres-srt.ts", "utf8");
    const liste = (t: string) => /const LIAISON = new Set\((\[[^\]]*\])\)/.exec(t)?.[1];
    expect(liste(copie)).toBeDefined();
    expect(liste(copie)).toBe(liste(src));
  });
});

describe("srt-identique · resultatV4", () => {
  const etat = (plan?: PlanFacecamAnimee): EtatChaineV4 => ({
    version: "chaine-v4/1", etape: "fini", demande: { videoId: "v", versionId: "ver", priseCle: "k" },
    ...(plan ? { realisation: { version: "complete" as const, essais: 1, avertissements: 0, plan } } : {}),
    rendu: { cle: "c.mp4", vignetteCle: "v.jpg", dureeSec: 22, taille: 1 },
  } as unknown as EtatChaineV4);

  it("état fini avec plan : sousTitres présent", () => {
    const plan = planValide();
    const res = resultatV4(etat(plan));
    expect(res.sousTitres).toEqual(segmentsSrtV4(plan.groupes, plan.duree));
    expect(res.sousTitres?.length).toBeGreaterThan(0);
  });
  it("sans plan, ou plan sans groupe : sousTitres absent", () => {
    expect("sousTitres" in resultatV4(etat())).toBe(false);
    expect("sousTitres" in resultatV4(etat({ ...planValide(), groupes: [] }))).toBe(false);
  });
});

describe("srt-identique · images au sous-titre masqué du plan validé (GV2-15, option a)", () => {
  /**
   * Le fondateur accepte le nouveau rendu v4 : depuis GV2-15, un groupe n'est masqué que si la plaquette affiche déjà TOUS
   * ses mots porteurs. Sur le plan validé de la répétition générale, 1287 images sont masquées (184 de moins qu'avec l'ancienne
   * règle). Ce test fige ce nombre : tout changement de la règle de masquage doit être décidé, pas subi.
   */
  it.skipIf(!remotionDisponible)("plan validé de la répétition générale : 1287 images au sous-titre masqué (sur 2481)", async () => {
    const { readFileSync } = await import("node:fs");
    const plan = JSON.parse(readFileSync("docs/facecam-animee-v4/repetition-generale/plan-realisateur.json", "utf8")) as PlanFacecamAnimee;
    const { groupesDuPlan } = await import("../../studio-rendu/compositions/interface-claire/VideoAnimeeV4");
    const { groupeDoubleV4 } = await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
    const elements = [...(plan.elementsV4 ?? [])].sort((a, b) => a.debut - b.debut);
    const groupes = groupesDuPlan(plan.groupes, plan.duree);
    const FPS = 30;
    const images = Math.ceil(plan.duree * FPS);
    let masquees = 0;
    for (let f = 0; f < images; f++) {
      const t = f / FPS;
      const g = groupes.find((x) => t >= x.debut - 1e-6 && t < x.fin - 1e-6);
      if (g && groupeDoubleV4(elements, f, g.mots.map((m) => m.mot))) masquees++;
    }
    expect(images).toBe(2481);
    expect(masquees).toBe(1287);
  });
});
