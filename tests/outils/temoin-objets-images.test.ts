/** C9-41-b-v20h : partie PURE du témoin en images des petits objets du cas concret (chargée par chemin calculé, PIEGE-REMOTION-TSC). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const CHEMIN = [RACINE, "studio-rendu", "scripts", "temoin-objets-cas-concret.ts"].join("/");

interface Scene { piece: string; debutMs: number; finMs: number }
interface Plan { scenes: Scene[]; [k: string]: unknown }
interface Image { fichier: string; variante: "sans" | "avec"; texte: number; scene: number; piece: string; image: number }
interface Paire { texte: string; sans: Plan | null; avec: Plan | null }
interface Module {
  FPS: number;
  TEXTES_TEMOIN: readonly string[];
  imageMiParcours: (debutMs: number, finMs: number) => number;
  lesPaires: () => Promise<Paire[]>;
  imagesDe: (p: readonly Paire[]) => Image[];
  objetsMontres: (i: readonly Image[]) => string[];
}
const charger = async (): Promise<Module> => (await import(/* @vite-ignore */ CHEMIN)) as Module;

describe("C9-41-b témoin des petits objets en images", () => {
  it("a) instants à mi-parcours exacts, dans la scène", async () => {
    const m = await charger();
    expect(m.FPS).toBe(25);
    expect(m.imageMiParcours(0, 2000)).toBe(25);
    expect(m.imageMiParcours(1000, 3000)).toBe(50);
    expect(m.imageMiParcours(2800, 4000)).toBe(85);
    // scène d'une seule image : jamais au-delà de sa dernière image
    expect(m.imageMiParcours(0, 40)).toBe(0);
    expect(m.imageMiParcours(80, 80)).toBe(2);
  });

  it("b) chaque paire a le même plan hormis les objets (scènes `objet-*` en plus)", async () => {
    const m = await charger();
    const ps = await m.lesPaires();
    expect(ps).toHaveLength(m.TEXTES_TEMOIN.length);
    for (const p of ps) {
      expect(p.avec).not.toBeNull();
      if (!p.sans || !p.avec) continue;
      const { scenes: ss, ...resteSans } = p.sans;
      const { scenes: sa, ...resteAvec } = p.avec;
      expect(resteAvec).toEqual(resteSans);
      expect(sa.filter((s) => !s.piece.startsWith("objet-"))).toEqual(ss);
      expect(sa.length).toBeGreaterThan(ss.length);
    }
  });

  it("c) les 4 objets apparaissent dans une scène « avec » (dont objet-etape et objet-cartes-coche), jamais dans « sans »", async () => {
    const m = await charger();
    const images = m.imagesDe(await m.lesPaires());
    expect(m.objetsMontres(images).sort()).toEqual(["objet-cartes-coche", "objet-coche", "objet-etape", "objet-gros-chiffre"]);
    expect(images.filter((i) => i.variante === "sans" && i.piece.startsWith("objet-"))).toEqual([]);
    expect(m.objetsMontres(images.filter((i) => i.variante === "sans"))).toEqual([]);
  });

  it("noms de fichiers uniques et stables, image dans la scène", async () => {
    const m = await charger();
    const ps = await m.lesPaires();
    const images = m.imagesDe(ps);
    expect(new Set(images.map((i) => i.fichier)).size).toBe(images.length);
    for (const i of images) {
      expect(i.fichier).toBe(`t${i.texte}-${i.variante}-s${i.scene}-${i.piece}.png`);
      const s = ps[i.texte - 1]![i.variante]!.scenes[i.scene - 1]!;
      expect(i.image).toBeGreaterThanOrEqual(Math.round((s.debutMs / 1000) * m.FPS));
      expect(i.image).toBeLessThan(Math.max(Math.round((s.finMs / 1000) * m.FPS), Math.round((s.debutMs / 1000) * m.FPS) + 1));
    }
    expect(m.imagesDe([{ texte: "x", sans: null, avec: null }])).toEqual([]);
  });

  it("d) garde : le script n'écrit rien sous studio-rendu/compositions et ne charge Remotion qu'au lancement", () => {
    const src = readFileSync(CHEMIN, "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*compositions/);
    expect(src).not.toMatch(/writeFile|appendFile|rmSync|unlinkSync|copyFile|renameSync/);
    expect(src).not.toMatch(/^import[^\n]*@remotion/m);
    expect(src).toMatch(/await import\("@remotion\/renderer"\)/);
  });
});
