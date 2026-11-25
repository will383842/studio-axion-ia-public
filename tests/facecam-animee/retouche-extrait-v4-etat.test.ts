/** R4-03-c1-v20j : décision et enchaînement de la retouche d'extrait (module neuf, monté nulle part). */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { couperPriseV4, VERSION_CHAINE_V4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { appliquerDemandeExtraitV4, CLE_ENTREE_RETOUCHE_EXTRAIT_V4 as CLE_B1, lireDemandeExtraitV4, type ClipRetoucheV4, type DemandeExtraitV4 } from "@/moteurs/montage-facecam-animee/retouche-extrait-v4";
import { lireProjetGardeV4, type ProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";
import { CLE_ENTREE_RETOUCHE_EXTRAIT_V4, demandeExtraitPourCetteVersionV4, etatRetoucheExtraitV4 } from "@/moteurs/montage-facecam-animee/retouche-extrait-v4-etat";
import { planValide } from "./plan-reference";

const demande = { videoId: "v1", versionId: "ver-neuve", priseCle: "prises/brute.mp4", titre: "T" };
const PAROLES = "Bonjour à tous aujourd'hui je vous montre comment gagner du temps chaque semaine avec Action IA sur vos vidéos courtes pour vos clients".split(" ");
const mots = PAROLES.map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(2), finSec: +(i * 0.4 + 0.3).toFixed(2) }));
const transcription = { mots, dureeSec: +(PAROLES.length * 0.4 + 1).toFixed(2), largeur: 1920, hauteur: 1080 };

function etatPrete(): EtatChaineV4 {
  const plan = {
    ...planValide(),
    elementsV4: [
      { id: "Chiffre", debut: 0.5, fin: 1.8, mots: ["12"] },
      { id: "telephone-video", debut: 2, fin: 6, recherches: ["axion:mardi"], medias: ["broll/v4-1-0.mp4"], instants: [2.5, 4], lignes: [{ texte: "a", a: 3 }], motIndex: 4 },
    ],
  };
  const coupes = couperPriseV4({ mots, dureeSec: transcription.dureeSec });
  return {
    version: VERSION_CHAINE_V4,
    etape: "prete",
    demande,
    transcription,
    cadrage: { x: 656, largeur: 608, hauteur: 1080, visage: true, centreX: 0.5 },
    coupes,
    realisation: { version: "complete", essais: 2, avertissements: 1, plan },
    videos: {
      fichiers: [{ nom: "v4-1-0.mp4", cle: "videos/v4-1-0.mp4" }],
      retirees: [],
      manques: [],
      choix: [{ fichier: "v4-1-0.mp4", source: "archive-axion", id: "a1", scene: "s1" }],
    },
    planScenes: { entree: "e", remarques: ["r"], plan: null },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: coupes.dureeSec, taille: 10 },
  } as unknown as EtatChaineV4;
}

const REFUS_PROJET = { code: "PROJET_ILLISIBLE", message: "projet" };
const clipNeuf = (): ClipRetoucheV4 => ({ nom: "v4-1-r1.mp4", cle: "videos/v4-1-r1.mp4", choix: { fichier: "v4-1-r1.mp4", source: "archive-axion", id: "n1", scene: "s1" } });

function ports(projet: () => ProjetGardeV4 | null = () => lireProjetGardeV4(projetMontageV4(etatPrete())), clip: (p: ProjetGardeV4, d: DemandeExtraitV4) => Promise<ClipRetoucheV4 | { refus: { code: string; message: string } }> = async () => clipNeuf()) {
  return {
    lire: vi.fn(lireDemandeExtraitV4),
    projet: vi.fn(projet),
    clip: vi.fn(clip),
    appliquer: vi.fn((p: ProjetGardeV4, d: DemandeExtraitV4, c?: ClipRetoucheV4) => appliquerDemandeExtraitV4(p, d, c)),
    reprendre: vi.fn((p: ProjetGardeV4) => etatRepriseAuRenduV4(p, demande)),
    refusProjet: vi.fn(() => REFUS_PROJET),
  };
}
const entrees = (d: Record<string, unknown>, pour: unknown = "ver-neuve") => ({ [CLE_ENTREE_RETOUCHE_EXTRAIT_V4]: { ...d, ...(pour === null ? {} : { pourVersionId: pour }) } });
const lancer = (e: Record<string, unknown> | undefined, f = ports(), actif = true) => etatRetoucheExtraitV4({ entrees: e, parentVersionId: "ver-neuve", actif }, f);
const aucunAppel = (f: ReturnType<typeof ports>) => [f.lire, f.projet, f.clip, f.appliquer, f.reprendre, f.refusProjet].forEach((m) => expect(m).not.toHaveBeenCalled());

describe("R4-03-c1 · état de retouche d'extrait", () => {
  it("la clé est celle de b1", () => expect(CLE_ENTREE_RETOUCHE_EXTRAIT_V4).toBe(CLE_B1));

  it("a) éteint = identique", async () => {
    const f = ports();
    expect(await lancer(entrees({ action: "retirer", rang: 1 }), f, false)).toBeNull();
    aucunAppel(f);
    const g = ports();
    expect(await lancer({}, g)).toBeNull();
    expect(await lancer(undefined, g)).toBeNull();
    expect(g.clip).not.toHaveBeenCalled();
  });

  it("b) autre version ou version absente : ignorée, jamais rejouée", async () => {
    for (const pour of ["ver-ancienne", null, ""]) {
      const f = ports();
      expect(await lancer(entrees({ action: "remplacer", rang: 1, recherche: "mardi" }, pour), f)).toBeNull();
      expect(f.clip).not.toHaveBeenCalled();
      expect(f.projet).not.toHaveBeenCalled();
    }
    expect(demandeExtraitPourCetteVersionV4({ [CLE_ENTREE_RETOUCHE_EXTRAIT_V4]: { x: 1, pourVersionId: "a" } }, undefined, (x) => x)).toBeNull();
  });

  it("c) demande illisible : null", async () => {
    expect(await lancer(entrees({ action: "inconnue", rang: 1 }))).toBeNull();
    expect(await lancer(entrees({ action: "retirer", rang: -1 }))).toBeNull();
  });

  it("d) remplacer : clip une fois, sans pourVersionId, medias au nommage de b1", async () => {
    const f = ports();
    const r = await lancer(entrees({ action: "remplacer", rang: 1, recherche: "ma vidéo de mardi" }), f);
    expect(f.clip).toHaveBeenCalledTimes(1);
    const [, d] = f.clip.mock.calls[0];
    expect(d).not.toHaveProperty("pourVersionId");
    expect(r && "etat" in r).toBe(true);
    const etat = (r as { etat: EtatChaineV4 }).etat;
    expect(etat.etape).toBe("rendu");
    expect(etat.realisation!.plan.elementsV4![1].medias).toEqual(["broll/v4-1-r1.mp4"]);
  });

  it("d) refus du clip rendu tel quel, appliquer jamais appelé", async () => {
    const refus = { refus: { code: "AUCUN_EXTRAIT", message: "rien" } };
    const f = ports(undefined, async () => refus);
    expect(await lancer(entrees({ action: "remplacer", rang: 1, recherche: "x" }), f)).toBe(refus);
    expect(f.appliquer).not.toHaveBeenCalled();
  });

  it("e) retirer / déplacer : clip jamais appelé ; hors durée refusé par b1", async () => {
    const f = ports();
    const r = await lancer(entrees({ action: "retirer", rang: 1 }), f);
    expect(r && "etat" in r).toBe(true);
    expect(f.clip).not.toHaveBeenCalled();
    const g = ports();
    const h = await lancer(entrees({ action: "deplacer", rang: 1, debut: 9999, fin: 10000 }), g);
    expect(g.clip).not.toHaveBeenCalled();
    expect(h).toEqual({ refus: expect.objectContaining({ code: "HORS_DUREE" }) });
  });

  it("f) projet illisible, reprise nulle, port qui lève", async () => {
    expect(await lancer(entrees({ action: "retirer", rang: 1 }), ports(() => null))).toEqual({ refus: REFUS_PROJET });
    const f = ports();
    f.reprendre.mockReturnValue(null);
    expect(await lancer(entrees({ action: "retirer", rang: 1 }), f)).toEqual({ refus: REFUS_PROJET });
    const g = ports(undefined, async () => { throw new Error("boum"); });
    const r = await lancer(entrees({ action: "remplacer", rang: 1, recherche: "x" }), g);
    expect(r).toEqual({ refus: expect.objectContaining({ code: "EXTRAIT_IMPOSSIBLE" }) });
    const h = ports();
    h.lire.mockImplementation(() => { throw new Error("boum"); });
    expect(await lancer(entrees({ action: "retirer", rang: 1 }), h)).toBeNull();
  });

  it("g) gardes statiques et aucun importeur", () => {
    const racine = join(process.cwd(), "src");
    const src = readFileSync(join(racine, "moteurs/montage-facecam-animee/retouche-extrait-v4-etat.ts"), "utf8");
    expect(src).not.toMatch(/from "@\/services\//);
    for (const m of ["retouche-gratuite", 'retouche-extrait-v4"', "retouche-extrait-v4'", "reprise-rendu-v4", "lireParametre", "Date", "Math.random"]) expect(src).not.toContain(m);
    expect(src).not.toMatch(/credits|budget|depense|couts|plafond/);
    const importeurs: string[] = [];
    const marche = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) marche(c);
        else if (/\.(ts|tsx)$/.test(n) && !c.endsWith("retouche-extrait-v4-etat.ts") && readFileSync(c, "utf8").includes("retouche-extrait-v4-etat")) importeurs.push(c);
      }
    };
    marche(racine);
    // MAJ 25/11 (R4-03-c2-v20j, voulue, à relire) : `index.ts` du moteur est le SEUL importeur permis (import dynamique dans `retoucher`, derrière le réglage éteint). Tout AUTRE fichier reste refusé.
    expect(importeurs).toEqual([join(racine, "moteurs/montage-facecam-animee/index.ts")]);
  });
});
