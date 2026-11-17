/** C9-19 — terminal sombre, commande tapée lettre par lettre, curseur : pièce pure non inscrite. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXEMPLES_TERMINAL_COMMANDE, OBJET_TERMINAL_COMMANDE, type ParametresTerminalCommande } from "../../src/briques/motion/petits-objets/terminal-commande";
import { SURFACE_MAX, verifierDefinition, type TonObjet } from "../../src/briques/motion/petits-objets/contrat";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import type { FondAxion } from "../../src/briques/jetons-motion";

const DEF = OBJET_TERMINAL_COMMANDE;
const P: ParametresTerminalCommande = { commande: "npm run build", largeur: 60, hauteur: 40 };
const FONDS: FondAxion[] = ["ivoire", "noir"];
const TONS: TonObjet[] = ["neutre", "accent", "valide", "erreur"];
const D = 100;

function rendre(image: number, o: { fond?: FondAxion; p?: ParametresTerminalCommande; ton?: TonObjet } = {}) {
  return renderToStaticMarkup(DEF.Rendu({ image, fps: 25, dureeImages: D, fond: o.fond ?? "ivoire", parametres: o.p ?? P, ton: o.ton ?? "neutre", graine: 7 }));
}
const decalages = (m: string) => [...m.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((x) => Number(x[1]));
const opaciteGroupe = (m: string) => Number(/^<svg[^>]*><g opacity="([^"]+)"/.exec(m)?.[1]);
const tape = (m: string) => /data-tape="([^"]*)"/.exec(m)?.[1] ?? "";
const curseurs = (m: string) => (m.match(/data-curseur/g) ?? []).length;

describe("C9-19 contrat", () => {
  it("identifiant propre, famille ecran, capacité objet.ecran, mots dits", () => {
    expect(DEF.id).toBe("objet-terminal-commande");
    expect(verifierDefinition(DEF)).toBe("ok");
    expect(DEF.famille).toBe("ecran");
    expect(DEF.capacite).toBe("objet.ecran");
    expect(DEF.donnees).toBe("mots-dits");
  });
  it("valider ne lève jamais et refuse les mauvaises entrées", () => {
    for (const mauvais of [undefined, null, {}, 42, "texte", { largeur: 50, hauteur: 40 }, { commande: 3, largeur: 50, hauteur: 40 }, { commande: "", largeur: 50, hauteur: 40 }, { commande: "   ", largeur: 50, hauteur: 40 },
      { commande: "un deux trois quatre cinq", largeur: 50, hauteur: 40 }, { commande: "a\nb", largeur: 50, hauteur: 40 }, { commande: "x".repeat(41), largeur: 50, hauteur: 40 },
      { commande: "ls", largeur: 80, hauteur: 80 }, { commande: "ls", largeur: NaN, hauteur: 40 }, { commande: "ls", largeur: 5, hauteur: 40 }])
      expect(DEF.valider(mauvais)).toBeNull();
    expect(DEF.valider(P)).toEqual(P);
    expect(DEF.valider({ commande: "ls", largeur: 100, hauteur: SURFACE_MAX * 100 })).not.toBeNull();
  });
  it("refuse une commande qui ne tient pas dans le panneau, accepte les cas limites qui tiennent", () => {
    expect(DEF.valider({ commande: "docker compose up --build", largeur: 60, hauteur: 40 })).toBeNull();
    expect(DEF.valider({ commande: "x".repeat(40), largeur: 60, hauteur: 40 })).toBeNull();
    expect(DEF.valider({ commande: "x".repeat(40), largeur: 100, hauteur: 40 })).toBeNull();
    expect(DEF.valider({ commande: "ls", largeur: 20, hauteur: 40 })).toBeNull();
    expect(DEF.valider({ commande: "x", largeur: 20, hauteur: 20 })).not.toBeNull();
    expect(DEF.valider({ commande: "x".repeat(33), largeur: 100, hauteur: 40 })).not.toBeNull();
  });
  it("toute entrée acceptée : le curseur (position + largeur) reste dans le panneau, à toute image", () => {
    const cas = [...EXEMPLES_TERMINAL_COMMANDE, { commande: "x", largeur: 20, hauteur: 20 }, { commande: "x".repeat(33), largeur: 100, hauteur: 40 }, { commande: "a b c d", largeur: 60, hauteur: 60 }];
    for (const p of cas) {
      expect(DEF.valider(p)).not.toBeNull();
      for (let i = 0; i < D - 6; i++) {
        const m = renderToStaticMarkup(DEF.Rendu({ image: i, fps: 25, dureeImages: D, fond: "ivoire", parametres: p, ton: "neutre", graine: 7 }));
        const r = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" rx="14"/.exec(m);
        const c = /data-curseur="1" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/.exec(m);
        if (!c) continue;
        expect(Number(c[1]) + Number(c[2])).toBeLessThanOrEqual(Number(r![1]) + Number(r![2]) + 0.1);
      }
    }
  });
  it("exemples valides", () => {
    for (const e of EXEMPLES_TERMINAL_COMMANDE) expect(DEF.valider(e)).not.toBeNull();
  });
});

describe("C9-19 rendu", () => {
  it("déterministe ; image 0 : tracé à 0 ; dernière image : opacité 0 ; tenue pleine", () => {
    expect(rendre(40)).toBe(rendre(40));
    expect(decalages(rendre(0)).every((x) => x === 1)).toBe(true);
    expect(opaciteGroupe(rendre(D - 1))).toBe(0);
    expect(opaciteGroupe(rendre(60))).toBe(1);
  });
  it("sortie en 6 images exactement", () => {
    const sous = Array.from({ length: D }, (_, i) => i).filter((i) => i > 10 && opaciteGroupe(rendre(i)) < 1);
    expect(sous).toEqual([94, 95, 96, 97, 98, 99]);
  });
  it("la commande est tapée lettre par lettre : rien avant le contour, croissant, complète avant la sortie", () => {
    expect(tape(rendre(0))).toBe("");
    let prec = 0;
    const vus = new Set<number>();
    for (let i = 0; i < D - 6; i++) {
      const t = tape(rendre(i));
      expect(P.commande.startsWith(t)).toBe(true);
      expect(t.length).toBeGreaterThanOrEqual(prec);
      expect(t.length - prec).toBeLessThanOrEqual(1);
      prec = t.length;
      vus.add(t.length);
    }
    expect(vus.size).toBe(P.commande.length + 1);
    expect(tape(rendre(D - 7))).toBe(P.commande);
  });
  it("curseur : présent pendant la frappe, clignote une fois la commande finie, jamais de texte du curseur", () => {
    const pendant = Array.from({ length: D - 6 }, (_, i) => i).filter((i) => tape(rendre(i)).length > 0 && tape(rendre(i)).length < P.commande.length);
    expect(pendant.length).toBeGreaterThan(0);
    for (const i of pendant) expect(curseurs(rendre(i))).toBe(1);
    const apres = Array.from({ length: D - 6 }, (_, i) => i).filter((i) => tape(rendre(i)) === P.commande).map((i) => curseurs(rendre(i)));
    expect(apres).toContain(0);
    expect(apres).toContain(1);
  });
  it("terminal sombre, police JetBrains Mono, invite, aucune sortie inventée", () => {
    const m = rendre(80);
    expect(m).toContain("JetBrains Mono");
    expect(m).toContain(PALETTE.noir);
    expect(m).toContain("$");
    expect((m.match(/<text/g) ?? []).length).toBe(2);
  });
  it("couleurs de la charte seulement, aucun filter/mask/drop-shadow, aucune teinte interdite, aucun iframe/img", () => {
    const permis = new Set<string>([PALETTE.noir, PALETTE.ivoire, PALETTE.grisSurNoir, "none"]);
    for (const fond of FONDS) for (const ton of TONS) {
      const m = rendre(80, { fond, ton });
      for (const x of m.matchAll(/(?:stroke|fill)="([^"]+)"/g)) expect(permis.has(x[1])).toBe(true);
      expect(m).not.toMatch(/filter|mask|drop-shadow|<iframe|<img|foreignObject/i);
      for (const x of m.matchAll(/#[0-9a-f]{6}/gi)) expect([PALETTE.noir, PALETTE.ivoire, PALETTE.grisSurNoir]).toContain(x[0].toUpperCase());
    }
  });
});

describe("C9-19 garde statique du fichier (13 motifs de garde.test.ts:8-22, copiés)", () => {
  const texte = readFileSync(join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets", "terminal-commande.tsx"), "utf8");
  const MOTIFS: [string, RegExp][] = [
    ["@/", /@\//], ["zod", /\bzod\b/], ["Math.random", /Math\.random/], ["remotion", /remotion/],
    ["moteurs/", /from\s+["'][^"']*moteurs\//], ["-v4", /from\s+["'][^"']*-v4/], ["VideoAnimeeV4", /VideoAnimeeV4/],
    ["briques-v4", /briques-v4/], ["faits-script", /faits-script/], ["droits", /from\s+["'][^"']*\/droits/],
    ["bibliotheque-video", /bibliotheque-video/], ["domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//], ["services", /from\s+["'][^"']*\/services\//],
  ];
  it("aucun motif interdit", () => {
    expect(MOTIFS.filter(([, re]) => re.test(texte)).map(([n]) => n)).toEqual([]);
  });
  it("ni filtre, ni masque, ni courbe littérale, ni ressort", () => {
    expect(texte).not.toMatch(/drop-shadow|<mask|<filter|\bfilter\s*[=:]|cubic-bezier|Easing\.bezier|damping|stiffness|mass\s*:/);
  });
});
