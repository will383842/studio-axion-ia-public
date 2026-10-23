/**
 * FACE CAMÉRA ANIMÉE — DÉMO 15 s « v2 énergie » (`DemoV2`, 16/10) : la séquence des 8 éléments (données pures de
 * `studio-rendu/compositions/interface-claire/demo-v2/sequence-demo.ts`) passe TOUTES les règles D0 à D15 du réalisateur, sur la
 * transcription fictive de la démo. Un élément qu'on y change et qui viole une règle fait échouer ce test. Aucun rendu ici.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ficheV2 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v2";
import { controlerSuiteV2, resoudreElementsV2 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v2";
import {
  DUREE_DEMO_SEC, ETAPES_LOSANGE_DEMO, FPS_DEMO, HAUTEUR_DEMO, LARGEUR_DEMO, SEQUENCE_DEMO, TRANSCRIPTION_DEMO,
} from "../../studio-rendu/compositions/interface-claire/demo-v2/sequence-demo";

const resolu = () => resoudreElementsV2(SEQUENCE_DEMO.map((e) => ({ id: e.id, debut: e.debut, fin: e.fin, ...(e.mots ? { mots: e.mots } : {}) })), DUREE_DEMO_SEC);
const controle = () => controlerSuiteV2(resolu().elements, { duree: DUREE_DEMO_SEC, finDebut: Infinity }, TRANSCRIPTION_DEMO);

describe("démo 15 s · la séquence respecte les règles de diversité v2", () => {
  it("540 × 960, 30 i/s, 15 s ; 8 éléments tous ACTIFS, de 4 lots différents", () => {
    expect([LARGEUR_DEMO, HAUTEUR_DEMO, FPS_DEMO, DUREE_DEMO_SEC]).toEqual([540, 960, 30, 15]);
    expect(SEQUENCE_DEMO).toHaveLength(8);
    const fiches = SEQUENCE_DEMO.map((e) => ficheV2(e.id)!);
    expect(fiches.every((f) => f?.actif)).toBe(true);
    expect(new Set(fiches.map((f) => f.id)).size).toBe(8);
    expect(new Set(fiches.map((f) => f.lot)).size).toBeGreaterThanOrEqual(4);
  });

  it("D0 : chaque élément existe, est actif, a la durée de sa fiche et tient dans les 15 s", () => {
    expect(resolu().erreurs).toEqual([]);
    expect(SEQUENCE_DEMO.at(-1)!.fin).toBeLessThanOrEqual(DUREE_DEMO_SEC);
  });

  it("aucune erreur D1 à D15 (emplacements tournants, jamais le même deux fois de suite, coup de poing à 10-12 s…)", () => {
    const r = controle();
    expect(r.erreurs, r.erreurs.join("\n")).toEqual([]);
  });

  it("emplacements tournants : aucun emplacement, forme, mouvement, sortie ni sens d'inclinaison deux fois de suite", () => {
    const f = resolu().elements.map((e) => e.fiche);
    const empl = f.map((x) => x.emplacement);
    for (let k = 1; k < f.length; k++) {
      expect(f[k].emplacement, `${f[k - 1].id} → ${f[k].id}`).not.toBe(f[k - 1].emplacement);
      expect(f[k].forme).not.toBe(f[k - 1].forme);
      expect(f[k].mouvement).not.toBe(f[k - 1].mouvement);
      expect(f[k].sortie).not.toBe(f[k - 1].sortie);
    }
    expect(new Set(empl).size).toBeGreaterThanOrEqual(6);
    expect(empl.filter((x) => x === "E2" || x === "E3").length).toBeGreaterThanOrEqual(3);
  });

  it("ouverture : visage visible, premier élément à 1,2 s ; un seul coup de poing (tampon-déchirure) à 10,7 s ; Will seul 1 s après", () => {
    const els = resolu().elements;
    expect(els[0].debut).toBeGreaterThanOrEqual(0.8);
    expect(els[0].debut).toBeLessThanOrEqual(2);
    expect(els.filter((e) => e.fiche.couvreVisage).map((e) => [e.fiche.id, e.debut])).toEqual([["tampon-dechirure", 10.7]]);
    expect(els.filter((e) => e.fiche.couvreVisage).every((e) => e.debut >= 10)).toBe(true);
    const i = els.findIndex((e) => e.fiche.couvreVisage);
    expect(els[i + 1].debut - els[i].fin).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it("aucun chiffre ni mot non dit : tout ce que la démo affiche est dans la transcription fictive", () => {
    const dits = TRANSCRIPTION_DEMO.map((m) => m.w.toLowerCase());
    expect(dits).toContain("trois");
    const affiche = SEQUENCE_DEMO.flatMap((e) => e.mots ?? []).join(" ");
    expect(affiche).not.toMatch(/villeexemple/i);
    expect(affiche.match(/\d+/g)).toEqual(["3"]);
    expect(ETAPES_LOSANGE_DEMO.map((e) => e.a)).toEqual([5.3, 6.1, 6.8]);
  });

  it("composition : la démo est enregistrée dans Compositions.tsx, importe React, et l'image de fond est bien là (1080 × 1920)", () => {
    const dossier = join(process.cwd(), "studio-rendu/compositions/interface-claire");
    const comp = readFileSync(join(dossier, "Compositions.tsx"), "utf8");
    expect(comp).toContain('demoV2: "InterfaceClaireDemoV2"');
    expect(comp).toMatch(/<Composition id=\{COMPOSITIONS_INTERFACE_CLAIRE\.demoV2\}/);
    for (const f of ["demo-v2/DemoV2.tsx", "Compositions.tsx"]) expect(readFileSync(join(dossier, f), "utf8"), f).toMatch(/^\s*import React\b/m);
    const png = join(dossier, "demo-v2/prise-commune-1080x1920.png");
    expect(existsSync(png)).toBe(true);
    const tete = readFileSync(png).subarray(16, 24);
    expect([tete.readUInt32BE(0), tete.readUInt32BE(4)]).toEqual([1080, 1920]);
    // C'est la même image que celle des documents.
    expect(readFileSync(png).equals(readFileSync(join(process.cwd(), "docs/facecam-animee-v2/prise-commune-1080x1920.png")))).toBe(true);
  });

  it("la composition ne bouge jamais la prise : ni zoom, ni translation, ni rotation sur l'image de fond", () => {
    const src = readFileSync(join(process.cwd(), "studio-rendu/compositions/interface-claire/demo-v2/DemoV2.tsx"), "utf8");
    // Le seul `transform` est la réduction de moitié de la scène de travail (1080 × 1920 → 540 × 960), fixe.
    expect(src.match(/transform:/g)).toHaveLength(1);
    expect(src).toContain('transform: "scale(0.5)"');
    expect(src).not.toMatch(/interpolate|spring|useCurrentFrame\(\)\s*\*[^;]*scale/);
    // Aucune musique : le seul fichier servi par `staticFile` est un bruitage du dossier `sons/`.
    const servis = [...src.matchAll(/staticFile\(([^)]*)\)/g)].map((m) => m[1]);
    expect(servis.length).toBeGreaterThan(0);
    expect(servis.every((x) => x.includes("sons/"))).toBe(true);
  });
});
