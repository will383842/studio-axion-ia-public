/**
 * GV-ST-03 · Image → vidéo : le style de sous-titres choisi dans la Bibliothèque fait loi ; sans choix, charte duo sans
 * tirage par version. Ne dépend pas de `studio-rendu` (passe avec ou sans ses dépendances).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { baseRetenue } from "@/briques/sous-titres";
import { MISE_EN_PAGE_IV } from "@/briques/schema-motion/types";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import type { ValeurStyleSousTitres } from "@/domaine/types";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { controlerMiseEnSceneIV } from "@/moteurs/montage-image-video/controles-scene";
import { demandeDeLaCommande } from "@/moteurs/montage-image-video";
import { entreesMiseEnSceneIV, idRenduAvecStyleIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { codeSousTitresIV, sousTitresVariesIV, STYLE_SOUS_TITRES_IV, styleRetenuIV, VARIANTE_PAR_VERSION, type StyleChoisiIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { CENTRE_SOUS_TITRES_IV_4X5_PCT, commandeDuMontageIV } from "@/services/image-video-rendu";
import { planDesFinsAvant as planDesFinsIV } from "./plan-des-fins-avant";

vi.mock("server-only", () => ({}));

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));

function ligneDe(sousTitres?: RecetteVarieteIV["sousTitres"], format?: "4:5") {
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(format ? { format } : {}), ...(sousTitres ? { variete: { ...RECETTE_REFERENCE_IV, sousTitres } } : {}) }).ligne;
}

const KARAOKE: StyleChoisiIV = {
  id: "sous-titres-karaoke",
  nom: "Karaoké",
  valeur: { ...(STYLE_SOUS_TITRES_IV as unknown as ValeurStyleSousTitres), gabarit: "karaoke", police: "Police du style Karaoké", positionPct: 50 },
};

describe("GV-ST-03 · style retenu", () => {
  it("sans style choisi : la charte duo, 9:16 inchangé, 4:5 centré dans sa bande", () => {
    expect(styleRetenuIV(undefined, "9:16")).toEqual({ valeur: STYLE_SOUS_TITRES_IV, deplace: false, choisi: false });
    expect(styleRetenuIV(null, "4:5").valeur.positionPct).toBe(CENTRE_SOUS_TITRES_IV_4X5_PCT);
    expect(styleRetenuIV({ id: "x", nom: "sans valeur" }, "9:16").choisi).toBe(false);
  });

  it("Karaoké choisi : base karaoké et police du style", () => {
    const r = styleRetenuIV(KARAOKE, "9:16");
    expect(r.choisi).toBe(true);
    expect(r.valeur.police).toBe("Police du style Karaoké");
    expect(baseRetenue(undefined, r.valeur)).toBe("karaoke");
  });

  it("position hors bande : ramenée dans la bande ; dans la bande : gardée", () => {
    const b = MISE_EN_PAGE_IV["4:5"].bandeSousTitres;
    const bas = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 95 } }, "4:5");
    expect(bas.deplace).toBe(true);
    expect(bas.valeur.positionPct).toBeCloseTo(b.bas * 100, 1);
    const haut = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 5 } }, "4:5");
    expect(haut.deplace).toBe(true);
    expect(haut.valeur.positionPct).toBeCloseTo(b.haut * 100, 1);
    const dedans = styleRetenuIV({ ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: ((b.haut + b.bas) / 2) * 100 } }, "4:5");
    expect(dedans.deplace).toBe(false);
  });
});

describe("GV-ST-03 · commande du montage", () => {
  const piste = { mots: [{ mot: "bonjour", debutSec: 0, finSec: 1 }] } as never;
  const mixage = { bruitages: [] } as never;
  it("sans style : « Charte duo » comme avant", () => {
    const ligne = ligneDe();
    const c = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste }, [], []);
    expect(c.styles.sousTitres?.id).toBe("sous-titres-duo");
    expect(c.styles.sousTitres?.valeur).toEqual(STYLE_SOUS_TITRES_IV);
  });
  it("Karaoké choisi : la commande porte le style choisi, position ramenée dans la bande si besoin", () => {
    const ligne = ligneDe();
    const c = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste, styleSousTitres: KARAOKE }, [], []);
    expect(c.styles.sousTitres?.id).toBe("sous-titres-karaoke");
    expect((c.styles.sousTitres?.valeur as ValeurStyleSousTitres).gabarit).toBe("karaoke");
    const hors = commandeDuMontageIV({ videoId: "v", ligne, mixage, piste, styleSousTitres: { ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 99 } } }, [], []);
    expect((hors.styles.sousTitres?.valeur as ValeurStyleSousTitres).positionPct).toBeLessThan(99);
  });
});

describe("GV-ST-03 · plus de tirage par version", () => {
  it("tirage éteint par défaut", () => {
    expect(VARIANTE_PAR_VERSION).toBe(false);
  });
  it("deux versions (recettes SOU-B, SOU-C, SOU-D, SOU-E) : mêmes sous-titres", () => {
    const ref = JSON.stringify(sousTitresVariesIV(ligneDe("SOU-B")));
    for (const code of ["SOU-C", "SOU-D", "SOU-E"] as const) {
      const l = ligneDe(code);
      expect(codeSousTitresIV(l)).toBeUndefined();
      const sortie = sousTitresVariesIV(l).map((s) => ({ debutSec: s.debutSec, finSec: s.finSec, mots: s.mots.map((m) => m.mot) }));
      const attendu = sousTitresVariesIV(ligneDe("SOU-B")).map((s) => ({ debutSec: s.debutSec, finSec: s.finSec, mots: s.mots.map((m) => m.mot) }));
      expect(sortie, code).toEqual(attendu);
    }
    expect(ref.length).toBeGreaterThan(2);
  });
});

/* GV-ST-03b · le style choisi est relié jusqu'au rendu et jusqu'au contrôle Q22. */
const commandeAvec = (sousTitres?: unknown) =>
  ({ videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: "Une idée", reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" }, styles: { sousTitres: sousTitres ?? null } }) as never;

describe("GV-ST-03b · demande de fabrication", () => {
  it("style choisi : la demande le porte (id, nom, valeur) et le rendu le reçoit", () => {
    const d = demandeDeLaCommande(commandeAvec({ id: KARAOKE.id, nom: KARAOKE.nom, valeur: KARAOKE.valeur }), "ver-1");
    expect(d.styleSousTitres).toEqual({ id: KARAOKE.id, nom: KARAOKE.nom, valeur: KARAOKE.valeur });
    // Ce que la fabrication envoie au rendu (fabrication.ts : demandeRendu.styleSousTitres) donne la commande du montage karaoké.
    const piste = { mots: [{ mot: "bonjour", debutSec: 0, finSec: 1 }] } as never;
    const c = commandeDuMontageIV({ videoId: "v", ligne: ligneDe(), mixage: { bruitages: [] } as never, piste, styleSousTitres: d.styleSousTitres }, [], []);
    expect(c.styles.sousTitres?.id).toBe("sous-titres-karaoke");
    expect((c.styles.sousTitres?.valeur as ValeurStyleSousTitres).gabarit).toBe("karaoke");
  });

  it("sans style choisi (null, absent ou sans valeur) : aucune clé styleSousTitres, la demande d'avant", () => {
    for (const st of [undefined, null, { id: "x", nom: "sans valeur" }]) {
      const d = demandeDeLaCommande(commandeAvec(st), "ver-1");
      expect(d).not.toHaveProperty("styleSousTitres");
    }
    const sans = { videoId: "v", entrees: { imageVideo: { imageCle: "texte:x", texte: "Une idée", reseaux: ["instagram"] } }, reglages: { validationCarte: "automatique" }, styles: {} } as never;
    expect(demandeDeLaCommande(sans, "ver-1")).not.toHaveProperty("styleSousTitres");
  });

  it("sans style : le rendu et les empreintes restent ceux d'avant (sous-titres sans recette, empreinte figée)", () => {
    // L'empreinte figée « sans recette » (6 cartes × 4 réseaux) reste vérifiée par variete/sous-titres.test.ts ; ici, sans style
    // exploitable, le paramètre « choisi » ne change aucun octet.
    const a = JSON.stringify(sousTitresVariesIV(ligneDe()));
    expect(JSON.stringify(sousTitresVariesIV(ligneDe(), null))).toBe(a);
    expect(JSON.stringify(sousTitresVariesIV(ligneDe(), { id: "x", nom: "sans valeur" }))).toBe(a);
  });
});

describe("GV-ST-03b · Q22 mesure avec le style choisi", () => {
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const voix = pisteSimulee(fiche, fin.muet ? null : fin);
  const ligne = ligneDe();
  const ctx = (styleSousTitres?: StyleChoisiIV) => ({
    carte, fiche, reseaux: fin.reseaux, voix: voix.mots,
    bruitages: { ok: true, bruitages: ligne.bruitages, rapport: { changementsSansSon: [] } } as never,
    ...(styleSousTitres ? { styleSousTitres } : {}),
  });
  const q22 = (st?: StyleChoisiIV) => controlerMiseEnSceneIV(ligne, ctx(st)).lignes.find((l) => l.code === "Q22")!;

  it("un style démesuré fait sortir les sous-titres de la bande : Q22 rouge avec le style, vert sans", () => {
    const enorme: StyleChoisiIV = { id: "enorme", nom: "Énorme", valeur: { ...KARAOKE.valeur!, taillePx: 260, tailleRelative: 3, positionPct: 50 } };
    expect(q22().ok).toBe(true);
    expect(q22(enorme).ok).toBe(false);
  });

  it("sans style : même résultat qu'avant (charte duo)", () => {
    expect(q22(undefined).details).toEqual(q22().details);
  });
});

describe("GV-ST-03c · la mise en scène transmet le style au contrôle", () => {
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const entree = { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
  const q22 = (st?: StyleChoisiIV) => mettreEnSceneIV({ ...entree, ...(st ? { styleSousTitres: st } : {}) }).rapport.lignes.find((l) => l.code === "Q22")!;
  const enorme: StyleChoisiIV = { id: "enorme", nom: "Énorme", valeur: { ...KARAOKE.valeur!, taillePx: 260, tailleRelative: 3, positionPct: 50 } };

  it("avec un style choisi, le contrôle appelé depuis la mise en scène le reçoit (Q22 rouge)", () => {
    expect(q22().ok).toBe(true);
    expect(q22(enorme).ok).toBe(false);
  });

  it("sans style : mêmes détails qu'avant", () => {
    expect(q22(undefined).details).toEqual(controlerMiseEnSceneIV(mettreEnSceneIV(entree).ligne, { carte, fiche, reseaux: fin.reseaux, voix: entree.voix.mots, bruitages: { ok: true, bruitages: mettreEnSceneIV(entree).ligne.bruitages, rapport: { changementsSansSon: [] } } as never }).lignes.find((l) => l.code === "Q22")!.details);
  });
});

/** GV-ST-03e : l'état minimal que lit `sceneDe` (travail réel rejoué, comme recit-bulle-sans-collision). */
const FX = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/recit-c-bulle.json"), "utf8")) as { videoId: string; reseaux: string[]; carte: unknown; fiche: unknown; fins: unknown[]; recette: unknown; pistes: unknown[] };
const etatAvec = (styleSousTitres?: StyleChoisiIV) =>
  ({
    script: { fiche: FX.fiche },
    plan: { fins: FX.fins, sansFin: [], reduites: [] },
    carte: { carte: FX.carte },
    pistes: FX.pistes,
    courtes: [],
    variete: { recette: FX.recette },
    demande: { videoId: FX.videoId, reseaux: FX.reseaux, ...(styleSousTitres ? { styleSousTitres } : {}) },
  }) as unknown as EtatFabricationIV;

describe("GV-ST-03e · la mise en scène reçoit le style choisi", () => {
  it("avec un style choisi : l'entrée de chaque version porte le style", () => {
    const entrees = entreesMiseEnSceneIV(etatAvec(KARAOKE));
    expect(entrees.length).toBeGreaterThan(0);
    for (const x of entrees) expect(x.entree.styleSousTitres).toEqual(KARAOKE);
  });
  it("sans style (ou style sans valeur) : entrée strictement identique à celle d'avant, aucune clé en plus", () => {
    const sans = entreesMiseEnSceneIV(etatAvec());
    for (const x of sans) expect("styleSousTitres" in x.entree).toBe(false);
    const sansValeur = entreesMiseEnSceneIV(etatAvec({ id: "x", nom: "sans valeur" }));
    for (const [i, x] of sansValeur.entries()) {
      expect("styleSousTitres" in x.entree).toBe(false);
      expect(JSON.stringify(x.entree)).toBe(JSON.stringify(sans[i].entree));
    }
  });
  it("la ligne de temps (donc les empreintes de scène) ne change pas avec le style", () => {
    const a = entreesMiseEnSceneIV(etatAvec()).map((x) => JSON.stringify(mettreEnSceneIV(x.entree).ligne));
    const b = entreesMiseEnSceneIV(etatAvec(KARAOKE)).map((x) => JSON.stringify(mettreEnSceneIV(x.entree).ligne));
    expect(b).toEqual(a);
  });
});

describe("GV-ST-03e · identifiant de rendu avec style : seule la valeur compte", () => {
  const base = "iv-rendu-abc";
  it("même valeur, nom et id différents : même identifiant", () => {
    expect(idRenduAvecStyleIV(base, KARAOKE)).toBe(idRenduAvecStyleIV(base, { ...KARAOKE, id: "autre-id", nom: "Renommé" }));
  });
  it("valeurs différentes : identifiants différents", () => {
    expect(idRenduAvecStyleIV(base, KARAOKE)).not.toBe(idRenduAvecStyleIV(base, { ...KARAOKE, valeur: { ...KARAOKE.valeur!, positionPct: 60 } }));
  });
  it("garde le préfixe de l'identifiant sans style", () => {
    expect(idRenduAvecStyleIV(base, KARAOKE).startsWith(`${base}-`)).toBe(true);
  });
});
