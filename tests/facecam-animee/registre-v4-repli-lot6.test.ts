/**
 * N-17 · le téléphone qui joue un extrait devient rendable (repli de rendu du lot 6, ÉTEINT).
 * Exception § 6.2 : `registre-v4.tsx` reçoit EXACTEMENT 2 lignes (`// N-17`), 0 retirée ; les 26 habillages ne changent pas.
 * T1, T2 (texte), T4 (texte) et T6 ne lisent que des fichiers du dépôt : ils tournent partout. T3 et T5 (qui importent remotion)
 * se sautent, avec avertissement, quand `studio-rendu/node_modules` est absent (comme `non-regression-chantier4.test.ts`).
 * AUCUN rendu vidéo, aucun réseau, aucun appel à Claude.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
if (!AVEC_RENDU) console.warn("N-17 : studio-rendu/node_modules absent, T3 et T5 NON vérifiés");

const REGISTRE = "studio-rendu/compositions/interface-claire/motion-v4/registre-v4.tsx";
const RENDUS = "studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6.tsx";
const lire = (c: string) => readFileSync(c, "utf8");
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** Les 26 plaquettes, écrites en dur (copie de `GEOMETRIE_V4`, registre-v4.tsx). */
const GEOMETRIE_EN_DUR: Record<string, { slot: string; sousTitres: unknown; couvre: boolean; descente: string }> = {
  EtiquetteTete: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  Interjection: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  BadgeCompteur: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  BadgeProfil: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  RangeePastilles: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  MotSaute: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  Chrono: { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  "element-barre": { slot: "tete", descente: "D1", sousTitres: "base", couvre: false },
  CarteChecklist: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  CarteCommande: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  CarteCommentaire: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  CarteStatuts: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  GraphiqueBarres: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  CarteCalendrier: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  CarteComparaison: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  JaugePourcentage: { slot: "carte", descente: "D2", sousTitres: "carte", couvre: false },
  PileNotifications: { slot: "bas", descente: "D0", sousTitres: "Y_ST_MIN", couvre: false },
  FenetreTelephone: { slot: "fenetre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  FenetreDouble: { slot: "fenetre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  AvantApres: { slot: "fenetre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  CarrouselFeuillete: { slot: "fenetre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  MosaiqueVideos: { slot: "plein-cadre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  "dalle-claquee": { slot: "plein-cadre", descente: "D0", sousTitres: null, couvre: true },
  "rafale-trois-mots": { slot: "plein-cadre", descente: "D0", sousTitres: null, couvre: true },
  "duel-video": { slot: "plein-cadre", descente: "D0", sousTitres: "Y_ST_MAX", couvre: true },
  EclatChiffre: { slot: "plein-cadre", descente: "D0", sousTitres: null, couvre: true },
};
const LES_26 = Object.keys(GEOMETRIE_EN_DUR);

describe("N-17 · T1 · empreinte du registre (preuve que les 26 habillages ne changent pas)", () => {
  const texte = lire(REGISTRE);
  const lignes = texte.split("\n");
  const marquees = lignes.filter((l) => l.includes("// N-17"));
  it("exactement 2 lignes marquées // N-17 : l'import et le repli", () => {
    expect(marquees).toHaveLength(2);
    expect(marquees.filter((l) => l.startsWith('import { estTypeLot6, poserLot6 } from "./lot6/rendus-lot6";'))).toHaveLength(1);
    expect(marquees.filter((l) => l.startsWith("  if (!RENDUS_V4[e.id] && estTypeLot6(e.id)) return poserLot6(e, GesteVisible);"))).toHaveLength(1);
  });
  it("le repli est la ligne juste avant `const rendu = RENDUS_V4[e.id];` dans rendreElementV4", () => {
    const i = lignes.findIndex((l) => l.startsWith("  if (!RENDUS_V4[e.id] && estTypeLot6(e.id))"));
    expect(lignes[i - 1]).toBe("export function rendreElementV4(e: ElementV4Plan, c: ContexteV4): React.ReactNode {");
    expect(lignes[i + 1]).toBe("  const rendu = RENDUS_V4[e.id];");
  });
  it("sans ces 2 lignes, le fichier a l'empreinte de origin/master (36f85f8) : aucune autre retouche, même d'un espace", () => {
    const reste = lignes.filter((l) => !l.includes("// N-17")).join("\n");
    expect(sha(reste)).toBe("9f36a5574cdad4890e50256255b1156e0685bf6949b4ef04addcf2391b679f5a");
  });
});

describe("N-17 · T2 · les 26 habillages, listés en dur", () => {
  const texte = lire(REGISTRE);
  it("la liste en dur compte 26 types, sans le téléphone", () => {
    expect(LES_26).toHaveLength(26);
    expect(LES_26).not.toContain("telephone-video");
  });
  it("chaque type de la liste a sa ligne de géométrie (slot, descente, sous-titres, couvre) telle qu'écrite en dur", () => {
    for (const id of LES_26) {
      const g = GEOMETRIE_EN_DUR[id];
      const cle = /^[A-Za-z]+$/.test(id) ? id : `"${id}"`;
      const sousTitres = g.sousTitres === null ? "null" : g.sousTitres === "base" || g.sousTitres === "carte" ? `"${g.sousTitres}"` : String(g.sousTitres);
      expect(texte, id).toContain(`  ${cle}: { slot: "${g.slot}", descente: DESCENTE.${g.descente}, sousTitres: ${sousTitres}, couvre: ${g.couvre} },`);
    }
  });
  it("le téléphone n'a de ligne ni dans GEOMETRIE_V4 ni dans RENDUS_V4 ni dans PLAQUETTES_A_VIDEO_V4", () => {
    expect(texte).not.toContain("telephone-video");
  });
});

describe.skipIf(!AVEC_RENDU)("N-17 · T2/T3 · tables du registre et même rendu pour les 26 (rendus réels, remotion simulé)", () => {
  it("clés de RENDUS_V4 = clés de GEOMETRIE_V4 = les 26 ; PLAQUETTES_A_VIDEO_V4 inchangé ; le repli n'est jamais pris", async () => {
    const poser = vi.fn();
    const est = vi.fn();
    vi.resetModules();
    vi.doMock("../../studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6", async (origine) => {
      const vrai = await origine<Record<string, unknown>>();
      return { ...vrai, poserLot6: (...a: unknown[]) => { poser(...a); return (vrai.poserLot6 as (...b: unknown[]) => unknown)(...a); }, estTypeLot6: (...a: unknown[]) => { est(...a); return (vrai.estTypeLot6 as (...b: unknown[]) => unknown)(...a); } };
    });
    const m = await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
    expect(Object.keys(m.RENDUS_V4).sort()).toEqual([...LES_26].sort());
    expect(Object.keys(m.GEOMETRIE_V4).sort()).toEqual([...LES_26].sort());
    for (const id of LES_26) {
      const g = m.GEOMETRIE_V4[id];
      expect({ slot: g.slot, couvre: g.couvre }, id).toEqual({ slot: GEOMETRIE_EN_DUR[id].slot, couvre: GEOMETRIE_EN_DUR[id].couvre });
    }
    const { PLAQUETTES_A_VIDEO_V4 } = await import("../../studio-rendu/src/operations/medias-plaquettes-v4");
    expect(PLAQUETTES_A_VIDEO_V4).toEqual({ AvantApres: 1, MosaiqueVideos: 4, "duel-video": 2 });
    for (const id of LES_26) {
      const r = m.rendreElementV4({ id, debut: 2, fin: 5, medias: ["broll/v4-0-0.mp4", "broll/v4-0-1.mp4", "broll/v4-0-2.mp4", "broll/v4-0-3.mp4"] } as never, { rang: 0 } as never) as { key: string; props: { from: number; durationInFrames: number; children: { props: { slot: string; duree: number } } } };
      expect(r.key, id).toBe(`${id}-2`);
      expect(r.props.from, id).toBe(60);
      expect(r.props.durationInFrames, id).toBe(90);
      expect(r.props.children.props.slot, id).toBe(m.GEOMETRIE_V4[id].slot);
    }
    expect(est).not.toHaveBeenCalled();
    expect(poser).not.toHaveBeenCalled();
    vi.doUnmock("../../studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6");
  });
});

describe("N-17 · T4 · aucune 2e racine Remotion", () => {
  it("rendus-lot6.tsx ne contient ni registerRoot, ni PlancheLot6, ni entree-lot6, ni registre-v4", () => {
    const t = lire(RENDUS);
    for (const interdit of ["registerRoot", "PlancheLot6", "entree-lot6", "registre-v4"]) {
      // les commentaires peuvent nommer les interdits : seul le code compte
      const code = t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, interdit).not.toContain(interdit);
    }
    expect(t.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/import[^;]*from\s+["'][^"']*(PlancheLot6|entree-lot6|registre-v4)/);
  });
  it("rien sous studio-rendu/compositions hors lot6/ n'importe entree-lot6 ni entree-repli-lot6", () => {
    const racine = "studio-rendu/compositions";
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const c = join(d, n); if (statSync(c).isDirectory()) parcourir(c); else if (/\.(tsx?|mjs|js)$/.test(n)) fichiers.push(c); } };
    parcourir(racine);
    const fautifs = fichiers.filter((f) => !f.includes("/lot6/") && /(from|import)\s*\(?\s*["'][^"']*entree-(repli-)?lot6/.test(lire(f)));
    expect(fautifs).toEqual([]);
  });
  it("entree-lot6.tsx, PlancheLot6.tsx et TelephoneVideo.tsx n'importent pas le registre", () => {
    for (const f of ["entree-lot6.tsx", "PlancheLot6.tsx", "TelephoneVideo.tsx"]) {
      expect(lire(`studio-rendu/compositions/interface-claire/motion-v4/lot6/${f}`), f).not.toContain("registre-v4");
    }
  });
  it.skipIf(!AVEC_RENDU)("importer le registre n'appelle jamais registerRoot", async () => {
    const registerRoot = vi.fn();
    vi.resetModules();
    vi.doMock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => ({ ...(await origine<Record<string, unknown>>()), registerRoot }));
    await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
    expect(registerRoot).not.toHaveBeenCalled();
    vi.doUnmock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs");
  });
});

describe.skipIf(!AVEC_RENDU)("N-17 · T5 · le repli pose le téléphone (sans média : cadre vide, sans erreur)", () => {
  type Noeud = { key: string; props: { from: number; durationInFrames: number; children: { props: { slot: string; duree: number; children: { props: { children: { type: unknown; props: { src?: string; debutImage: number; son: boolean; largeur: number } } } } } } } };
  const charger = async () => {
    vi.resetModules();
    const l6 = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot6/rendus-lot6");
    const m = await import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
    const tel = await import("../../studio-rendu/compositions/interface-claire/motion-v4/lot6/TelephoneVideo");
    return { l6, m, tel };
  };
  it("avec média : Sequence from=60, durée 90, clé telephone-video-2, geste fenetre, props du téléphone", async () => {
    const { l6, m, tel } = await charger();
    const n = m.rendreElementV4({ id: "telephone-video", debut: 2, fin: 5, medias: ["broll/v4-0-0.mp4"], depuisSec: 1 } as never, { rang: 0 } as never) as unknown as Noeud;
    expect(n.key).toBe("telephone-video-2");
    expect(n.props.from).toBe(60);
    expect(n.props.durationInFrames).toBe(90);
    expect(n.props.children.props.slot).toBe("fenetre");
    expect(n.props.children.props.duree).toBe(90);
    const t = n.props.children.props.children.props.children;
    expect((t.type as { name: string }).name).toBe(tel.TelephoneVideo.name);
    expect(t.props.src?.endsWith("broll/v4-0-0.mp4")).toBe(true);
    expect(t.props.debutImage).toBe(30);
    expect(t.props.son).toBe(false);
    expect(t.props.largeur).toBe(l6.LARGEUR_TELEPHONE_VIDEO);
  });
  it("sans média : src indéfini, aucune exception", async () => {
    const { m } = await charger();
    const n = m.rendreElementV4({ id: "telephone-video", debut: 0, fin: 3 } as never, { rang: 0 } as never) as unknown as Noeud;
    expect(n.props.children.props.children.props.children.props.src).toBeUndefined();
  });
  it("id inconnu : null comme avant ; estTypeLot6 refuse les clés du prototype ; FPS_LOT6 = FPS_V4", async () => {
    const { l6, m } = await charger();
    expect(m.rendreElementV4({ id: "Inconnu", debut: 0, fin: 3 } as never, { rang: 0 } as never)).toBeNull();
    expect(l6.estTypeLot6("toString")).toBe(false);
    expect(l6.estTypeLot6("telephone-video")).toBe(true);
    expect(l6.FPS_LOT6).toBe(m.FPS_V4);
  });
});

describe("N-17 · T6 · éteint", () => {
  it("le téléphone n'est pas au catalogue du réalisateur : aucun plan réel ne le demande", () => {
    const t = lire("src/moteurs/montage-facecam-animee/realisateur/catalogue-v4.ts");
    expect(t).not.toContain("telephone-video");
  });
  it("aucun réglage « telephone » ajouté", () => {
    for (const f of ["src/domaine/cadence/reglages.ts", "src/services/reglages.ts"]) {
      expect(lire(f).toLowerCase(), f).not.toContain("telephone-video");
    }
  });
  it("le fichier du repli ne règle rien de plus que 4 constantes, son coupé", () => {
    const t = lire(RENDUS);
    expect(t).toContain("son={false}");
    expect(t).not.toMatch(/son=\{true\}/);
  });
});
