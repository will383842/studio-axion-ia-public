import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LigneCout, Sortie, VersionVideo } from "@/domaine/types";
import { ecrituresVersionChat } from "@/services/retouche-chat/version-chat-usine";

const T = "2026-11-20T10:00:00.000Z";
const eur = (centimes: number) => ({ centimes, devise: "EUR" as const });
const rapport = { note: 90, verifie: { image: true, son: true, sousTitres: true, mentionIA: true, droits: true }, alertes: [], niveauSonoreLufs: -14 };
const parent = (extra: Partial<VersionVideo> = {}): VersionVideo =>
  ({ id: "ver-p", videoId: "vid-1", numero: 1, numeroSuivi: 7, commande: { origine: "usine", ratios: ["9:16", "4:5"] }, statut: "prete", choisie: true, creeLe: T, modifieLe: T, ...extra }) as unknown as VersionVideo;
const sortie = (ratio: string): Sortie =>
  ({ id: `sortie-${ratio}`, videoId: "vid-1", versionId: "ver-p", ratio, resolution: "1080x1920", fichierId: `f-${ratio}`, vignetteFichierId: `v-${ratio}`, dureeSec: 30, taille: 100, rapportQualite: rapport, creeLe: T, modifieLe: T }) as unknown as Sortie;
const ligne = (c: number): LigneCout => ({ etape: "rendu", fournisseur: "x", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "reel" });
let n = 0;
const base = (extra: Record<string, unknown> = {}) => ({
  versionId: "ver-n", numero: 2, numeroSuivi: 8, parent: parent(), video: { id: "vid-1", estDemo: false }, sortiesParent: [sortie("9:16"), sortie("4:5")],
  plan: { scenes: [] }, demande: "plus de rythme", operations: [], impact: { scenes: ["s1"], total: 3, voixTouchee: false, phrase: "ok" },
  rendu: { fichierCle: "rendu/a.mp4", dureeSec: 30, exports: { refaits: ["9:16"], gardes: ["4:5"], fichiers: { "9:16": "rendu/9x16.mp4" }, phrase: "ok" } },
  lignesReelles: [] as LigneCout[], nouvelId: (p: string) => `${p}-${++n}`, maintenant: T, ...extra,
}) as unknown as Parameters<typeof ecrituresVersionChat>[0];

describe("G6-07-a : écritures d'une version née du chat", () => {
  it("a) numéro de suivi : celui donné, jamais celui du parent", () => {
    expect(ecrituresVersionChat(base()).version.numeroSuivi).toBe(8);
    expect(() => ecrituresVersionChat(base({ numeroSuivi: 7 }))).toThrow();
  });
  it("b) commande, démo et parenté recopiés", () => {
    const { version } = ecrituresVersionChat(base({ parent: parent({ estDemo: true }) }));
    expect(version.commande).toEqual({ origine: "usine", ratios: ["9:16", "4:5"] });
    expect(version.estDemo).toBe(true);
    expect(version.parentVersionId).toBe("ver-p");
    expect(version.statut).toBe("prete");
    expect(version.choisie).toBe(false);
    expect(version.id).toBe("ver-n");
  });
  it("c) un format gardé recopie la sortie du parent, un format refait donne un fichier", () => {
    const r = ecrituresVersionChat(base());
    expect(r.sortiesGardees).toHaveLength(1);
    expect(r.sortiesGardees[0]).toMatchObject({ ratio: "4:5", fichierId: "f-4:5", vignetteFichierId: "v-4:5", versionId: "ver-n" });
    expect(r.sortiesGardees[0].id).not.toBe("sortie-4:5");
    expect(r.fichiersARegistrer).toEqual([{ ratio: "9:16", fichierCle: "rendu/9x16.mp4", dureeSec: 30 }]);
  });
  it("d) sans exports : un fichier au premier format de la commande", () => {
    const r = ecrituresVersionChat(base({ rendu: { fichierCle: "rendu/a.mp4", dureeSec: 12 } }));
    expect(r.sortiesGardees).toEqual([]);
    expect(r.fichiersARegistrer).toEqual([{ ratio: "9:16", fichierCle: "rendu/a.mp4", dureeSec: 12 }]);
  });
  it("e) format gardé sans sortie au parent et sans fichier : lève", () => {
    expect(() => ecrituresVersionChat(base({ sortiesParent: [sortie("9:16")] }))).toThrow();
  });
  it("e bis) format gardé sans sortie mais avec fichier : il passe aux fichiers", () => {
    const r = ecrituresVersionChat(base({ sortiesParent: [sortie("9:16")], rendu: { fichierCle: "k", dureeSec: 5, exports: { refaits: [], gardes: ["4:5"], fichiers: { "4:5": "rendu/45.mp4" }, phrase: "" } } }));
    expect(r.fichiersARegistrer).toEqual([{ ratio: "4:5", fichierCle: "rendu/45.mp4", dureeSec: 5 }]);
  });
  it("f) dépense écrite même vide ; total = somme", () => {
    const vide = ecrituresVersionChat(base());
    expect(vide.depense).toMatchObject({ videoId: "vid-1", lignes: [], total: eur(0), date: T, estDemo: false });
    expect(vide.version.coutReel).toEqual(eur(0));
    const deux = ecrituresVersionChat(base({ lignesReelles: [ligne(120), ligne(30)] }));
    expect(deux.depense.total).toEqual(eur(150));
    expect(deux.version.coutReel).toEqual(eur(150));
  });
  it("g) budget surveillé pour une vraie vidéo, pas pour une démo", () => {
    expect(ecrituresVersionChat(base()).surveillerBudget).toBe(true);
    expect(ecrituresVersionChat(base({ video: { id: "vid-1", estDemo: true } })).surveillerBudget).toBe(false);
    expect(ecrituresVersionChat(base()).depense.estDemo).toBe(false);
    expect(ecrituresVersionChat(base({ video: { id: "vid-1", estDemo: true } })).depense.estDemo).toBe(true);
  });
  it("h) parité de forme avec travaux.ts : mêmes clés de Sortie", () => {
    const cles = ["id", "videoId", "versionId", "ratio", "resolution", "fichierId", "vignetteFichierId", "dureeSec", "taille", "rapportQualite", "creeLe", "modifieLe"].sort();
    expect(Object.keys(ecrituresVersionChat(base()).sortiesGardees[0]).sort()).toEqual(cles);
  });
  it("i) gardes statiques : pur, aucune porte d'argent", () => {
    const src = readFileSync("src/services/retouche-chat/version-chat-usine.ts", "utf8");
    expect(src.split("\n").length).toBeLessThanOrEqual(110);
    for (const m of src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) expect(m[1]).not.toMatch(/_commun|fabrication|travaux|credits|couts|budget/);
    expect(src).not.toMatch(/lireParametre/);
  });
});
