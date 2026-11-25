/** S-15-b1-v21r : appliquer des opérations de plaquettes au plan v4 (pur, éteint, 0 €). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerOperationsPlaquettes, lireOperationsPlaquettes, listerPlaquettes } from "@/domaine/facecam-animee/appliquer-plaquettes";
import { nommerPlaquettes } from "@/domaine/facecam-animee/noms-plaquettes";
import { changerTextePlaquette, decalerPlaquette, retirerPlaquette } from "@/domaine/facecam-animee/operations-plaquettes";
import { schemaPlanFacecamAnimee, type ElementV4Plan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { couperPriseV4, VERSION_CHAINE_V4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";
import { planValide } from "./plan-reference";

const elements = (): ElementV4Plan[] => [
  { id: "chiffre", debut: 1, fin: 3, nombre: 40 },
  { id: "chiffre", debut: 5, fin: 7, nombre: 12 },
  { id: "mots", debut: 8, fin: 10, mots: ["vite", "bien"], motIndex: 4 },
  { id: "bulles", debut: 12, fin: 14 },
];
const plan = (): PlanFacecamAnimee => ({ ...planValide(), elementsV4: elements() });
const noms = (p: PlanFacecamAnimee) => nommerPlaquettes(p.elementsV4 ?? []).map((n) => n.uid);

describe("S-15-b1 : appliquer les opérations de plaquettes", () => {
  it("le plan de test est valide", () => {
    expect(schemaPlanFacecamAnimee.safeParse(plan()).success).toBe(true);
  });

  it("(a) retirer / changer-texte / décaler : l'élément visé change, les autres sont les mêmes objets, plan valide", () => {
    const p = plan();
    const [u0, , u2] = noms(p);
    const r = appliquerOperationsPlaquettes(p, [{ type: "retirer", uid: u0 }]);
    expect(r.appliquees).toBe(1);
    expect(r.plan.elementsV4).toHaveLength(3);
    expect(r.plan.elementsV4![0]).toBe(p.elementsV4![1]);
    expect(r.plan.elementsV4![2]).toBe(p.elementsV4![3]);
    expect(schemaPlanFacecamAnimee.safeParse(r.plan).success).toBe(true);

    const t = appliquerOperationsPlaquettes(p, [{ type: "changer-texte", uid: u2, mots: ["lent", "mieux"] }]);
    const attenduT = changerTextePlaquette(p.elementsV4!, u2, ["lent", "mieux"]);
    expect(attenduT.ok && t.plan.elementsV4).toEqual(attenduT.ok && attenduT.elements);
    expect(t.plan.elementsV4![2].mots).toEqual(["lent", "mieux"]);
    expect(t.plan.elementsV4![0]).toBe(p.elementsV4![0]);
    expect(schemaPlanFacecamAnimee.safeParse(t.plan).success).toBe(true);

    const d = appliquerOperationsPlaquettes(p, [{ type: "decaler", uid: u2, decalageSec: 2 }]);
    const attenduD = decalerPlaquette(p.elementsV4!, u2, 2);
    expect(attenduD.ok && d.plan.elementsV4).toEqual(attenduD.ok && attenduD.elements);
    expect(d.plan.elementsV4![2]).toMatchObject({ debut: 10, fin: 12 });
    expect(d.plan.elementsV4![3]).toBe(p.elementsV4![3]);
    expect(schemaPlanFacecamAnimee.safeParse(d.plan).success).toBe(true);
    expect(retirerPlaquette(p.elementsV4!, u0).ok).toBe(true);
  });

  it("(b) deux opérations sur la même plaquette : l'uid d'origine est suivi ; sans la table, refus", () => {
    const p = plan();
    const u2 = noms(p)[2];
    const r = appliquerOperationsPlaquettes(p, [
      { type: "changer-texte", uid: u2, mots: ["lent", "mieux"] },
      { type: "decaler", uid: u2, decalageSec: 1.5 },
    ]);
    expect(r.appliquees).toBe(2);
    expect(r.refus).toEqual([]);
    expect(r.plan.elementsV4![2]).toMatchObject({ mots: ["lent", "mieux"], debut: 9.5, fin: 11.5 });
    // contre-épreuve : le nom a bien changé, l'ancien nom appliqué directement est refusé
    const apres = changerTextePlaquette(p.elementsV4!, u2, ["lent", "mieux"]);
    expect(apres.ok).toBe(true);
    const direct = decalerPlaquette(apres.ok ? apres.elements : [], u2, 1.5);
    expect(direct.ok).toBe(false);
    expect(!direct.ok && direct.raison).toMatch(/n'existe plus/);
  });

  it("(c) uid inconnu : raison du code, les autres opérations appliquées, compte exact", () => {
    const p = plan();
    const r = appliquerOperationsPlaquettes(p, [
      { type: "retirer", uid: "inconnu" },
      { type: "decaler", uid: noms(p)[3], decalageSec: 1 },
    ]);
    expect(r.refus).toEqual(["Cette plaquette n'existe plus dans le plan."]);
    expect(r.appliquees).toBe(1);
    expect(r.plan.elementsV4![3]).toMatchObject({ debut: 13, fin: 15 });
  });

  it("(c) refus d'une opération hors règle (texte sans mots, décalage nul) : raison du code", () => {
    const p = plan();
    const r = appliquerOperationsPlaquettes(p, [
      { type: "changer-texte", uid: noms(p)[0], mots: ["a"] },
      { type: "decaler", uid: noms(p)[1], decalageSec: 0 },
    ]);
    expect(r.appliquees).toBe(0);
    expect(r.refus).toHaveLength(2);
    expect(r.refus[0]).toBe("Cette plaquette n'a pas de texte à changer.");
  });

  it("(d) liste vide et plan sans elementsV4 : plan identique", () => {
    const p = plan();
    const vide = appliquerOperationsPlaquettes(p, []);
    expect(JSON.stringify(vide.plan)).toBe(JSON.stringify(p));
    expect(vide).toMatchObject({ appliquees: 0, refus: [] });
    expect(vide.plan).toBe(p);
    const sans = planValide();
    const r = appliquerOperationsPlaquettes(sans, [{ type: "retirer", uid: "x" }]);
    expect(JSON.stringify(r.plan)).toBe(JSON.stringify(sans));
    expect(r.appliquees).toBe(0);
    expect(r.refus).toHaveLength(1);
  });

  it("(d) plan rendu invalide au schéma : plan d'origine, refus « pas possible pour cette vidéo »", () => {
    const p = { ...plan(), duree: -1 } as PlanFacecamAnimee;
    const r = appliquerOperationsPlaquettes(p, [{ type: "retirer", uid: noms(p)[0] }]);
    expect(r.plan).toBe(p);
    expect(r.appliquees).toBe(0);
    expect(r.refus).toContain("Ce changement n'est pas possible pour cette vidéo.");
  });

  it("(e) lecture stricte", () => {
    const ok = [{ type: "retirer", uid: "a" }, { type: "changer-texte", uid: "b", mots: ["x"] }, { type: "decaler", uid: "c", decalageSec: -2 }];
    const l = lireOperationsPlaquettes(ok);
    expect(l.operations).toEqual(ok);
    expect(l.remarques).toEqual([]);
    expect(lireOperationsPlaquettes(ok)).toEqual(l);
    for (const mauvais of ["x", null, undefined, {}, 3]) {
      expect(lireOperationsPlaquettes(mauvais)).toEqual({ operations: [], remarques: ["Une demande sur les plaquettes n'a pas été comprise."] });
    }
    expect(lireOperationsPlaquettes([{ type: "inconnu", uid: "a" }]).remarques).toEqual(["Une demande sur les plaquettes n'a pas été comprise."]);
    expect(lireOperationsPlaquettes([{ type: "retirer", uid: "a", en: "trop" }]).operations).toEqual([]);
    expect(lireOperationsPlaquettes([{ type: "decaler", uid: "a", decalageSec: Number.NaN }]).operations).toEqual([]);
    const v = lireOperationsPlaquettes([{ type: "choisir-variante", uid: "a", variante: "x" }]);
    expect(v.operations).toEqual([]);
    expect(v.remarques).toEqual(["Changer l'animation d'une plaquette n'est pas encore possible."]);
    const treize = Array.from({ length: 13 }, (_, i) => ({ type: "retirer", uid: `u${i}` }));
    expect(lireOperationsPlaquettes(treize).operations).toHaveLength(12);
    expect(lireOperationsPlaquettes(treize).remarques).toHaveLength(1);
    expect(lireOperationsPlaquettes(treize.slice(0, 12)).remarques).toEqual([]);
  });

  it("(f) prise, coupes, voix, cadrage intacts ; coupes de la reprise identiques", () => {
    const demande = { videoId: "v1", versionId: "ver1", priseCle: "prises/brute.mp4", titre: "T" };
    const PAROLES = "Bonjour à tous aujourd'hui je vous montre comment gagner du temps chaque semaine avec Action IA sur vos vidéos courtes pour vos clients".split(" ");
    const mots = PAROLES.map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(2), finSec: +(i * 0.4 + 0.3).toFixed(2) }));
    const transcription = { mots, dureeSec: +(PAROLES.length * 0.4 + 1).toFixed(2), largeur: 1920, hauteur: 1080 };
    const coupes = couperPriseV4({ mots, dureeSec: transcription.dureeSec });
    const p = plan();
    const etat = {
      version: VERSION_CHAINE_V4, etape: "prete", demande, transcription,
      cadrage: { x: 656, largeur: 608, hauteur: 1080, visage: true, centreX: 0.5 }, coupes,
      realisation: { version: "complete", essais: 2, avertissements: 1, plan: p }, videos: { fichiers: [], retirees: [], manques: [] },
      planScenes: { entree: "e", remarques: ["r"], plan: null },
      rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: coupes.dureeSec, taille: 10 },
    } as unknown as EtatChaineV4;
    const projet = lireProjetGardeV4(projetMontageV4(etat))!;
    const r = appliquerOperationsPlaquettes(projet.plan, [{ type: "retirer", uid: noms(projet.plan)[0] }]);
    expect(r.appliquees).toBe(1);
    const modifie = { ...projet, plan: r.plan };
    for (const champ of ["transcription", "gardes", "cadrage", "planScenes"] as const) expect(JSON.stringify(modifie[champ])).toBe(JSON.stringify(projet[champ]));
    expect(JSON.stringify({ ...r.plan, elementsV4: undefined, })).toBe(JSON.stringify({ ...projet.plan, elementsV4: undefined }));
    const avant = etatRepriseAuRenduV4(projet, demande)!;
    const apres = etatRepriseAuRenduV4(modifie, demande)!;
    expect(avant).not.toBeNull();
    expect(apres.coupes).toEqual(avant.coupes);
  });

  it("(g) sans importeur, pièce pure", () => {
    const racine = process.cwd();
    const trouves: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (statSync(c).isDirectory()) marche(c);
        else if (/\.(ts|tsx)$/.test(f) && f !== "appliquer-plaquettes.ts" && /appliquer-plaquettes/.test(readFileSync(c, "utf8"))) trouves.push(c.slice(racine.length + 1).split("\\").join("/"));
      }
    };
    marche(join(racine, "src"));
    expect(trouves.filter((t) => t !== "src/services/retouche-chat/plaquettes-fa.ts")).toEqual([]);
    const texte = readFileSync(join(racine, "src/domaine/facecam-animee/appliquer-plaquettes.ts"), "utf8");
    const imports = [...texte.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./noms-plaquettes", "./operations-plaquettes", "./plan", "zod"]);
    expect(texte).not.toMatch(/@\/moteurs|@\/services|studio-rendu|VideoAnimeeV4|briques-v4|registre-v4|motion-v4/);
    expect(texte.split("\n").length).toBeLessThanOrEqual(110);
  });

  it("(h) ne lève jamais, n'altère rien", () => {
    const p = plan();
    const copie = JSON.stringify(p);
    const u = noms(p)[0];
    expect(() => appliquerOperationsPlaquettes(null as unknown as PlanFacecamAnimee, [])).not.toThrow();
    expect(() => appliquerOperationsPlaquettes(p, undefined as never)).not.toThrow();
    expect(() => appliquerOperationsPlaquettes(p, [{ type: "decaler", uid: u, decalageSec: Number.NaN }])).not.toThrow();
    expect(() => appliquerOperationsPlaquettes(p, [null as never])).not.toThrow();
    const nan = appliquerOperationsPlaquettes(p, [{ type: "decaler", uid: u, decalageSec: Number.NaN }]);
    expect(nan.appliquees).toBe(0);
    appliquerOperationsPlaquettes(p, [{ type: "retirer", uid: u }, { type: "decaler", uid: noms(p)[2], decalageSec: 3 }]);
    expect(JSON.stringify(p)).toBe(copie);
    expect(listerPlaquettes(null as unknown as PlanFacecamAnimee)).toEqual([]);
  });

  it("listerPlaquettes : nom, type, instants, mots", () => {
    const p = plan();
    const l = listerPlaquettes(p);
    expect(l.map((x) => x.uid)).toEqual(noms(p));
    expect(l[2]).toEqual({ uid: noms(p)[2], type: "mots", debut: 8, fin: 10, mots: ["vite", "bien"] });
    expect(l[0]).not.toHaveProperty("mots");
    expect(listerPlaquettes(planValide())).toEqual([]);
  });
});
