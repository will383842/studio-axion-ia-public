import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerTexteEcranAuLancement, candidatsTexteEcran } from "@/briques/sous-titres/variantes";
import { CLE_ENTREE_BIBLIOTHEQUE, lireEntreeBibliotheque } from "@/briques/bibliotheque-video/schema";
import type { BlocTexteEcran, EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import type { CommandeFabrication } from "@/domaine/types";

const CAP = "texte.style-varie";
const BLOC: BlocTexteEcran = {
  teintes: ["terracotta", "ivoire", "ardoise"], cibles: ["souligne", "expression", "mot-dit"],
  pave: true, outils: false, bandeauNom: false, intensites: [], signaturesAEviter: 3,
};
const entree = (o: Partial<EntreeBibliotheque> = {}, bloc: BlocTexteEcran | null = BLOC, regle: object = { permis: true, maxParVideo: 1 }): EntreeBibliotheque => ({
  version: "bibliotheque-video/1",
  profil: { id: "p", formatId: "f", version: 1, capacites: { [CAP]: regle }, plafonds: {}, memoire: { fenetreVideos: 5, portee: "format" }, verrous: [], ...(bloc ? { blocs: { texteEcran: bloc } } : {}) },
  recents: [], graine: "G", figeeLe: "2026-01-01", ...o,
} as EntreeBibliotheque);
const commande = (e: unknown, varier: boolean | "absent" = true, style = true): CommandeFabrication =>
  ({
    styles: style ? { sousTitres: { id: "s", nom: "S", valeur: { type: "style-sous-titres", texteEcran: { ...(varier === "absent" ? {} : { varier }), outils: "etiquette" } } } } : {},
    entrees: e === undefined ? {} : { [CLE_ENTREE_BIBLIOTHEQUE]: e },
  }) as unknown as CommandeFabrication;
const cleDe = (c: CommandeFabrication) => lireEntreeBibliotheque(c.entrees)!.choix!.find((x) => x.capacite === CAP)!.cle;

describe("appliquerTexteEcranAuLancement : éteint = identique (C2-U12)", () => {
  const memes: [string, CommandeFabrication][] = [
    ["pas de style", commande(entree(), true, false)],
    ["style sans varier", commande(entree(), "absent")],
    ["varier false", commande(entree(), false)],
    ["pas d'entrée", commande(undefined)],
    ["permis false", commande(entree({}, BLOC, { permis: false }))],
    ["verrou texte", commande(entree({ profil: { ...entree().profil, verrous: ["texte"] } }))],
    ["profil sans blocs.texteEcran", commande(entree({}, null))],
    ["entrée illisible", commande({ version: "nimporte" })],
  ];
  for (const [nom, c] of memes) it(nom, () => expect(appliquerTexteEcranAuLancement(c)).toBe(c));
  it("ne lève jamais", () => {
    for (const c of [null, undefined, {}, { styles: null }] as unknown[]) expect(() => appliquerTexteEcranAuLancement(c as CommandeFabrication)).not.toThrow();
  });
});

describe("appliquerTexteEcranAuLancement : allumé à la main", () => {
  it("candidats : produit trié et stable, sans pavé si bloc.pave faux", () => {
    expect(candidatsTexteEcran(BLOC)).toHaveLength(3 * 3 * 2);
    const sans = candidatsTexteEcran({ ...BLOC, pave: false });
    expect(sans).toHaveLength(9);
    expect(sans.every((c) => c.capacite === CAP && c.cle.endsWith("|-"))).toBe(true);
    expect(candidatsTexteEcran(BLOC).map((c) => c.cle)).toEqual(candidatsTexteEcran(BLOC).map((c) => c.cle));
  });
  it("même commande, même choix ; entrée non modifiée", () => {
    const c = commande(entree());
    const avant = structuredClone(c);
    const a = appliquerTexteEcranAuLancement(c);
    expect(a).not.toBe(c);
    expect(c).toEqual(avant);
    expect(appliquerTexteEcranAuLancement(c)).toEqual(a);
  });
  it("20 graines : au moins 2 signatures, toujours dans le profil, une seule entrée de choix", () => {
    const cles = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const bloc = { ...BLOC, pave: i % 2 === 0 };
      const r = appliquerTexteEcranAuLancement(commande(entree({ graine: `g${i}` }, bloc)));
      const lue = lireEntreeBibliotheque(r.entrees);
      expect(lue).not.toBeNull();
      expect(lue!.choix!.filter((x) => x.capacite === CAP)).toHaveLength(1);
      const te = (r.styles.sousTitres!.valeur as unknown as { texteEcran: { marqueur: { teinte: never; cible: never }; pave?: unknown; varier: boolean; outils: string } }).texteEcran;
      expect(bloc.teintes).toContain(te.marqueur.teinte);
      expect(bloc.cibles).toContain(te.marqueur.cible);
      if (!bloc.pave) expect(te.pave).toBeUndefined();
      expect(te.varier).toBe(true);
      expect(te.outils).toBe("etiquette");
      cles.add(cleDe(r));
    }
    expect(cles.size).toBeGreaterThanOrEqual(2);
  });
  it("jamais une des 3 dernières signatures", () => {
    for (let i = 0; i < 20; i++) {
      const recents = candidatsTexteEcran(BLOC).slice(0, 15).map((c, k) => ({ capacite: CAP, cle: c.cle, videoId: `v${k}` }));
      const r = appliquerTexteEcranAuLancement(commande(entree({ graine: `g${i}`, recents } as Partial<EntreeBibliotheque>)));
      expect(recents.slice(0, 3).map((x) => x.cle)).not.toContain(cleDe(r));
    }
  });
  it("déjà tiré (plafond) : commande rendue telle quelle", () => {
    const une = appliquerTexteEcranAuLancement(commande(entree()));
    expect(appliquerTexteEcranAuLancement(une)).toBe(une);
  });
});

describe("garde statique", () => {
  const lister = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      if (n === "node_modules" || n.startsWith(".")) return [];
      const p = join(d, n);
      return statSync(p).isDirectory() ? lister(p) : /\.(ts|tsx|mjs)$/.test(n) ? [p] : [];
    });
  it("variantes.ts n'est importé que par fabrication.ts", () => {
    const importeurs = lister("src").concat(lister("studio-rendu")).filter((f) => /sous-titres\/variantes["']|\.\/variantes["']/.test(readFileSync(f, "utf8")));
    expect(importeurs.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/services/fabrication.ts"]);
  });
});
