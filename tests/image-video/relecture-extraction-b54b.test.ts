/**
 * 25/10/2026 : « l'image de contrôle à 68,7 s n'a pas été extraite : la vidéo n'est jamais livrée sans relecture » (v-b54bb4798246, 4:5).
 *
 * Cause : l'id du travail d'extraction ne dépendait pas des instants ; l'aligneur garde ses travaux 24 h et rendait l'ancien résultat
 * (images d'autres instants) ; `extraireImages` déclarait toutes les clés extraites ; `lireImage` rendait null pour une clé jamais déposée.
 * Corrections : id dépendant des instants, seules les images réellement listées sont déclarées, une image manquante isolée est une remarque.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import {
  demandeImagesControleIV,
  idTravailControleIV,
  imagesExtraitesIV,
  instantsClesIV,
  relireVersionIV,
  roleRelectureFinale,
  type EntreeRelectureIV,
  type InstantCleIV,
  type OutilsRelectureIV,
  type RelectureFinale,
} from "@/moteurs/montage-image-video/relecture-finale";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture { version: string; reseaux: string[]; dureeSec: number; finVoixSec: number; motsCorps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "facturation-j30-scene.json"), "utf8")) as {
  videoId: string;
  carte: { noeuds: { id: string; libelle: string; photoPersonnes?: boolean }[] };
  fiche: unknown;
  recette: unknown;
  fins: FinFixture[];
  pistes: PisteFixture[];
  versions: { id: string; piste: string; format: "9:16" | "4:5"; reseaux: string[] }[];
};

/** Même assemblage que `sceneDe` (fabrication.ts), repris de relecture-zero-blocage-b54b.test.ts. */
function entreeDe(v: (typeof F.versions)[number]): EntreeMiseEnSceneIV {
  const p = F.pistes.find((x) => x.version === v.piste)!;
  const fin = F.fins.find((f) => f.id === v.id);
  return {
    carte: F.carte,
    fiche: F.fiche,
    voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec },
    fin: fin && !fin.muet ? fin : null,
    reseaux: v.reseaux,
    bruitagesValides: BRUITAGES_V4_IV,
    ...(v.format === "4:5" ? { format: v.format } : {}),
    variete: recettePourVersion(F.recette as never, v.reseaux as never, v.format),
    graine: F.videoId,
  } as unknown as EntreeMiseEnSceneIV;
}

let resultat0: ResultatMiseEnSceneIV | null = null;
const instants24 = (): InstantCleIV[] => {
  resultat0 ??= mettreEnSceneIV(entreeDe(F.versions[0]));
  return instantsClesIV(resultat0.ligne, F.carte as never);
};

const VIDEO = "v-b54bb4798246";
const FICHIER = "studio/x/videos/v/a-9x16.mp4";
const VERSION = "fin-youtube-shorts";

describe("instants clés de la version 0", () => {
  it("24 instants, le dernier est la fin à 68,7 s", () => {
    const inst = instants24();
    expect(inst).toHaveLength(24);
    const dernier = inst[inst.length - 1]!;
    expect(dernier.sorte).toBe("fin");
    expect(dernier.instantSec).toBe(68.7);
  });
});

describe("idTravailControleIV", () => {
  it("dépend des instants, stable pour deux appels identiques, conforme à l'id accepté par le serveur de rendu", () => {
    const inst = instants24();
    const complet = demandeImagesControleIV(VIDEO, VERSION, FICHIER, inst);
    const court = demandeImagesControleIV(VIDEO, VERSION, FICHIER, inst.slice(0, 23));
    const id = idTravailControleIV(VIDEO, complet);
    expect(id).not.toBe(idTravailControleIV(VIDEO, court));
    expect(idTravailControleIV(VIDEO, demandeImagesControleIV(VIDEO, VERSION, FICHIER, inst))).toBe(id);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,200}$/);
    expect(id.startsWith("iv-controle-")).toBe(true);
  });
});

describe("imagesExtraitesIV", () => {
  it("ne rend que les images listées dont la clé est celle de la demande", () => {
    const d = demandeImagesControleIV(VIDEO, VERSION, FICHIER, instants24().slice(0, 3));
    const K1 = d.parametres.cles["i01"]!;
    expect(imagesExtraitesIV({ images: [{ nom: "i01", cle: K1 }, { nom: "zz", cle: "x" }] }, d)).toEqual([{ nom: "i01", cle: K1 }]);
    expect(imagesExtraitesIV({ images: [{ nom: "i01", cle: "autre/cle.jpg" }] }, d)).toEqual([]);
  });
  it("forme inattendue : liste vide", () => {
    const d = demandeImagesControleIV(VIDEO, VERSION, FICHIER, instants24().slice(0, 3));
    for (const x of [undefined, null, {}, { images: "non" }, { images: [null, 3, { nom: 1, cle: 2 }] }, "texte", 12]) expect(imagesExtraitesIV(x, d)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* relireVersionIV avec un aligneur qui garde ses travaux              */
/* ------------------------------------------------------------------ */

type Demande = Parameters<OutilsRelectureIV["extraireImages"]>[0];

function monter(extraire?: (d: Demande, deposer: (cles: string[]) => void) => Promise<{ images: { nom: string; cle: string }[] }>) {
  /** Aligneur simulé : le premier dépôt d'un id gagne (travaux gardés 24 h). */
  const travaux = new Map<string, { nom: string; cle: string }[]>();
  const deposees = new Set<string>(["source.png"]);
  const deposer = (cles: string[]) => cles.forEach((c) => deposees.add(c));
  let n = 0;
  const o: OutilsRelectureIV = {
    extraireImages: async (d) => {
      if (extraire) return extraire(d, deposer);
      const id = idTravailControleIV(VIDEO, d);
      if (!travaux.has(id)) {
        travaux.set(id, Object.entries(d.parametres.cles).map(([nom, cle]) => ({ nom, cle })));
        deposer(Object.values(d.parametres.cles));
      }
      return { images: travaux.get(id)! };
    },
    lireImage: async (cle) => (deposees.has(cle) ? { octets: new TextEncoder().encode(cle), type: "image/jpeg" as const } : null),
    appeler: async (role, entree) => ({ ok: true, simule: true, donnees: role.simuler(entree) as RelectureFinale }),
    budget: { reserver: async () => ({ ok: true as const }) },
    idAppel: (p) => `${p}-${++n}`,
  };
  return { o };
}

const entreeRelecture = (instants: readonly InstantCleIV[]): EntreeRelectureIV => ({
  videoId: VIDEO,
  version: VERSION,
  reseaux: ["youtube-shorts"],
  carte: { titre: "Facturation J+30", noeuds: [], chiffres: [], phraseChoc: "Phrase.", image: { cle: "source.png" } } as never,
  fichierCle: FICHIER,
  empreinteFichier: "final-abc",
  instants,
  depenseAutorisee: true,
});

describe("relireVersionIV : l'aligneur garde ses travaux", () => {
  it("23 instants puis 24 : le second relit 24 images et passe", async () => {
    const inst = instants24();
    const { o } = monter();
    const a = await relireVersionIV(entreeRelecture(inst.slice(0, 23)), o);
    expect(a.q26.ok).toBe(true);
    const b = await relireVersionIV(entreeRelecture(inst), o);
    expect(b.q26.ok).toBe(true);
    expect(b.remarques).toEqual([]);
    expect(b.relecture?.images).toHaveLength(24);
  });
});

describe("relireVersionIV : une image de contrôle manquante n'arrête plus la vidéo", () => {
  /** Dépose toutes les images mais n'en liste que `gardees` (comme un aligneur qui n'en a rendu qu'une partie). */
  const partielle = (gardees: number) => async (d: Demande, deposer: (cles: string[]) => void) => {
    deposer(Object.values(d.parametres.cles));
    return { images: d.parametres.instants.slice(0, gardees).map((i) => ({ nom: i.nom, cle: d.parametres.cles[i.nom]! })) };
  };

  it("23 sur 24 : ok, remarque « 68,7 s » et « (détail, la vidéo continue) »", async () => {
    const { o } = monter(partielle(23));
    const r = await relireVersionIV(entreeRelecture(instants24()), o);
    expect(r.q26.ok).toBe(true);
    const remarque = r.remarques.join(" ");
    expect(remarque).toContain("68,7 s");
    expect(remarque).toContain("(détail, la vidéo continue)");
    expect(r.relecture?.images).toHaveLength(23);
  });

  it("10 sur 24 : remarque « images finales non relues », la vidéo continue", async () => {
    const { o } = monter(partielle(10));
    const r = await relireVersionIV(entreeRelecture(instants24()), o);
    expect(r.q26.ok).toBe(true);
    expect(r.remarques.join(" ")).toMatch(/images finales non relues.*\(détail, la vidéo continue\)/);
    expect(r.appels).toBe(0);
  });

  it("aucune image : remarque, la vidéo continue si le rendu n'est pas suspect", async () => {
    const { o } = monter(async () => ({ images: [] }));
    const r = await relireVersionIV(entreeRelecture(instants24()), o);
    expect(r.q26.ok).toBe(true);
    expect(r.remarques.join(" ")).toMatch(/images finales non relues : aucune image de contrôle/);
  });

  it("aucune image ET rendu suspect : refus", async () => {
    const { o } = monter(async () => ({ images: [] }));
    const r = await relireVersionIV({ ...entreeRelecture(instants24()), renduSuspect: true }, o);
    expect(r.q26.ok).toBe(false);
    expect(r.q26.details.join(" ")).toMatch(/aucune image de contrôle/);
  });

  it("extraction qui lève : remarque, la vidéo continue (refus seulement si le rendu est suspect)", async () => {
    const { o } = monter(async () => {
      throw new Error("serveur de rendu indisponible");
    });
    const r = await relireVersionIV(entreeRelecture(instants24()), o);
    expect(r.q26.ok).toBe(true);
    expect(r.remarques.join(" ")).toMatch(/images finales non relues.*serveur de rendu indisponible/);
    const suspect = await relireVersionIV({ ...entreeRelecture(instants24()), renduSuspect: true }, o);
    expect(suspect.q26.ok).toBe(false);
  });

  it("panne de Claude après extraction : remarque, la vidéo continue même si le rendu est suspect", async () => {
    const { o } = monter();
    const r = await relireVersionIV({ ...entreeRelecture(instants24()), renduSuspect: true }, { ...o, appeler: async () => ({ ok: false as const, arret: "panne", message: "Claude indisponible" }) });
    expect(r.q26.ok).toBe(true);
    expect(r.remarques.join(" ")).toMatch(/images finales non relues.*Claude indisponible/);
  });
});

describe("rôle de relecture", () => {
  it("version 3 (les relectures reprises de la version 2 sont invalidées)", () => {
    expect(roleRelectureFinale.version).toBe(3);
  });
});
