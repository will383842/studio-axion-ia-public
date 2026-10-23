/**
 * L2 · socle de la graine (`variete.ts`) : même vidéo → même tirage ; vidéo suivante ≠ (≥ 4 dimensions sur 7) ;
 * anti-répétition sur une série simulée de 100 vidéos ; « autre tirage » ≠ ; variante n° 0 = v4 ; rien ne passe au rendu
 * tant qu'aucune dimension n'est active.
 */
import { describe, expect, it } from "vitest";
import {
  ajouterAHistorique,
  combinaison,
  contraintesNonTenues,
  differences,
  DIMENSIONS_ACTIVES,
  MISES_EN_PAGE,
  entreeHistorique,
  graineDe,
  jeuDeLEcran,
  lireHistorique,
  lireMise,
  mettre,
  miseDesEcrans,
  schemaMise,
  schemaTirage,
  TAILLE_HISTORIQUE,
  tirer,
  TIRAGE_V4,
  OUVERTURES,
  STRUCTURES,
  JEUX_ANIMATION,
  type EcranAMettre,
  type EntreeHistorique,
} from "@/moteurs/montage-cas-concret/variete";

const CANAUX = [["facebook", "instagram", "tiktok", "linkedin"], ["linkedin"], ["instagram", "tiktok"], ["facebook"]] as const;
const LE = "2026-10-15T12:00:00.000Z";

const ECRANS: EcranAMettre[] = [
  { id: "e01", type: "accroche" },
  { id: "e02", type: "liste-avant" },
  { id: "e03", type: "titre" },
  { id: "e04", type: "etape" },
  { id: "e05", type: "etape" },
  { id: "e06", type: "etape" },
  { id: "e07", type: "chiffre" },
  { id: "e08", type: "resultat" },
  { id: "e09", type: "preuve" },
  { id: "e10", type: "question" },
];

/** Série simulée : chaque vidéo tirée avec l'historique de celles d'avant. */
function serie(n: number, debut: readonly EntreeHistorique[] = []): EntreeHistorique[] {
  let historique = [...debut];
  const faites: EntreeHistorique[] = [];
  for (let i = 0; i < n; i++) {
    const videoId = `v-${(i * 2654435761).toString(16)}-${i}`;
    const canaux = CANAUX[i % CANAUX.length]!;
    const t = tirer({ videoId, canaux, historique });
    const e = entreeHistorique(videoId, canaux, t, LE);
    faites.push(e);
    historique = ajouterAHistorique(historique, e);
  }
  return faites;
}

describe("L2 · graine et tirage", () => {
  it("même videoId (et même historique) → même tirage, valide pour le schéma", () => {
    const a = tirer({ videoId: "v-52c3dd9b4f37", canaux: ["facebook"], historique: [] });
    const b = tirer({ videoId: "v-52c3dd9b4f37", canaux: ["facebook"], historique: [] });
    expect(a).toEqual(b);
    expect(schemaTirage.safeParse(a).success).toBe(true);
    expect(a.graine).toBe(graineDe("v-52c3dd9b4f37"));
    expect(a.sel).toBe(0);
  });

  it("la graine est stable (épinglée) et dépend de la vidéo", () => {
    expect(graineDe("v-52c3dd9b4f37")).toBe(graineDe("v-52c3dd9b4f37"));
    expect(graineDe("v-52c3dd9b4f37")).not.toBe(graineDe("v-52c3dd9b4f38"));
    expect(Number.isInteger(graineDe("x")) && graineDe("x") >= 0).toBe(true);
  });

  it("la vidéo suivante change au moins 4 dimensions sur 7", () => {
    const premiere = tirer({ videoId: "v-a", canaux: ["facebook", "linkedin"], historique: [] });
    const historique = [entreeHistorique("v-a", ["facebook", "linkedin"], premiere, LE)];
    const suivante = tirer({ videoId: "v-b", canaux: ["facebook"], historique });
    expect(differences(premiere, suivante)).toBeGreaterThanOrEqual(4);
    expect(suivante.ouverture).not.toBe(premiere.ouverture);
    expect(suivante.relache).toBe(0);
  });

  it("« autre tirage » (sel 1, 2) ≠ le premier, et ≠ entre eux", () => {
    const t0 = tirer({ videoId: "v-autre", canaux: ["instagram"], historique: [] });
    const h = [entreeHistorique("v-autre", ["instagram"], t0, LE)];
    const t1 = tirer({ videoId: "v-autre", canaux: ["instagram"], historique: h, sel: 1 });
    const t2 = tirer({ videoId: "v-autre", canaux: ["instagram"], historique: ajouterAHistorique(h, entreeHistorique("v-autre", ["instagram"], t1, LE)), sel: 2 });
    expect(t1.sel).toBe(1);
    expect(combinaison(t1)).not.toBe(combinaison(t0));
    expect(t1).not.toEqual(t0);
    expect(t2).not.toEqual(t1);
    // Même demande, même résultat.
    expect(tirer({ videoId: "v-autre", canaux: ["instagram"], historique: h, sel: 1 })).toEqual(t1);
  });

  it("la ligne de la vidéo elle-même (même sel) ne change pas son tirage", () => {
    const t = tirer({ videoId: "v-moi", canaux: ["facebook"], historique: [] });
    const h = [entreeHistorique("v-moi", ["facebook"], t, LE)];
    expect(tirer({ videoId: "v-moi", canaux: ["facebook"], historique: h })).toEqual(t);
  });
});

describe("L2 · anti-répétition sur 100 vidéos", () => {
  const faites = serie(100);

  it("jamais la même ouverture deux fois de suite sur un même canal", () => {
    const derniere = new Map<string, string>();
    for (const e of faites) {
      for (const c of e.canaux) {
        expect(derniere.get(c), `${e.videoId} sur ${c}`).not.toBe(e.tirage.ouverture);
        derniere.set(c, e.tirage.ouverture);
      }
    }
  });

  it("jamais la même combinaison (ouverture + structure + jeu + fond fort) sur 42 vidéos", () => {
    faites.forEach((e, i) => {
      const fenetre = faites.slice(Math.max(0, i - TAILLE_HISTORIQUE), i).map((x) => combinaison(x.tirage));
      expect(fenetre, e.videoId).not.toContain(combinaison(e.tirage));
    });
  });

  it("au moins 4 dimensions sur 7 différentes d'une vidéo à la suivante, sans relâche", () => {
    for (let i = 1; i < faites.length; i++) expect(differences(faites[i - 1]!.tirage, faites[i]!.tirage)).toBeGreaterThanOrEqual(4);
    expect(faites.every((e) => e.tirage.relache === 0)).toBe(true);
  });

  it("de la variété : ouvertures, structures et jeux bien répartis ; la structure v4 sous 40 %", () => {
    expect(new Set(faites.map((e) => e.tirage.ouverture)).size).toBe(OUVERTURES.length);
    expect(new Set(faites.map((e) => e.tirage.structure)).size).toBe(STRUCTURES.length);
    expect(new Set(faites.map((e) => e.tirage.jeuAnimation)).size).toBe(JEUX_ANIMATION.length);
    expect(faites.filter((e) => e.tirage.structure === STRUCTURES[0]).length).toBeLessThanOrEqual(40);
  });

  it("contraintes non tenues : relâchées dans l'ordre documenté, en un nombre borné d'essais, jamais en boucle", () => {
    // Historique de 42 vidéos toutes sur le même canal, et UN seul candidat par niveau : la relâche se voit.
    const historique = serie(42).map((e) => ({ ...e, canaux: ["facebook"] }));
    const niveaux = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const demande = { videoId: `v-serre-${i}`, canaux: ["facebook"], historique, essaisParNiveau: 1 };
      const t = tirer(demande);
      expect(t).toEqual(tirer(demande));
      expect(schemaTirage.safeParse(t).success).toBe(true);
      expect(contraintesNonTenues(t, demande, t.relache)).toEqual([]);
      niveaux.add(t.relache);
    }
    expect([...niveaux].some((n) => n > 0)).toBe(true);
    // Le niveau 3 n'impose que la règle « v4 au plus 1 fois sur 4 » : un candidat qui la tient est accepté, même identique
    // à la vidéo précédente ; un candidat qui la viole est refusé.
    const sansV4 = { ...historique.at(-1)!.tirage, ouverture: OUVERTURES[1], structure: STRUCTURES[1] };
    expect(contraintesNonTenues(sansV4, { videoId: "v-x", canaux: ["facebook"], historique }, 3)).toEqual([]);
    const avecV4 = historique.map((e, i) => (i === historique.length - 1 ? { ...e, tirage: { ...e.tirage, ouverture: OUVERTURES[0], structure: STRUCTURES[0] } } : e));
    expect(contraintesNonTenues({ ...sansV4, ouverture: OUVERTURES[0], structure: STRUCTURES[0] }, { videoId: "v-x", canaux: ["facebook"], historique: avecV4 }, 3)).toEqual([`affiche-v4 plus d'1 fois sur 4`, `structure v4 plus d'1 fois sur 4`]);
  });
});

describe("Lot C · v4 au plus 1 fois sur 4", () => {
  const fenetres = (l: readonly EntreeHistorique[]) => Array.from({ length: Math.max(0, l.length - 3) }, (_, i) => l.slice(i, i + 4));

  it("200 vidéos : toute fenêtre de 4 compte au plus 1 affiche-v4 et 1 structure v4 ; au plus 25 % au total", () => {
    const faites = serie(200);
    for (const f of fenetres(faites)) {
      expect(f.filter((e) => e.tirage.ouverture === OUVERTURES[0]).length).toBeLessThanOrEqual(1);
      expect(f.filter((e) => e.tirage.structure === STRUCTURES[0]).length).toBeLessThanOrEqual(1);
    }
    expect(faites.filter((e) => e.tirage.ouverture === OUVERTURES[0]).length).toBeLessThanOrEqual(50);
    expect(faites.filter((e) => e.tirage.structure === STRUCTURES[0]).length).toBeLessThanOrEqual(50);
  });

  it("même règle quand presque tous les niveaux sont mal servis (1 essai par niveau, repli compris)", () => {
    let historique: EntreeHistorique[] = [];
    const faites: EntreeHistorique[] = [];
    for (let i = 0; i < 100; i++) {
      const videoId = `v-serre-${i}`;
      const t = tirer({ videoId, canaux: ["facebook"], historique, essaisParNiveau: 1 });
      expect(schemaTirage.safeParse(t).success).toBe(true);
      const e = entreeHistorique(videoId, ["facebook"], t, LE);
      faites.push(e);
      historique = ajouterAHistorique(historique, e);
    }
    for (const f of fenetres(faites)) {
      expect(f.filter((e) => e.tirage.ouverture === OUVERTURES[0]).length).toBeLessThanOrEqual(1);
      expect(f.filter((e) => e.tirage.structure === STRUCTURES[0]).length).toBeLessThanOrEqual(1);
    }
  });

  it("déterministe, et la règle compte tous les canaux", () => {
    expect(serie(60)).toEqual(serie(60));
    const v4 = { ...serie(1)[0]!.tirage, ouverture: OUVERTURES[0], structure: STRUCTURES[1] };
    const historique = [entreeHistorique("v-a", ["linkedin"], v4, LE)];
    const candidat = { ...v4, ouverture: OUVERTURES[0] };
    // Autre canal que la vidéo précédente : la fenêtre de 4 compte quand même cette affiche-v4.
    expect(contraintesNonTenues(candidat, { videoId: "v-b", canaux: ["facebook"], historique }, 3)).toEqual([`affiche-v4 plus d'1 fois sur 4`]);
    // La 4e vidéo après une affiche-v4 est libre (la fenêtre de 4 ne la contient plus).
    const suite = [historique[0]!, ...["v-c", "v-d", "v-e"].map((id) => entreeHistorique(id, ["facebook"], { ...v4, ouverture: OUVERTURES[1] }, LE))];
    expect(contraintesNonTenues(candidat, { videoId: "v-f", canaux: ["facebook"], historique: suite }, 3)).toEqual([]);
  });
});

describe("L2 · historique", () => {
  it("42 lignes au plus, la ligne d'une vidéo remplacée, les lignes illisibles ignorées", () => {
    const faites = serie(50);
    let h: EntreeHistorique[] = [];
    for (const e of faites) h = ajouterAHistorique(h, e);
    expect(h).toHaveLength(42);
    expect(h.at(-1)!.videoId).toBe(faites.at(-1)!.videoId);
    const remplacee = ajouterAHistorique(h, { ...h[10]!, le: "2026-10-16T00:00:00.000Z" });
    expect(remplacee).toHaveLength(42);
    expect(remplacee.filter((e) => e.videoId === h[10]!.videoId)).toHaveLength(1);
    expect(remplacee.at(-1)!.le).toBe("2026-10-16T00:00:00.000Z");
    expect(lireHistorique([{ n: 1 }, ...h.slice(0, 3), "x", null])).toHaveLength(3);
    expect(lireHistorique(undefined)).toEqual([]);
    expect(lireHistorique({})).toEqual([]);
  });
});

describe("L2 · variante n° 0 = v4 et déclinaison par écran", () => {
  it("TIRAGE_V4 est valide et décline la v4 sur chaque écran", () => {
    expect(schemaTirage.safeParse(TIRAGE_V4).success).toBe(true);
    const m = miseDesEcrans(TIRAGE_V4, ECRANS);
    for (const e of ECRANS) expect(m[e.id]).toEqual({ miseEnPage: "v4-centree", entree: "fondu-recul-v4", sortie: "aucune-v4", motParMot: "v4", camera: "aucun" });
  });

  it("déclinaison déterministe ; pas de caméra sur la liste ; ni transition ni fond fort sur le premier écran ; 2 fonds forts au plus", () => {
    for (const f of serie(30)) {
      const a = mettre(f.tirage, ECRANS);
      expect(a).toEqual(mettre(f.tirage, ECRANS));
      expect(schemaMise.safeParse(a).success).toBe(true);
      expect(a.ecrans.e02!.camera).toBe("aucun");
      expect(a.ecrans.e01!.transition).toBeUndefined();
      expect(a.ecrans.e01!.fondFort).toBeUndefined();
      const forts = Object.values(a.ecrans).filter((x) => x.fondFort).length;
      expect(forts).toBeLessThanOrEqual(Math.min(2, f.tirage.fondFort));
      const bougent = Object.values(a.ecrans).filter((x) => x.camera !== "aucun").length;
      if (f.tirage.camera.style === "aucune-v4") expect(bougent).toBe(0);
      else expect(bougent / (ECRANS.length - 1)).toBeLessThanOrEqual(0.61);
    }
  });

  it("L3c : seules les dimensions actives passent aux propriétés des écrans ; la v4 n'en passe aucune", () => {
    expect(DIMENSIONS_ACTIVES).toEqual(["fondFort", "groupeParticules", "densiteParticules", "barres", "miseEnPage", "fondAlterne", "raccordEntree", "raccordSortie", "animObjet"]);
    // Tirage v4 : aucun jeu sur aucun écran (propriétés et empreintes de la v4).
    const v4 = mettre(TIRAGE_V4, ECRANS);
    for (const e of ECRANS) expect(jeuDeLEcran(v4, e.id)).toBeUndefined();
    expect(jeuDeLEcran(undefined, "e01")).toBeUndefined();
    // Sans dimension active (L2) : rien ne passe.
    const m = mettre(serie(1)[0]!.tirage, ECRANS);
    for (const e of ECRANS) expect(jeuDeLEcran(m, e.id, [])).toBeUndefined();
    // Une dimension activée passe seule.
    expect(jeuDeLEcran(m, "e01", ["entree"])).toEqual({ entree: m.ecrans.e01!.entree });
    // Les dimensions actives passent avec leurs valeurs, et rien d'autre.
    for (const f of serie(20)) {
      const mise = mettre(f.tirage, ECRANS);
      for (const e of ECRANS) {
        const jeu = jeuDeLEcran(mise, e.id);
        // L6 : une mise en page de L2 (jamais rendue) ne passe pas.
        const attendu = Object.fromEntries(DIMENSIONS_ACTIVES.filter((d) => mise.ecrans[e.id]![d] !== undefined && !(d === "miseEnPage" && (MISES_EN_PAGE as readonly string[]).includes(mise.ecrans[e.id]![d] as string))).map((d) => [d, mise.ecrans[e.id]![d]]));
        expect(jeu ?? {}).toEqual(attendu);
      }
    }
  });

  it("lireMise : valeur illisible → null", () => {
    expect(lireMise(null)).toBeNull();
    expect(lireMise({ version: "variete/9" })).toBeNull();
    const m = mettre(TIRAGE_V4, ECRANS);
    expect(lireMise(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});
