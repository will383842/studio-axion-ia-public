/** C9-12b — appel à l'action « Tape MOT » / « Commente MOT ». Pièce pure, non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_APPEL_MOT, EXEMPLES_APPEL_MOT, VERBES_APPEL_MOT } from "../../src/briques/motion/petits-objets/appel-mot";
import { verifierDefinition, MOTS_MAX, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { couleursSur } from "../../src/briques/jetons-motion";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";
import { garderObjet } from "../../src/briques/plan-scenes-objets/garde";

/** POLICES-P2-b : la pile entière de la charte, telle que la rend `renderToStaticMarkup` (plus forte que l'ancien nom seul). */
const PILE_ATTENDUE = 'font-family="&quot;Axion Manrope&quot;, &quot;Manrope&quot;, sans-serif"';

const CHEMIN = new URL("../../src/briques/motion/petits-objets/appel-mot.tsx", import.meta.url);
const DEF = DEF_APPEL_MOT as unknown as DefinitionObjet<unknown>;
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (p: unknown, image: number, ton?: TonObjet, fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-12b contrat", () => {
  it("verifierDefinition ok, id, capacité, données, durée", () => {
    expect(DEF.id).toBe("objet-appel-mot");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.capacite).toBe("objet.appel");
    expect(DEF.famille).toBe("etiquette");
    expect(DEF.donnees).toBe("mots-dits");
    expect(DEF.dureeSec.min).toBeGreaterThanOrEqual(0.4);
    expect(DEF.dureeSec.max).toBeLessThanOrEqual(4);
  });
  it("verbes figés, ≤ 4 mots en tout", () => {
    expect([...VERBES_APPEL_MOT]).toEqual(["Tape", "Commente"]);
    expect(Object.isFrozen(VERBES_APPEL_MOT)).toBe(true);
    expect(2).toBeLessThanOrEqual(MOTS_MAX);
  });
  it("valider refuse verbe hors liste, mots invalides, réseaux, types faux, sans exception", () => {
    const refus: unknown[] = [undefined, null, 42, "texte", {}, { verbe: "Tape" }, { mot: "guide" },
      { verbe: "Abonne-toi", mot: "guide" }, { verbe: "Écris", mot: "guide" }, { verbe: 3, mot: "guide" },
      { verbe: "Tape", mot: "" }, { verbe: "Tape", mot: "deux mots" }, { verbe: "Tape", mot: "a" }, { verbe: "Tape", mot: "a".repeat(17) },
      { verbe: "Tape", mot: "www.site.fr" }, { verbe: "Tape", mot: "https://x" }, { verbe: "Tape", mot: "@axion" }, { verbe: "Tape", mot: "#ia" },
      { verbe: "Tape", mot: "TikTok" }, { verbe: "Tape", mot: "instagram" }, { verbe: "Tape", mot: "Twitter" }, { verbe: "Tape", mot: 42 }, { verbe: "Tape", mot: undefined },
      { verbe: "Tape", mot: "guide", role: "inconnu" }, { verbe: "Tape", mot: "guide", role: 3 }];
    for (const m of refus) expect(() => DEF.valider(m)).not.toThrow();
    for (const m of refus) expect(DEF.valider(m)).toBeNull();
  });
  it("valider accepte et normalise", () => {
    expect(DEF.valider({ verbe: "tape", mot: "guide" })).toEqual({ verbe: "Tape", mot: "GUIDE" });
    expect(DEF.valider({ verbe: "COMMENTE", mot: "Devis2027" })).toEqual({ verbe: "Commente", mot: "DEVIS2027" });
    expect(DEF.valider({ verbe: "Tape", mot: "ÉTÉ" })).toEqual({ verbe: "Tape", mot: "ÉTÉ" });
    expect(DEF.valider({ verbe: "Tape", mot: "IA", role: "pouce" })).toEqual({ verbe: "Tape", mot: "IA", role: "pouce" });
  });
  it("valide les exemples", () => {
    expect(EXEMPLES_APPEL_MOT).toHaveLength(3);
    for (const e of EXEMPLES_APPEL_MOT) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-12b rendu", () => {
  const P = { verbe: "Commente", mot: "GUIDE", role: "pouce" };
  it("verbe canonique et mot en capitales, sans lien ni image", () => {
    const m = rendre(P, 30);
    expect(m).toContain("Commente");
    expect(m).toContain("GUIDE");
    expect(m).not.toMatch(/<image|href=|url\(/);
  });
  it("même graine = même balisage", () => { expect(rendre(P, 20)).toBe(rendre(P, 20)); });
  it("dernière image : opacité 0 ; sortie en 6 images", () => {
    expect(rendre(P, D - 1)).toMatch(/opacity="0"/);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(P, i)) && i > 10);
    expect(sous).toHaveLength(IMAGES_SORTIE);
  });
  it("couleurs ∈ sorties de couleurDuTon / charte, aucun filtre, aucun nom de réseau", () => {
    const permis = new Set<string>([PALETTE.blanc, PALETTE.noir, PALETTE.ivoire, couleursSur("ivoire").texte, couleursSur("noir").texte].map((c) => c.toLowerCase()));
    for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) permis.add(couleurDuTon(ton, fond).toLowerCase());
    for (const e of EXEMPLES_APPEL_MOT) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(e, 30, ton, fond);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).not.toMatch(/TikTok|Instagram|YouTube|LinkedIn|Facebook/i);
      for (const c of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) if (c[1] !== "none") expect(permis.has(c[1].toLowerCase())).toBe(true);
    }
  });
  it("Manrope : verbe en 500, mot en 800", () => {
    const m = rendre(P, 30);
    expect(m).toContain(PILE_ATTENDUE);
    expect(m).toMatch(/font-weight="500"[^>]*>Commente</);
    expect(m).toMatch(/font-weight="800"[^>]*>GUIDE</);
  });
  it("pilule ≤ 60 % du cadre, même au pire cas", () => {
    for (const p of [{ verbe: "Commente", mot: "ABCDEFGHIJKLMNOP", role: "pouce" }, ...EXEMPLES_APPEL_MOT]) {
      const d = /<path d="M ([\d.]+) [\d.]+ L ([\d.]+) /.exec(rendre(p, 30));
      expect(d).not.toBeNull();
      expect(Number(d![2]) - Number(d![1]) + 128).toBeLessThanOrEqual(600.5);
    }
  });
  it("entrée invalide : rendu vide sans exception", () => {
    expect(() => rendre(null, 10)).not.toThrow();
    expect(rendre(null, 10)).not.toContain("<text");
  });
});

describe("C9-12b honnêteté (garde C9-04, lecture seule)", () => {
  const mots = (t: string) => t.split(" ").map((x, i) => ({ texte: x, debutMs: i * 300, finMs: i * 300 + 250 }));
  const ctx = (t: string) => { const m = mots(t); return { mots: m, premier: 0, dernier: m.length - 1 }; };
  it("ok si la plage dit « commente guide »", () => {
    expect(garderObjet(DEF, { verbe: "Commente", mot: "GUIDE" }, ctx("commente guide"))).toBe("ok");
  });
  it("refus « mots non dits » si la plage dit seulement « abonnez-vous »", () => {
    expect(garderObjet(DEF, { verbe: "Commente", mot: "GUIDE" }, ctx("abonnez-vous"))).toEqual({ refus: "mots non dits" });
  });
});

describe("C9-12b garde statique", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur, aucun nom de réseau, aucun filtre", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(texte).not.toMatch(/facebook|instagram|linkedin|youtube|tiktok|github|google/i);
    expect(texte).not.toMatch(/filter|drop-shadow/);
  });
  it("non inscrit : rien ne l'importe", () => {
    expect(readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8")).not.toMatch(/appel-mot/);
  });
});
