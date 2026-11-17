/**
 * FIX-SOUS-TITRES-TABLEAU, lot C (17/11/2026, bouton « oui » de Williams) : UN SEUL style de sous-titres du début à la fin
 * dans les vidéos du tableau (mots colorés sur bande noire ; plus d'Impact, plus de Bandeau en MAJUSCULES sur cartouche).
 * Le défaut de la fabrication est la constante `INTENSITE_SOUS_TITRES_TABLEAU` (« sobre »). Les AUTRES générateurs
 * (avocat, face caméra, cas concret, image vers vidéo) ne lisent pas cette constante : leur intensité est inchangée.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTENSITES } from "../../../src/briques/sous-titres/melange";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { IDS_FORMATS_SORTIE } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { INTENSITE_SOUS_TITRES_TABLEAU, tientDansLaBande } from "../../../src/moteurs/montage-tableau/sous-titres-tableau";
import { sortieV6616 } from "../sous-titres-dynamiques/chaine";

const LONG = 60_000;

describe("la constante et sa lecture", () => {
  it("est « sobre » : aucun Impact, aucun Bandeau dans le réglage", () => {
    expect(INTENSITE_SOUS_TITRES_TABLEAU).toBe("sobre");
    expect(INTENSITES[INTENSITE_SOUS_TITRES_TABLEAU].impactEcartSec).toBeNull();
    expect(INTENSITES[INTENSITE_SOUS_TITRES_TABLEAU].bandeauToutesLesSec).toBeNull();
  });
  it("la ligne de l'intensité de fabriquer.ts lit la constante (lecture texte)", () => {
    const t = readFileSync("src/moteurs/montage-tableau/fabriquer.ts", "utf8");
    expect(t).toMatch(/const intensiteST: IntensiteSousTitres = o\.intensiteSousTitres \?\? INTENSITE_SOUS_TITRES_TABLEAU;/);
    expect(t).not.toMatch(/o\.intensiteSousTitres \?\? "equilibre"/);
  });
  it("le mélange reste disponible : « équilibré » et « très dynamique » existent toujours", () => {
    expect(INTENSITES.equilibre.impactEcartSec).toBe(6);
    expect(INTENSITES.equilibre.bandeauToutesLesSec).toBe(15);
    expect(INTENSITES["tres-dynamique"].impactEcartSec).toBe(4);
  });
});

describe("par la chaîne de la fabrication : 3 fonds × 4 formats", () => {
  for (const fond of STYLES_TABLEAU)
    for (const format of IDS_FORMATS_SORTIE)
      it(`${fond} · ${format} : un seul style, chiffres mis en valeur, tout dans la bande`, { timeout: LONG }, () => {
        const r = sortieV6616(fond, format, { intensite: INTENSITE_SOUS_TITRES_TABLEAU });
        const segs = r.calque.segments;
        expect(segs.length).toBeGreaterThan(3);
        expect(segs.filter((s) => s.style === "impact" || s.style === "bandeau").map((s) => s.id)).toEqual([]);
        for (const s of segs) {
          const texte = s.mots.map((m) => m.mot).join(" ");
          // Aucune majuscule forcée : un groupe n'est pas tout en capitales (hors sigle d'un seul mot).
          if (s.mots.length > 1 && /[a-zà-ÿ]/i.test(texte)) expect(texte, `« ${texte} » en majuscules`).not.toBe(texte.toLocaleUpperCase("fr-FR"));
          expect(s.position).toBe("auto");
        }
        // Les chiffres dits restent mis en valeur.
        const enValeur = segs.filter((s) => s.mots.some((m) => m.enValeur));
        for (const motif of [/\btrois\b/i, /\bdix\b/i]) expect(enValeur.some((s) => motif.test(s.mots.map((m) => m.mot).join(" "))), `${motif} pas en valeur`).toBe(true);
        // Tout dans la bande (réservée aux sous-titres) ; la bande noire de fond existe sur les fonds clairs (tableau blanc, paperboard).
        for (const s of segs) expect(tientDansLaBande(r.calque, s, r.bande), `« ${s.id} » hors de la bande`).toBe(true);
        if (fond !== "ardoise") expect(r.calque.bandeFond).toBeTruthy();
      });
});

describe("autres générateurs inchangés", () => {
  const racine = "src/moteurs";
  const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : n.endsWith(".ts") || n.endsWith(".tsx") ? [join(d, n)] : []));
  it("`INTENSITE_SOUS_TITRES_TABLEAU` n'est lue que dans montage-tableau", () => {
    const lecteurs = [...fichiers("src"), ...fichiers("studio-rendu")].filter((f) => readFileSync(f, "utf8").includes("INTENSITE_SOUS_TITRES_TABLEAU"));
    for (const f of lecteurs) expect(f.startsWith(join(racine, "montage-tableau")), f).toBe(true);
    expect(lecteurs.length).toBeGreaterThan(0);
  });
  it("le mélange central garde « équilibré » comme repli (avocat, face caméra, cas concret, image vers vidéo)", () => {
    const t = readFileSync("src/briques/sous-titres/melange.ts", "utf8");
    expect(t).toContain("INTENSITES[ctx.intensite] ?? INTENSITES.equilibre");
  });
});
