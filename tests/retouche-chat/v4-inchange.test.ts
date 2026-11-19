// S2-13a (garde d'imports). S2-13b : fait (identité « lire → appliquer rien → entrées de rendu », en fin de fichier). Ne jamais retirer un motif.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { avancerChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { projetMontageV4 } from "@/moteurs/montage-facecam-animee/projet-v4";
import { lireProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { etatRepriseAuRenduV4 } from "@/moteurs/montage-facecam-animee/reprise-rendu-v4";

// Motifs interdits dans le chemin d'un import (ne jamais en retirer).
const MOTIFS_INTERDITS = [
  "VideoAnimeeV4",
  "briques-v4",
  "motion-v4/",
  "interface-claire/",
  "commun-lot",
  "registre-v4",
  "studio-rendu",
];

const RACINE = process.cwd();

type Refus = { ligne: number; motif: string; texte: string };

// Repère les lignes `import`, `export … from`, `import(` dont le chemin contient un motif interdit.
function refusDImports(source: string): Refus[] {
  const refus: Refus[] = [];
  const lignes = source.split("\n");
  // Une instruction peut courir sur plusieurs lignes : on regarde chaque ligne portant un chemin entre guillemets
  // dès qu'un mot-clé d'import/export a été vu dans l'instruction en cours.
  let enInstruction = false;
  lignes.forEach((texte, i) => {
    const debut = /^\s*(import|export)\b/.test(texte) || /\bimport\s*\(/.test(texte) || /\brequire\s*\(/.test(texte);
    if (debut) enInstruction = true;
    if (!enInstruction) return;
    const chemins = [...texte.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    const aChemin = /\bfrom\s*["'`]/.test(texte) || /\bimport\s*\(/.test(texte) || /^\s*import\s*["'`]/.test(texte) || /\brequire\s*\(/.test(texte);
    if (aChemin) {
      for (const chemin of chemins) {
        const motif = MOTIFS_INTERDITS.find((m) => chemin.includes(m));
        if (motif) refus.push({ ligne: i + 1, motif, texte: texte.trim() });
      }
      enInstruction = false;
    } else if (/;\s*$/.test(texte)) {
      enInstruction = false;
    }
  });
  return refus;
}

function listerTs(dossier: string, filtre: (nom: string) => boolean): string[] {
  return readdirSync(join(RACINE, dossier))
    .filter(filtre)
    .sort()
    .map((nom) => `${dossier}/${nom}`);
}

function fichiersGardes(): string[] {
  return [
    ...listerTs("src/services/retouche-chat", (n) => /\.tsx?$/.test(n)),
    ...listerTs("src/components/retouche-chat", (n) => /\.tsx?$/.test(n)),
    ...listerTs("src/moteurs/montage-facecam-animee", (n) => /^(projet-v4|master-v4|reprise-rendu-v4|retouche[-\w]*)\.ts$/.test(n)),
  ];
}

describe("S2-13a · contre-épreuve du filet", () => {
  it("refuse un import de VideoAnimeeV4 par studio-rendu", () => {
    const r = refusDImports('import { X } from "../../studio-rendu/compositions/interface-claire/VideoAnimeeV4";');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].ligne).toBe(1);
  });
  it("accepte un import voisin sans rapport", () => {
    expect(refusDImports('import { projetMontageV4 } from "./projet-v4";')).toEqual([]);
  });
  it("refuse chaque motif, en import, export … from et import()", () => {
    for (const m of MOTIFS_INTERDITS) {
      expect(refusDImports(`import a from "./x/${m}y";`).length, m).toBe(1);
      expect(refusDImports(`export { a } from "./x/${m}y";`).length, m).toBe(1);
      expect(refusDImports(`const a = await import("./x/${m}y");`).length, m).toBe(1);
    }
  });
  it("refuse un import réparti sur plusieurs lignes", () => {
    const r = refusDImports('import {\n  a,\n  b,\n} from "./briques-v4";');
    expect(r.length).toBe(1);
    expect(r[0].ligne).toBe(4);
  });
  it("ne signale pas un simple commentaire ou texte", () => {
    expect(refusDImports("// voir briques-v4 et VideoAnimeeV4\nconst t = 'studio-rendu';")).toEqual([]);
  });
});

describe("S2-13a · garde « v4 inchangée » : la retouche n'importe aucune pièce protégée", () => {
  const fichiers = fichiersGardes();

  it("la liste calculée n'est pas vide et contient projet-v4 et master-v4", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(20);
    expect(fichiers).toContain("src/moteurs/montage-facecam-animee/projet-v4.ts");
    expect(fichiers).toContain("src/moteurs/montage-facecam-animee/master-v4.ts");
  });

  it("aucun fichier gardé n'importe VideoAnimeeV4, briques-v4, plaquettes, interface-claire, registre-v4 ni studio-rendu", () => {
    const trouvailles: string[] = [];
    for (const f of fichiers) {
      const source = readFileSync(join(RACINE, f), "utf8");
      for (const r of refusDImports(source)) {
        trouvailles.push(`${f}:${r.ligne} (${r.motif}) ${r.texte}`);
      }
    }
    expect(trouvailles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// S2-13b · identité : lire → n'appliquer rien → entrées de rendu. Chemin réel : la VRAIE chaîne v4 (`avancerChaineV4`, vrais coupes, réalisateur
// et contrôles) jusqu'à « prete », puis la VRAIE lecture du projet gardé (passage par JSON = la base) et la VRAIE reprise au rendu. Factices :
// seulement les outils (transcription, Claude, vidéos, rendu), qui comptent leurs appels. Aucun appel réseau, 0 €.
// ---------------------------------------------------------------------------------------------------------------------------------
type Rendre = Parameters<OutilsChaineV4["rendre"]>[0];
type EntreeVideos = Parameters<NonNullable<OutilsChaineV4["videos"]>>[0];

const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureePriseSec: number; motsPriseBrute: { w: string; a: number; f: number }[] };
const PLAN_REF = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
// Texte validé = les mots montés de la répétition : les coupes de la vraie chaîne retombent alors sur celles du plan de référence.
const TEXTE_VALIDE = (JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { motsMontesTexteValide: { w: string }[] }).motsMontesTexteValide.map((m) => m.w).join(" ");
const MOTS_BRUTS = TRANS.motsPriseBrute.map((m) => ({ mot: m.w, debutSec: m.a, finSec: m.f }));
const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);
const MOTS_FORTS = [...new Set(PLAN_REF.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];

/** Le plan de la répétition tel qu'Opus l'écrit : les plaquettes à vidéo sans `medias` (la recherche les remplit). */
const ELEMENTS_SANS_MEDIAS: ElementV4Plan[] = (PLAN_REF.elementsV4 ?? []).map((e) => {
  const copie = { ...e };
  if (A_VIDEO.has(e.id)) delete copie.medias;
  return copie;
});

type Compteurs = { transcrire: number; reperer: number; appelerRealisateur: number; videos: number; planScenes: number; plafondClaudeAtteint: number };
interface Variante {
  nom: string;
  largeur: number;
  hauteur: number;
  finDouce?: boolean;
  avecVideos?: boolean;
  avecPlanScenes?: boolean;
}

function fabriquerOutils(v: Variante) {
  const c: Compteurs = { transcrire: 0, reperer: 0, appelerRealisateur: 0, videos: 0, planScenes: 0, plafondClaudeAtteint: 0 };
  const entrees: Rendre[] = [];
  const o: OutilsChaineV4 = {
    ...(v.finDouce ? { finDouce: true } : {}),
    // Plan de scènes : `appeler` compte ses appels et tombe en « panne » (aucun appel réel) ; le plan de repli du générateur est alors le mémo gardé.
    ...(v.avecPlanScenes
      ? {
          planScenes: {
            appeler: async () => {
              c.planScenes++;
              throw new Error("panne simulée");
            },
          },
        }
      : {}),
    transcrire: async () => {
      c.transcrire++;
      return { mots: MOTS_BRUTS, dureeSec: TRANS.dureePriseSec, largeurSource: v.largeur, hauteurSource: v.hauteur };
    },
    reperer: async () => {
      c.reperer++;
      return { centreX: 0.5, yeux: 0.3, largeurVisage: 0.2 };
    },
    plafondClaudeAtteint: async () => {
      c.plafondClaudeAtteint++;
      return false;
    },
    historique: async () => [],
    appelerRealisateur: async () => {
      c.appelerRealisateur++;
      return { ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: ELEMENTS_SANS_MEDIAS, motsForts: MOTS_FORTS } };
    },
    ...(v.avecVideos
      ? {
          videos: async (d: EntreeVideos) => {
            c.videos++;
            const fichiers: { nom: string; cle: string }[] = [];
            const elementsV4 = (d.plan.elementsV4 ?? []).map((e, i) => {
              if (!A_VIDEO.has(e.id) || !e.recherches?.length) return e;
              const medias = e.recherches.map((_, k) => {
                const nom = `v4-${i}-${k}.mp4`;
                fichiers.push({ nom, cle: `studio/dev/facecam-animee/${d.videoId}/videos/${nom}` });
                return `broll/${nom}`;
              });
              return { ...e, medias };
            });
            return { plan: { ...d.plan, elementsV4 }, fichiers, manques: [], depenseUsd: 0 };
          },
        }
      : {}),
    rendre: async (d) => {
      entrees.push(d);
      return { cle: "rendus/v.mp4", vignetteCle: "rendus/v.jpg", dureeSec: d.plan.duree, taille: 10 };
    },
  };
  return { o, c, entrees };
}

async function jusqua(etat: EtatChaineV4, o: OutilsChaineV4): Promise<EtatChaineV4> {
  let courant = etat;
  for (let i = 0; i < 12 && courant.etape !== "prete"; i++) courant = await avancerChaineV4(courant, o);
  return courant;
}

const VARIANTES: Variante[] = [
  { nom: "prise horizontale (cadrage)", largeur: 1920, hauteur: 1080 },
  { nom: "prise verticale (pas de cadrage)", largeur: 1080, hauteur: 1920 },
  { nom: "fin douce éteinte", largeur: 1920, hauteur: 1080, finDouce: false },
  { nom: "fin douce allumée", largeur: 1920, hauteur: 1080, finDouce: true },
  { nom: "plan avec vidéos d'illustration", largeur: 1920, hauteur: 1080, avecVideos: true },
  { nom: "mémo du plan de scènes présent", largeur: 1920, hauteur: 1080, avecPlanScenes: true },
];

const demandeInitiale = { videoId: "v-s2-13b", versionId: "ver-1", priseCle: "prises/brute.mp4", titre: "T", texteValide: TEXTE_VALIDE };

/** Première fabrication : « transcription » → « prete », avec les entrées captées de `rendre`. */
async function fabriquerPuisReprendre(v: Variante) {
  const premier = fabriquerOutils(v);
  const prete = await jusqua(etatInitialV4(demandeInitiale), premier.o);
  expect(prete.etape).toBe("prete");
  expect(premier.entrees.length).toBe(1);

  // Lire : projet gardé, passé par la base (JSON), relu par la vraie lecture.
  const enBase = JSON.parse(JSON.stringify(projetMontageV4(prete))) as unknown;
  const projet = lireProjetGardeV4(enBase);
  expect(projet).not.toBeNull();
  // N'appliquer rien : reprise au rendu sur une nouvelle version.
  const etat = etatRepriseAuRenduV4(projet!, { ...demandeInitiale, versionId: "ver-2" });
  expect(etat).not.toBeNull();
  expect(etat!.etape).toBe("rendu");

  const second = fabriquerOutils(v);
  const finale = await jusqua(etat!, second.o);
  expect(finale.etape).toBe("prete");
  return { prete, enBase, premier, second };
}

describe("S2-13b · identité : lire → n'appliquer rien → entrées de rendu (chemin réel)", () => {
  for (const v of VARIANTES) {
    describe(v.nom, () => {
      it("l'entrée captée de `rendre` à la reprise est celle d'origine, champ par champ ; seul `idRendu` diffère", async () => {
        const { premier, second } = await fabriquerPuisReprendre(v);
        expect(second.entrees.length).toBe(1);
        const [avant] = premier.entrees;
        const [apres] = second.entrees;
        expect(avant.idRendu).toBe("fa4-ver-1");
        expect(apres.idRendu).toBe("fa4-ver-2");
        expect(apres.priseCle).toBe(avant.priseCle);
        expect(apres.plan).toEqual(avant.plan);
        expect(apres.gardes).toEqual(avant.gardes);
        expect(apres.recadrage).toEqual(avant.recadrage);
        expect(apres.videos).toEqual(avant.videos);
        expect(apres.finDouce).toEqual(avant.finDouce);
        expect(apres).toEqual({ ...avant, idRendu: "fa4-ver-2" });
      });

      it("la variante exerce bien ce qu'elle annonce (la garde ne compare pas du vide)", async () => {
        const { premier } = await fabriquerPuisReprendre(v);
        const [e] = premier.entrees;
        expect(e.recadrage !== undefined).toBe(v.largeur > v.hauteur);
        expect(e.finDouce === true).toBe(v.finDouce === true);
        expect((e.videos?.length ?? 0) > 0).toBe(v.avecVideos === true);
        expect((e.plan as { planScenes?: unknown }).planScenes !== undefined).toBe(v.avecPlanScenes === true);
      });

      it("à la reprise : 0 appel à transcrire, reperer, appelerRealisateur, videos, planScenes, plafondClaudeAtteint", async () => {
        const { premier, second } = await fabriquerPuisReprendre(v);
        expect(premier.c.transcrire).toBe(1);
        expect(premier.c.appelerRealisateur).toBeGreaterThan(0);
        expect(premier.c.planScenes > 0).toBe(v.avecPlanScenes === true);
        expect(second.c).toEqual({ transcrire: 0, reperer: 0, appelerRealisateur: 0, videos: 0, planScenes: 0, plafondClaudeAtteint: 0 });
      });
    });
  }

  it("mémo planScenes : `plan.planScenes` de la reprise est identique à celui de l'origine", async () => {
    const { prete, premier, second } = await fabriquerPuisReprendre({ nom: "memo", largeur: 1920, hauteur: 1080, avecPlanScenes: true });
    expect(prete.planScenes).toBeDefined();
    const avant = premier.entrees[0].plan as { planScenes?: unknown };
    const apres = second.entrees[0].plan as { planScenes?: unknown };
    expect(apres.planScenes).toEqual(avant.planScenes);
    expect(apres.planScenes).toEqual(prete.planScenes?.plan ?? undefined);
  });

  it("contre-épreuve : un projet sans `transcription` ne donne aucune entrée de rendu (null)", async () => {
    const { enBase } = await fabriquerPuisReprendre({ nom: "sans transcription", largeur: 1920, hauteur: 1080 });
    const sans = { ...(enBase as Record<string, unknown>) };
    delete sans.transcription;
    const projet = lireProjetGardeV4(sans);
    // Soit la lecture refuse déjà (null), soit la reprise refuse : jamais d'état de rendu fabriqué.
    expect(projet === null ? null : etatRepriseAuRenduV4(projet, { ...demandeInitiale, versionId: "ver-2" })).toBeNull();
  });

  it("garde d'imports : la liste calculée couvre aussi reprise-rendu-v4.ts", () => {
    expect(fichiersGardes()).toContain("src/moteurs/montage-facecam-animee/reprise-rendu-v4.ts");
  });
});
