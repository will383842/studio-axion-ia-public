/** C9-12a — appel à l'action neutre (« Abonne-toi », « Lien en bio »). Pièce pure, non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION, TEXTES_APPEL_ACTION } from "../../src/briques/motion/petits-objets/appel-action";
import { verifierDefinition, MOTS_MAX, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { couleursSur } from "../../src/briques/jetons-motion";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";

/** POLICES-P2-b : la pile entière de la charte, telle que la rend `renderToStaticMarkup` (plus forte que l'ancien nom seul). */
const PILE_ATTENDUE = 'font-family="&quot;Axion Manrope&quot;, &quot;Manrope&quot;, sans-serif"';

const CHEMIN = new URL("../../src/briques/motion/petits-objets/appel-action.tsx", import.meta.url);
const DEF = DEF_APPEL_ACTION as unknown as DefinitionObjet<unknown>;
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (p: unknown, image: number, ton?: TonObjet, fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-12a contrat", () => {
  it("verifierDefinition ok, id et capacité", () => {
    expect(DEF.id).toBe("objet-appel-action");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.capacite).toBe("objet.appel");
    expect(DEF.donnees).toBe("aucune");
  });
  it("liste fermée figée de deux textes, ≤ 4 mots", () => {
    expect([...TEXTES_APPEL_ACTION]).toEqual(["Abonne-toi", "Lien en bio"]);
    expect(Object.isFrozen(TEXTES_APPEL_ACTION)).toBe(true);
    for (const t of TEXTES_APPEL_ACTION) expect(t.split(/\s+/).length).toBeLessThanOrEqual(MOTS_MAX);
  });
  it("valider refuse Tape/Commente MOT, texte libre, URL, undefined", () => {
    for (const m of [undefined, null, {}, 5, "Abonne-toi", { texte: "Tape MOT" }, { texte: "Commente MOT" }, { texte: "Bonjour" }, { texte: "https://exemple.fr" }, { texte: "www.exemple.fr/bio" }, { texte: undefined }, { texte: 3 }])
      expect(DEF.valider(m)).toBeNull();
  });
  it("valider accepte la liste (casse indifférente) et refuse un rôle inconnu ou sans icône", () => {
    expect(DEF.valider({ texte: "abonne-toi" })).toEqual({ texte: "Abonne-toi" });
    expect(DEF.valider({ texte: "Lien en bio", role: "lien" })).toEqual({ texte: "Lien en bio", role: "lien" });
    for (const role of ["inconnu", "ajout-personne", 3]) expect(DEF.valider({ texte: "Abonne-toi", role })).toBeNull();
  });
  it("valide les exemples", () => {
    expect(EXEMPLES_APPEL_ACTION.length).toBeGreaterThan(0);
    for (const e of EXEMPLES_APPEL_ACTION) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-12a rendu", () => {
  const P = { texte: "Abonne-toi", role: "cloche" };
  it("même graine = même balisage", () => { expect(rendre(P, 20)).toBe(rendre(P, 20)); });
  it("dernière image : opacité 0 ; sortie en 6 images", () => {
    expect(rendre(P, D - 1)).toMatch(/opacity="0"/);
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(P, i)) && i > 10);
    expect(sous).toHaveLength(IMAGES_SORTIE);
  });
  it("tracé à 0 à l'image 0 et à 1 en tenue", () => {
    expect(rendre(P, 0)).toContain('stroke-dashoffset="1"');
    expect(rendre(P, 30)).toContain('stroke-dashoffset="0"');
  });
  it("couleurs ∈ sorties de couleurDuTon / charte, aucun filtre, aucun nom de réseau", () => {
    const permis = new Set<string>([PALETTE.blanc, PALETTE.noir, PALETTE.ivoire, couleursSur("ivoire").texte, couleursSur("noir").texte].map((c) => c.toLowerCase()));
    for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) permis.add(couleurDuTon(ton, fond).toLowerCase());
    for (const texte of TEXTES_APPEL_ACTION) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre({ texte, role: "lien" }, 30, ton, fond);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      expect(m).not.toMatch(/TikTok|Instagram|YouTube|LinkedIn|Facebook/i);
      for (const c of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) if (c[1] !== "none") expect(permis.has(c[1].toLowerCase())).toBe(true);
    }
  });
  it("texte en Manrope", () => { expect(rendre(P, 30)).toContain(PILE_ATTENDUE); });
  it("entrée invalide : rendu vide sans exception", () => { expect(() => rendre(null, 10)).not.toThrow(); });
});

describe("C9-12a garde statique", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur, aucun nom de réseau", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(texte).not.toMatch(/facebook|instagram|linkedin|youtube|tiktok|github|google/i);
  });
  it("non inscrit : rien ne l'importe", () => {
    expect(readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8")).not.toMatch(/appel-action/);
  });
});
