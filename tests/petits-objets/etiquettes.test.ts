/** C9-11 — pastille à icône, étiquette, badge, tampon (liste fermée de textes). Pièces pures, non inscrites. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEF_PASTILLE_ICONE, DEF_ETIQUETTE_ICONE, DEF_BADGE, DEF_TAMPON, EXEMPLES_ETIQUETTES, TEXTES_ETIQUETTES } from "../../src/briques/motion/petits-objets/etiquettes";
import { verifierDefinition, MOTS_MAX, type DefinitionObjet, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE, autoriserTexte } from "../../src/briques/charte/axion-2026";
import { couleursSur } from "../../src/briques/jetons-motion";
import { couleurDuTon } from "../../src/briques/motion/petits-objets/tons";
import { IMAGES_SORTIE } from "../../src/briques/motion/petits-objets/progres";

/** POLICES-P2-b : la pile entière de la charte, telle que la rend `renderToStaticMarkup` (plus forte que l'ancien nom seul). */
const PILE_ATTENDUE = 'font-family="&quot;Axion Manrope&quot;, &quot;Manrope&quot;, sans-serif"';

const CHEMIN = new URL("../../src/briques/motion/petits-objets/etiquettes.tsx", import.meta.url);
const DEFS = [DEF_PASTILLE_ICONE, DEF_ETIQUETTE_ICONE, DEF_BADGE, DEF_TAMPON] as unknown as DefinitionObjet<unknown>[];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 60;
const rendre = (def: DefinitionObjet<unknown>, p: unknown, image: number, ton?: TonObjet, fond: "ivoire" | "noir" = "noir", graine = 7) =>
  renderToStaticMarkup(def.Rendu({ image, fps: 25, dureeImages: D, fond, ton, graine, parametres: p }));
const ENTREES = new Map<DefinitionObjet<unknown>, unknown>([
  [DEFS[0], { texte: "Abonne-toi", role: "personne" }],
  [DEFS[1], { texte: "Scénario", role: "lien" }],
  [DEFS[2], { texte: "Nouveau", role: "pouce" }],
  [DEFS[3], { texte: "Nouveau" }],
]);
const entree = (d: DefinitionObjet<unknown>) => ENTREES.get(d);

const MOTIFS: RegExp[] = [/@\//, /\bzod\b/, /Math\.random/, /remotion/, /from\s+["'][^"']*moteurs\//, /from\s+["'][^"']*-v4/, /VideoAnimeeV4/, /briques-v4/, /faits-script/, /from\s+["'][^"']*\/droits/, /bibliotheque-video/, /src\/domaine|from\s+["'][^"']*\/domaine\//, /from\s+["'][^"']*\/services\//];

describe("C9-11 contrat", () => {
  it("4 objets, ids propres, verifierDefinition ok", () => {
    expect(DEFS.map((d) => d.id)).toEqual(["objet-pastille-icone", "objet-etiquette-icone", "objet-badge", "objet-tampon"]);
    for (const d of DEFS) {
      expect(verifierDefinition(d)).toBe("ok");
      expect(d.famille).toBe("etiquette");
      expect(d.donnees).toBe("aucune");
    }
  });
  it("valider ne lève jamais et renvoie null sur entrée mauvaise", () => {
    for (const d of DEFS) for (const m of [undefined, null, {}, 5, "un deux", { texte: "un deux trois quatre cinq" }, { texte: 3 }])
      expect(d.valider(m)).toBeNull();
  });
  it("texte hors liste → null ; 5 mots → null", () => {
    for (const d of DEFS) {
      expect(d.valider({ ...(entree(d) as object), texte: "Bonjour tout le monde" })).toBeNull();
      expect(d.valider({ ...(entree(d) as object), texte: "Un deux trois quatre cinq" })).toBeNull();
    }
  });
  it("liste fermée : figée, ≤ 4 mots", () => {
    expect(Object.isFrozen(TEXTES_ETIQUETTES)).toBe(true);
    for (const t of TEXTES_ETIQUETTES) expect(t.trim().split(/\s+/).length).toBeLessThanOrEqual(MOTS_MAX);
  });
  it("rôle d'icône inconnu ou absent de la bibliothèque → null", () => {
    for (const d of [DEF_PASTILLE_ICONE, DEF_ETIQUETTE_ICONE, DEF_BADGE] as unknown as DefinitionObjet<unknown>[])
      for (const role of ["inconnu", "globe", 3]) expect(d.valider({ ...(entree(d) as object), role })).toBeNull();
  });
  it("valide les exemples", () => {
    for (const [d, ex] of [[DEF_PASTILLE_ICONE, EXEMPLES_ETIQUETTES.pastille], [DEF_ETIQUETTE_ICONE, EXEMPLES_ETIQUETTES.etiquette], [DEF_BADGE, EXEMPLES_ETIQUETTES.badge], [DEF_TAMPON, EXEMPLES_ETIQUETTES.tampon]] as const) {
      expect(ex.length).toBeGreaterThan(0);
      for (const e of ex) expect((d as DefinitionObjet<unknown>).valider(e)).not.toBeNull();
    }
  });
});

describe("C9-11 rendu", () => {
  it("même entrée = même balisage", () => {
    for (const d of DEFS) expect(rendre(d, entree(d), 20)).toBe(rendre(d, entree(d), 20));
  });
  it("dernière image : opacité 0 ; sortie en 6 images", () => {
    for (const d of DEFS) {
      expect(rendre(d, entree(d), D - 1)).toMatch(/opacity="0"/);
      const sous = Array.from({ length: D }, (_, i) => i).filter((i) => !/opacity="1"/.test(rendre(d, entree(d), i)) && i > 10);
      expect(sous).toHaveLength(IMAGES_SORTIE);
    }
  });
  it("tracé à 0 à l'image 0 et à 1 en tenue", () => {
    for (const d of DEFS) {
      expect(rendre(d, entree(d), 0)).toContain('stroke-dashoffset="1"');
      expect(rendre(d, entree(d), 30)).toContain('stroke-dashoffset="0"');
    }
  });
  it("couleurs de la charte, orange jamais sur ivoire, aucun filtre", () => {
    const permis = new Set<string>([PALETTE.blanc, PALETTE.noir, PALETTE.ivoire, couleursSur("ivoire").texte, couleursSur("noir").texte].map((c) => c.toLowerCase()));
    for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) permis.add(couleurDuTon(ton, fond).toLowerCase());
    for (const d of DEFS) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(d, entree(d), 30, ton, fond);
      expect(m).not.toMatch(/filter|mask|drop-shadow/i);
      for (const c of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) if (c[1] !== "none") expect(permis.has(c[1].toLowerCase())).toBe(true);
      if (fond === "ivoire") expect(m.toLowerCase()).not.toContain(PALETTE.orange.toLowerCase());
    }
  });
  it("texte en Manrope (FAMILLE_CSS)", () => {
    for (const d of DEFS) expect(rendre(d, entree(d), 30)).toContain(PILE_ATTENDUE);
  });
  it("entrée invalide : rendu vide sans exception", () => {
    for (const d of DEFS) expect(() => rendre(d, null, 10)).not.toThrow();
  });
});

describe("C9-11 propres à la fiche", () => {
  it("tampon « VALIDÉ » en ton valide par défaut", () => {
    const m = rendre(DEF_TAMPON as DefinitionObjet<unknown>, { texte: "Validé" }, 30);
    expect(m).toContain("VALIDÉ");
    expect(m).toContain(`stroke="${PALETTE.reussite}"`);
  });
  it("ton valide refusé (ramené au neutre) sans texte « validé »", () => {
    for (const d of DEFS) {
      const m = rendre(d, entree(d), 30, "valide", "ivoire");
      expect(m).not.toContain(PALETTE.reussite);
    }
    expect(rendre(DEF_BADGE as DefinitionObjet<unknown>, { texte: "Validé", role: "coche" }, 30, "valide")).toContain(PALETTE.reussite);
  });
  it("jamais le texte d'une autre pièce hors liste dans le balisage", () => {
    for (const d of DEFS) expect(rendre(d, entree(d), 30)).not.toMatch(/<text[^>]*>[^<]*(facebook|instagram)/i);
  });
});

describe("C9-11 lisibilité (rendu prouvé à l'image 30)", () => {
  const CAS: [DefinitionObjet<unknown>, unknown][] = [
    ...DEFS.map((d) => [d, entree(d)] as [DefinitionObjet<unknown>, unknown]),
    [DEF_BADGE as DefinitionObjet<unknown>, { texte: "Validé", role: "coche" }],
    [DEF_BADGE as DefinitionObjet<unknown>, { texte: "Nouveau", role: "pouce" }],
    [DEF_ETIQUETTE_ICONE as DefinitionObjet<unknown>, { texte: "Validé", role: "coche" }],
    [DEF_TAMPON as DefinitionObjet<unknown>, { texte: "Validé" }],
  ];
  it("traits et icône ≠ remplissage du panneau ; chaque texte/fond ∈ PAIRES_TEXTE", () => {
    for (const [d, p] of CAS) for (const fond of ["ivoire", "noir"] as const) for (const ton of TONS) {
      const m = rendre(d, p, 30, ton, fond);
      const panneau = (/<path[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*stroke="none"/.exec(m)?.[1] ?? couleursSur(fond).fond).toLowerCase();
      const traits = [...m.matchAll(/stroke="(#[0-9A-Fa-f]{6})"/g)].map((c) => c[1].toLowerCase());
      expect(traits.length).toBeGreaterThan(0);
      for (const t of traits) expect(t, `${d.id} ${ton} ${fond}`).not.toBe(panneau);
      const textes = [...m.matchAll(/<text[^>]*fill="(#[0-9A-Fa-f]{6})"/g)].map((c) => c[1]);
      expect(textes.length).toBeGreaterThan(0);
      for (const t of textes) expect(autoriserTexte(t, panneau), `${d.id} ${ton} ${fond} ${t}/${panneau}`).toBe(true);
    }
  });
  it("badge « Nouveau » accent : icône blanche sur fond terracotta (pas de même couleur)", () => {
    const m = rendre(DEF_BADGE as DefinitionObjet<unknown>, { texte: "Nouveau", role: "pouce" }, 30, "accent", "ivoire");
    expect(m).toContain(`fill="${PALETTE.terracotta}"`);
    expect(m).toContain(`stroke="${PALETTE.blanc}"`);
  });
});

describe("C9-11 garde statique du fichier", () => {
  const texte = readFileSync(CHEMIN, "utf8");
  it("aucun motif interdit", () => { for (const re of MOTIFS) expect(re.test(texte)).toBe(false); });
  it("aucun littéral de courbe ni couleur", () => {
    expect(texte).not.toMatch(/cubic-bezier|Easing\.bezier|damping|stiffness|\bmass\b/);
    expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
  it("aucun nom de marque", () => {
    expect(texte).not.toMatch(/facebook|instagram|linkedin|youtube|tiktok|github|google/i);
  });
  it("non inscrit : rien ne l'importe", () => {
    expect(readFileSync(new URL("../../src/briques/motion/petits-objets/index.ts", import.meta.url), "utf8")).not.toMatch(/etiquettes/);
  });
});
