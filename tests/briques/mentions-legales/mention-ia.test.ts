/** X1-14 — pastille « Réalisé avec l'IA » : éteinte par défaut, pure, zone sûre (N-07), jamais devant le visage, texte unique. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DUREE_PASTILLE_IA_MS,
  TEXTE_PASTILLE_IA,
  contenuSynthetique,
  pastilleIA,
  pastilleVisible,
} from "../../../src/briques/mentions-legales/mention-ia";
import { ZONE_VISAGE, seChevauchent } from "../../../src/briques/plan-scenes/zones";
import { RATIOS_ESSAI, boiteDansZoneSure } from "@/moteurs/conformite-zone-sure";
import { listerReseaux } from "@/reseaux";

const ZONE = { haut: 6, droite: 6, bas: 12, gauche: 6 };
const SYNTH = { doubleSynthetique: true, voixSynthetique: false };
const SOURCE = readFileSync("src/briques/mentions-legales/mention-ia.ts", "utf8");

describe("pastille IA — éteinte par défaut, double/voix synthétiques", () => {
  it("réglage absent, faux ou non strictement `true` : aucune pastille", () => {
    for (const autorise of [undefined, null, false, "true", 1, "oui", {}, []]) {
      expect(pastilleIA({ entrees: SYNTH, autorise, zone: ZONE })).toBeNull();
    }
  });
  it("vidéo sans élément synthétique : aucune pastille, même allumée", () => {
    for (const entrees of [{}, null, undefined, { doubleSynthetique: false, voixSynthetique: false }, { doubleSynthetique: "true" }]) {
      expect(pastilleIA({ entrees, autorise: true, zone: ZONE })).toBeNull();
    }
  });
  it("double OU voix synthétique + allumée : pastille", () => {
    expect(pastilleIA({ entrees: { doubleSynthetique: true }, autorise: true, zone: ZONE })).not.toBeNull();
    expect(pastilleIA({ entrees: { voixSynthetique: true }, autorise: true, zone: ZONE })).not.toBeNull();
    expect(contenuSynthetique({ voixSynthetique: true })).toBe(true);
    expect(contenuSynthetique({})).toBe(false);
  });
  it("texte = constante unique, 2 s, même entrée = même sortie", () => {
    const a = pastilleIA({ entrees: SYNTH, autorise: true, zone: ZONE })!;
    expect(a.texte).toBe(TEXTE_PASTILLE_IA);
    expect(a.dureeMs).toBe(2000);
    expect(DUREE_PASTILLE_IA_MS).toBe(2000);
    expect(pastilleIA({ entrees: SYNTH, autorise: true, zone: ZONE })).toEqual(a);
  });
  it("visible 2 s seulement", () => {
    const a = pastilleIA({ entrees: SYNTH, autorise: true, zone: ZONE })!;
    expect(pastilleVisible(a, 0, 25)).toBe(true);
    expect(pastilleVisible(a, 49, 25)).toBe(true);
    expect(pastilleVisible(a, 50, 25)).toBe(false);
    expect(pastilleVisible(a, NaN, 25)).toBe(false);
    expect(pastilleVisible(a, 1, 0)).toBe(false);
  });
  it("entrées absurdes : jamais d'exception", () => {
    for (const zone of [{ haut: NaN, droite: -5, bas: 500, gauche: Infinity }, ZONE]) {
      expect(() => pastilleIA({ entrees: SYNTH, autorise: true, zone })).not.toThrow();
    }
  });
});

describe("pastille IA — jamais devant le visage, hors des boutons (N-07)", () => {
  for (const ratio of RATIOS_ESSAI) {
    for (const reseau of listerReseaux().filter((r) => r.zonesProtegees[ratio])) {
      it(`${ratio} · ${reseau.id} : dans la zone sûre, hors visage (ou rien)`, () => {
        const p = pastilleIA({ entrees: SYNTH, autorise: true, zone: reseau.zonesProtegees[ratio]! });
        if (!p) return;
        expect(seChevauchent(p.boite, ZONE_VISAGE)).toBe(false);
        const r = boiteDansZoneSure(p.boite, ratio, [reseau.id]);
        expect(r.ok, r.raison).toBe(true);
      });
    }
  }
  it("au moins un réseau affiche la pastille en 9:16 (pas toujours « rien »)", () => {
    const n = listerReseaux().filter((r) => r.zonesProtegees["9:16"] && pastilleIA({ entrees: SYNTH, autorise: true, zone: r.zonesProtegees["9:16"]! })).length;
    expect(n).toBeGreaterThan(0);
  });
});

describe("pastille IA — pièce pure, aucun interrupteur, rien ne l'appelle", () => {
  it("aucune écriture de réglage ni clé `mentions.ia` créée", () => {
    expect(SOURCE).not.toMatch(/ecrireParametre|\.enregistrer\(|localStorage|process\.env|fetch\(/);
    expect(SOURCE).not.toMatch(/["'`]mentions\.ia["'`]/);
  });
  it("imports relatifs seulement, sans `@/`", () => {
    expect(SOURCE).not.toMatch(/from "@\//);
  });
  it("aucun fichier de production n'importe la pièce ou la pastille", () => {
    const visites: string[] = [];
    const parcourir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        const c = join(d, e.name);
        if (e.isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(e.name)) visites.push(c);
      }
    };
    parcourir("src");
    parcourir("studio-rendu");
    const appelants = visites.filter((f) => !/mention-ia\.ts$|MentionIA\.tsx$/.test(f) && /from\s+["'][^"']*(?:mentions-legales\/mention-ia|petits-objets\/MentionIA)["']/.test(readFileSync(f, "utf8")));
    expect(appelants).toEqual([]);
  });
});
