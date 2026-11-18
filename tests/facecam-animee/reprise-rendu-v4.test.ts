/**
 * G12-09a-b : état de reprise au pas « rendu » depuis le projet gardé (pur, non branché).
 * Chemin réel : état « prete » → projetMontageV4 → lireProjetGardeV4 → etatRepriseAuRenduV4 (aucun appel, aucune dépense).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { couperPriseV4, lireEtatV4, VERSION_CHAINE_V4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";
import { planValide } from "./plan-reference";

const demande = { videoId: "v1", versionId: "ver1", priseCle: "prises/brute.mp4", titre: "T" };
const PAROLES = "Bonjour à tous aujourd'hui je vous montre comment gagner du temps chaque semaine avec Action IA sur vos vidéos courtes pour vos clients".split(" ");
const mots = PAROLES.map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(2), finSec: +(i * 0.4 + 0.3).toFixed(2) }));
const transcription = { mots, dureeSec: +(PAROLES.length * 0.4 + 1).toFixed(2), largeur: 1920, hauteur: 1080 };

function etatPrete(finDouce = false, plan: unknown = planValide(), extra: Partial<EtatChaineV4> = {}): EtatChaineV4 {
  const coupes = couperPriseV4({ mots, dureeSec: transcription.dureeSec, ...(finDouce ? { finDouce: true } : {}) });
  return {
    version: VERSION_CHAINE_V4,
    etape: "prete",
    demande,
    transcription,
    cadrage: { x: 656, largeur: 608, hauteur: 1080, visage: true, centreX: 0.5 },
    coupes,
    realisation: { version: "complete", essais: 2, avertissements: 1, plan },
    videos: { fichiers: [], retirees: [], manques: [] },
    planScenes: { entree: "e", remarques: ["r"], plan: null },
    rendu: { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: coupes.dureeSec, taille: 10 },
    ...extra,
  } as unknown as EtatChaineV4;
}
const reprise = (etat: EtatChaineV4) => {
  const projet = lireProjetGardeV4(projetMontageV4(etat));
  return projet ? etatRepriseAuRenduV4(projet, demande) : null;
};

describe("reprise au rendu : chemin réel", () => {
  it("rend un état à « rendu » égal à l'original (plan, cadrage, planScenes, coupes), sans référence partagée", () => {
    const original = etatPrete();
    const projet = lireProjetGardeV4(projetMontageV4(original))!;
    const e = etatRepriseAuRenduV4(projet, demande)!;
    expect(e).not.toBeNull();
    expect(e.etape).toBe("rendu");
    expect(e.version).toBe(VERSION_CHAINE_V4);
    expect(e.realisation).toEqual({ version: "complete", essais: 0, avertissements: 0, plan: original.realisation!.plan });
    expect(e.cadrage).toEqual(original.cadrage);
    expect(e.planScenes).toEqual(original.planScenes);
    expect(e.coupes).toEqual(original.coupes);
    expect(e.transcription).toEqual({ mots, dureeSec: transcription.dureeSec });
    expect(e.videos).toEqual({ fichiers: [], retirees: [], manques: [] });
    expect(e.rendu).toBeUndefined();
    expect(e.realisation!.plan).not.toBe(projet.plan);
    expect(e.coupes!.gardes).not.toBe(projet.gardes);
    expect(e.cadrage).not.toBe(projet.cadrage);
    expect(e.planScenes).not.toBe(projet.planScenes);
  });
  it("fin douce : coupes retrouvées à l'identique (gardes prolongées)", () => {
    const original = etatPrete(true);
    const e = reprise(original)!;
    expect(e.coupes).toEqual(original.coupes);
  });
  it("garde le fichier et le choix des vidéos ; lireEtatV4 le relit", () => {
    const plan = { ...planValide(), elementsV4: [{ id: "AvantApres", debut: 2, fin: 6, mots: ["a", "b", "c"], recherches: ["x"], medias: ["broll/a.mp4"] }] };
    const fichiers = [{ nom: "a.mp4", cle: "videos/a.mp4" }];
    const original = etatPrete(false, plan, { videos: { fichiers, choix: [{ fichier: "a.mp4" }], retirees: [], manques: [] } } as unknown as Partial<EtatChaineV4>);
    const e = reprise(original)!;
    expect(e.videos!.fichiers).toEqual(fichiers);
    expect(e.videos!.choix).toEqual([{ fichier: "a.mp4" }]);
    expect(lireEtatV4(e)).toBe(e);
  });
});

describe("reprise au rendu : refus par null, jamais d'exception", () => {
  const brut = () => projetMontageV4(etatPrete());
  const essai = (modif: (p: Record<string, unknown>) => void) => {
    const p = brut();
    modif(p);
    const lu = lireProjetGardeV4(p);
    return lu ? etatRepriseAuRenduV4(lu, demande) : null;
  };
  it("sans transcription : null", () => expect(essai((p) => delete p.transcription)).toBeNull());
  it("sans plan : null", () => expect(essai((p) => delete p.plan)).toBeNull());
  it("plaquette à vidéo sans videos.fichiers : null", () => {
    const plan = { ...planValide(), elementsV4: [{ id: "AvantApres", debut: 2, fin: 6, mots: ["a", "b", "c"], recherches: ["x"], medias: ["broll/a.mp4"] }] };
    expect(reprise(etatPrete(false, plan, { videos: undefined }))).toBeNull();
  });
  it("gardes qui ne viennent pas de cette transcription : null (coupes non reconstructibles)", () => {
    expect(essai((p) => (p.gardes = [{ debutSec: 0, finSec: 1.5 }]))).toBeNull();
  });
  it("transcription abîmée : null sans lever", () => {
    expect(essai((p) => (p.transcription = { mots: [null, 3], dureeSec: 5 }))).toBeNull();
  });
});

describe("garde : non branché", () => {
  it("aucun fichier de src/ n'importe reprise-rendu-v4", () => {
    const vus: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n) && !c.endsWith("reprise-rendu-v4.ts") && readFileSync(c, "utf8").includes("reprise-rendu-v4")) vus.push(c);
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(vus).toEqual([]);
  });
});
