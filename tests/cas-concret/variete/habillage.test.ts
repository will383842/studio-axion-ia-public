/**
 * Variantes visibles : entrée, sortie, caméra, transition et mot par mot DESSINÉS (`Habillage`), maquettes d'ouverture,
 * maquettes rares, anti-répétition des écrans résultat et question sur 3 vidéos, répartition sur 300 identifiants, vidéos
 * déjà faites inchangées. Le rendu est réel (HTML de `Ecran`, horloge de Remotion remplacée) ; aucun appel.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { disposer, imagesEcran, proprietesEcrans, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import {
  ajouterAHistorique,
  DIMENSIONS_HABILLAGE,
  entreeHistorique,
  jeuDeLEcran,
  MAQUETTE_DE_L_OUVERTURE,
  mettre,
  OUVERTURES,
  schemaMise,
  tirer,
  VARIANTES_RENDUES,
  type EcranAMettre,
  type EntreeHistorique,
  type Mise,
} from "@/moteurs/montage-cas-concret/variete";
import { MISES_EN_PAGE_L6 } from "@/briques/ecrans-motion/mises-en-page";
import { exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { DERIVE_MAX_PX, ECHELLE_CAMERA_MAX, habille, MONTEE_CASCADE_PX, NEUTRE, planHabillage, styleMotParMot } from "../../../studio-rendu/compositions/cas-concret/plans/habillage";

const horloge = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<typeof import("../../../studio-rendu/node_modules/remotion")>();
  // @ts-expect-error -- studio-rendu n'installe pas les types de React (ce sont ceux de la racine).
  const { createElement: element } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
  return { ...vrai, Img: (p: Record<string, unknown>) => element("img", p), useCurrentFrame: () => horloge.image, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 75, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
// @ts-expect-error -- studio-rendu n'installe pas les types de React (ce sont ceux de la racine).
const { createElement } = (await import("../../../studio-rendu/node_modules/react/index.js")) as typeof import("react");
// @ts-expect-error -- idem pour react-dom.
const { renderToStaticMarkup } = (await import("../../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server");
const { Ecran } = await import("../../../studio-rendu/compositions/cas-concret/Ecran");

const rendu = (p: ProprietesEcran, image: number) => {
  horloge.image = image;
  return renderToStaticMarkup(createElement(Ecran, p));
};
const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

/** Tous les écrans d'exemple, pleine image 9:16, avec un début > 0 (l'habillage ne touche pas le premier écran). */
const ecrans = (): ProprietesEcran[] => exemplesEcrans().map((p, i) => ({ ...p, debutMs: 3000 + i * 3000, finMs: 6000 + i * 3000 }));
const AVEC = (jeu: Record<string, string | number | boolean>) => ecrans().map((p) => ({ ...p, jeu }) as ProprietesEcran);

/* ------------------------------------------------------------------ */
describe("Habillage · plan pur", () => {
  const base = { debutMs: 3000 };
  it("sans jeu, valeurs v4 ou premier écran : neutre", () => {
    expect(planHabillage({ debutMs: 3000 }, 0.1, 3)).toBe(NEUTRE);
    expect(habille({ debutMs: 3000, jeu: undefined })).toBe(false);
    expect(habille({ debutMs: 3000, jeu: { fondFort: true } })).toBe(false);
    for (const jeu of [{ entree: "glissement" }, { transition: "eclair" }, { entree: "rideau", transition: "poussee" }]) {
      const h = planHabillage({ debutMs: 0, jeu }, 0, 3);
      expect(h).toEqual(NEUTRE);
    }
  });

  it("toutes les variantes rendues : valeurs bornées à toutes les images, et état final = écran posé", () => {
    for (const [dim, valeurs] of Object.entries(VARIANTES_RENDUES)) {
      if (dim === "motParMot") continue;
      for (const v of valeurs!) {
        for (let i = 0; i <= 75; i++) {
          const h = planHabillage({ ...base, jeu: { [dim]: v } }, i / 25, 3);
          expect(h.opacite).toBeGreaterThanOrEqual(0);
          expect(h.opacite).toBeLessThanOrEqual(1);
          expect(h.echelle).toBeGreaterThanOrEqual(1);
          expect(h.camera?.echelle ?? 1).toBeLessThanOrEqual(ECHELLE_CAMERA_MAX + 1e-9);
          expect(Math.abs(h.camera?.dx ?? 0)).toBeLessThanOrEqual(DERIVE_MAX_PX);
          if (h.voile) expect(h.voile.opacite).toBeLessThanOrEqual(1);
        }
        // Milieu de l'écran : ni entrée ni sortie ni transition en cours.
        const milieu = planHabillage({ ...base, jeu: { [dim]: v } }, 1.5, 3);
        if (dim !== "camera") expect({ ...milieu, camera: null }).toEqual(NEUTRE);
      }
    }
  });

  it("la transition l'emporte sur l'entrée ; un raccord L6 l'emporte sur entrée, transition, sortie et caméra", () => {
    const a = planHabillage({ ...base, jeu: { entree: "glissement", transition: "eclair" } }, 0.05, 3);
    expect(a.dx).toBe(0);
    expect(a.voile).not.toBeNull();
    const r = planHabillage({ ...base, jeu: { entree: "glissement", transition: "eclair", sortie: "flou", camera: "punch-in", raccordEntree: "objet", raccordSortie: "objet" } }, 0.05, 3);
    expect(r).toEqual(NEUTRE);
  });

  it("sortie : pas sur un écran trop court ; la caméra revient à son échelle de départ sur le zoom arrière", () => {
    expect(planHabillage({ ...base, jeu: { sortie: "poussee" } }, 0.95, 1)).toEqual(NEUTRE);
    expect(planHabillage({ ...base, jeu: { camera: "zoom-arriere" } }, 3, 3).camera!.echelle).toBeCloseTo(1, 6);
  });

  it("mot par mot : cascade et souffle ne changent que la montée et le flou ; v4 : null", () => {
    expect(styleMotParMot({ motParMot: "v4" })).toBeNull();
    expect(styleMotParMot(undefined)).toBeNull();
    expect(styleMotParMot({ motParMot: "cascade" })!.monteePx).toBeGreaterThan(60);
    expect(styleMotParMot({ motParMot: "souffle" })!.monteePx).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("Habillage · garde-fou de cadre : la caméra ne déborde ni du cadre ni sur les sous-titres", () => {
  // Les écrans du format : zone sûre des quatre réseaux, bande des sous-titres (8 %) en bas.
  const pleins = (): ProprietesEcran[] => {
    const cales: EcranCale[] = exemplesEcrans().map((p) => {
      const { zone: _z, dessin: _d, largeur: _l, hauteur: _h, fps: _f, marque: _m, ...reste } = p;
      void [_z, _d, _l, _h, _f, _m];
      return reste as unknown as EcranCale;
    });
    return proprietesEcrans({ ecrans: cales, captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET });
  };
  it("textes mis à l'échelle maximale (origine au centre de la zone utile) : dans le cadre, au-dessus de la bande des sous-titres", () => {
    const bandeHaut = 1920 * (1 - BANDE_SOUS_TITRES_CAS_CONCRET);
    let mesures = 0;
    for (const p of pleins()) {
      if (p.type === "liste-avant") continue; // jamais de caméra sur une liste qui se coche
      const cx = p.zone.x + p.zone.largeur / 2;
      const cy = p.zone.y + p.zone.hauteur / 2;
      for (const t of disposer(p).textes) {
        const b = t.boite;
        const s = ECHELLE_CAMERA_MAX;
        const gauche = cx + (b.x - cx) * s - DERIVE_MAX_PX;
        const droite = cx + (b.x + b.largeur - cx) * s + DERIVE_MAX_PX;
        const bas = cy + (b.y + b.hauteur - cy) * s;
        expect(gauche, `${p.type}/${t.nom} gauche`).toBeGreaterThanOrEqual(0);
        expect(droite, `${p.type}/${t.nom} droite`).toBeLessThanOrEqual(p.largeur);
        expect(bas, `${p.type}/${t.nom} bas`).toBeLessThanOrEqual(bandeHaut);
        mesures++;
      }
    }
    expect(mesures).toBeGreaterThan(20);
  });

  it("entrée « zoom-avant » : jamais au-dessus du plafond de la caméra, donc même cadre que le test précédent", () => {
    for (let i = 0; i <= 30; i++) expect(planHabillage({ debutMs: 3000, jeu: { entree: "zoom-avant" } }, i / 60, 3).echelle).toBeLessThanOrEqual(ECHELLE_CAMERA_MAX + 1e-9);
  });

  it("mot par mot « cascade » : un mot encore à sa montée maximale reste au-dessus de la bande des sous-titres", () => {
    const bandeHaut = 1920 * (1 - BANDE_SOUS_TITRES_CAS_CONCRET);
    const montee = styleMotParMot({ motParMot: "cascade" })!.monteePx;
    expect(montee).toBe(MONTEE_CASCADE_PX);
    let mesures = 0;
    for (const p of pleins()) {
      if (p.type === "liste-avant") continue;
      for (const t of disposer(p).textes) {
        expect(t.boite.y + t.boite.hauteur + montee, `${p.type}/${t.nom} bas`).toBeLessThanOrEqual(bandeHaut);
        mesures++;
      }
    }
    expect(mesures).toBeGreaterThan(20);
  });
});

/* ------------------------------------------------------------------ */
describe("Habillage · rendu réel de chaque variante", () => {
  const TOUS = Object.entries(VARIANTES_RENDUES).flatMap(([dim, valeurs]) => valeurs!.map((v) => [dim, v] as const));
  it("chaque variante se rend sur chaque type d'écran, à plusieurs images, sans valeur illisible ; l'état final est posé", () => {
    for (const [dim, v] of TOUS) {
      for (const p of AVEC({ [dim]: v })) {
        const n = imagesEcran(p);
        for (const image of [0, 3, 8, Math.floor(n / 2), n - 6, n - 1]) {
          const html = rendu(p, image);
          expect(html.length).toBeGreaterThan(200);
          expect(html, `${dim}=${v} ${p.type}@${image}`).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });

  it("au milieu de l'écran, une entrée, une sortie ou une transition ne laissent aucune trace dans le dessin (hors enveloppe)", () => {
    const sans = ecrans();
    for (const [dim, v] of TOUS.filter(([d]) => d === "entree" || d === "sortie" || d === "transition")) {
      AVEC({ [dim]: v }).forEach((p, i) => {
        const milieu = Math.floor(imagesEcran(p) / 2);
        const a = rendu(p, milieu);
        const b = rendu(sans[i]!, milieu);
        // L'enveloppe ajoute ses balises ; le contenu v4 y est intact (même texte, même ordre).
        expect(a.includes(b), `${dim}=${v} ${p.type}`).toBe(true);
      });
    }
  });

  it("la caméra bouge l'écran (rendu ≠ v4 à mi-écran), le premier écran n'est jamais habillé", () => {
    for (const p of AVEC({ camera: "zoom-lent" })) expect(rendu(p, 40)).not.toBe(rendu({ ...p, jeu: undefined }, 40));
    const premier = { ...exemplesEcrans()[0]!, jeu: { entree: "glissement", transition: "eclair" } } as ProprietesEcran;
    expect(rendu(premier, 0)).toBe(rendu({ ...premier, jeu: undefined }, 0));
  });

  it("mot par mot : cascade et souffle changent le dessin pendant l'écriture et pas une fois écrit", () => {
    const accroche = AVEC({ motParMot: "cascade" }).find((p) => p.type === "accroche")!;
    const v4 = { ...accroche, jeu: undefined } as ProprietesEcran;
    for (const m of ["cascade", "souffle"]) {
      const p = { ...accroche, jeu: { motParMot: m } } as ProprietesEcran;
      expect(rendu(p, 6)).not.toBe(rendu(v4, 6));
      expect(rendu(p, 70)).toBe(rendu(v4, 70));
    }
  });
});

/* ------------------------------------------------------------------ */
/* Tirage : répartition, déterminisme, anti-répétition, vidéos existantes */
/* ------------------------------------------------------------------ */

/** Vidéo type : le contenu de chaque écran porte les données de TOUTES les maquettes (nombre écrit, total, « chaque jour »). */
function videoRiche(): EcranAMettre[] {
  const exemples = Object.fromEntries(exemplesEcrans().map((p) => [p.type, p]));
  const contenu = (type: string, extra: Record<string, unknown> = {}) => ({ ...exemples[type]!, ...extra }) as never;
  const suite: [string, "sombre" | "ivoire", Record<string, unknown>][] = [
    ["accroche", "sombre", { lignes: ["On recrute 12 personnes", "en *une semaine*"] }],
    ["liste-avant", "ivoire", {}],
    ["titre", "sombre", { lignes: ["Alors on a", "*tout*"] }],
    ["etape", "ivoire", {}],
    ["etape", "sombre", {}],
    ["objet", "sombre", {}],
    ["chiffre", "ivoire", {}],
    ["preuve", "ivoire", {}],
    ["resultat", "sombre", { ligne: "chaque jour, sans y penser" }],
    ["question", "sombre", {}],
  ];
  return suite.map(([type, fond, extra], i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, type: type as EcranAMettre["type"], fond, contenu: contenu(type, { fond, ...extra }) }));
}

function chaine(n: number, prefixe = "v-hab", canaux = ["instagram"]): { mise: Mise; historique: EntreeHistorique[] }[] {
  let historique: EntreeHistorique[] = [];
  const out: { mise: Mise; historique: EntreeHistorique[] }[] = [];
  const ecransMis = videoRiche();
  for (let i = 0; i < n; i++) {
    const videoId = `${prefixe}-${i}`;
    const avant = historique;
    const mise = mettre(tirer({ videoId, canaux, historique }), ecransMis, historique, canaux);
    historique = ajouterAHistorique(historique, entreeHistorique(videoId, canaux, mise.tirage, "2026-10-26T12:00:00.000Z"));
    out.push({ mise, historique: avant });
  }
  return out;
}
const SERIE300 = chaine(300);

describe("Variété · 300 identifiants simulés", () => {
  const parts = (valeurs: string[]) => {
    const n = new Map<string, number>();
    for (const v of valeurs) n.set(v, (n.get(v) ?? 0) + 1);
    return [...n.entries()].map(([k, c]) => [k, c / valeurs.length] as const);
  };
  it("aucune variante dominante (> 40 %) : ouverture, structure, entrée, sortie, mot par mot, caméra, type de transition, jeu d'animation", () => {
    const dims: Record<string, string[]> = {
      ouverture: SERIE300.map((s) => s.mise.tirage.ouverture),
      structure: SERIE300.map((s) => s.mise.tirage.structure),
      jeuAnimation: SERIE300.map((s) => s.mise.tirage.jeuAnimation),
      sortie: SERIE300.map((s) => s.mise.tirage.sortie),
      motParMot: SERIE300.map((s) => s.mise.tirage.motParMot),
      camera: SERIE300.map((s) => s.mise.tirage.camera.style),
      fondFort: SERIE300.map((s) => String(s.mise.tirage.fondFort)),
      transitions: SERIE300.flatMap((s) => s.mise.tirage.transitions.map((t) => t.type)),
      entreeEcrans: SERIE300.flatMap((s) => Object.values(s.mise.ecrans).map((e) => e.entree)),
    };
    for (const [nom, valeurs] of Object.entries(dims)) for (const [v, part] of parts(valeurs)) expect(part, `${nom}=${v}`).toBeLessThanOrEqual(0.4);
  });

  it("maquettes : aucune ne dépasse 40 % des écrans de son type (types à 3 maquettes et plus), toutes les maquettes valides sont tirées", () => {
    const parType = new Map<string, string[]>();
    const vus = new Set<string>();
    const ecransMis = videoRiche();
    for (const { mise } of SERIE300)
      for (const e of ecransMis) {
        const code = mise.ecrans[e.id]!.miseEnPage;
        (parType.get(e.type) ?? parType.set(e.type, []).get(e.type)!).push(code);
        vus.add(code);
      }
    const rapport: Record<string, unknown> = {};
    for (const [type, codes] of parType) {
      const p = parts(codes);
      rapport[type] = Object.fromEntries(p.map(([k, v]) => [k, +v.toFixed(2)]));
      if (p.length >= 4) for (const [k, part] of p) expect(part, `${type}:${k}`).toBeLessThanOrEqual(0.4);
    }
    // Les trois maquettes qui n'étaient jamais vues, et toutes les autres.
    for (const c of ["res-mois-rempli", "acc-duel-tailles", "ava-cadran", "que-champ-reponse", "que-geante", "res-coupe-deux"]) expect(vus.has(c), c).toBe(true);
    // Types à 3 maquettes L6 (accroche comprise, malgré le poids de l'ouverture) : aucune n'étouffe les autres.
    for (const [type, codes] of Object.entries(MISES_EN_PAGE_L6)) {
      if (codes.length !== 3) continue;
      const p = parts(parType.get(type)!);
      for (const c of codes) expect(p.find(([k]) => k === c)?.[1] ?? 0, `${type}:${c} tirée`).toBeGreaterThan(0.05);
      for (const [k, part] of p) expect(part, `${type}:${k}`).toBeLessThanOrEqual(0.5);
    }
    console.info("répartition des maquettes par type (300 vidéos) :", JSON.stringify(rapport));
  });

  it("l'ouverture dessinée : l'accroche porte la maquette de l'ouverture tirée quand elle est possible, jamais la v4", () => {
    let voulues = 0;
    for (const { mise } of SERIE300) {
      const code = mise.ecrans.e01!.miseEnPage;
      expect(code).not.toBe("v4-centree");
      if (code === MAQUETTE_DE_L_OUVERTURE[mise.tirage.ouverture]) voulues++;
    }
    expect(voulues / SERIE300.length).toBeGreaterThan(0.5);
    expect(new Set(OUVERTURES.map((o) => MAQUETTE_DE_L_OUVERTURE[o])).size).toBe(3);
  });

  it("déterminisme : même vidéo, même historique → même mise, mêmes empreintes", () => {
    const a = chaine(40, "v-det");
    const b = chaine(40, "v-det");
    expect(empreinte(a.map((s) => s.mise))).toBe(empreinte(b.map((s) => s.mise)));
    for (const { mise } of a) expect(schemaMise.safeParse(mise).success).toBe(true);
  });

  it("anti-répétition : résultat et question ne portent jamais la même maquette que la vidéo précédente (deux maquettes L6 au moins), et la v4 n'y sert pas de relais", () => {
    const ecransMis = videoRiche();
    const idResultat = ecransMis.find((e) => e.type === "resultat")!.id;
    const idQuestion = ecransMis.find((e) => e.type === "question")!.id;
    for (const id of [idResultat, idQuestion]) {
      let v4 = 0;
      let n = 0;
      for (let i = 1; i < SERIE300.length; i++) {
        const [avant, ici] = [SERIE300[i - 1]!.mise.ecrans[id]!, SERIE300[i]!.mise.ecrans[id]!];
        // Un écran au fond fort garde la v4 (contrainte, pas un choix de maquette) : non jugé.
        if (avant.fondFort || ici.fondFort) continue;
        n++;
        if (ici.miseEnPage === "v4-centree") v4++;
        expect(ici.miseEnPage, `${id}@${i}`).not.toBe(avant.miseEnPage);
      }
      expect(v4 / n, `${id} part de v4`).toBeLessThanOrEqual(0.1);
    }
  });
});

/** `jeuDeLEcran` de la mise de la fixture, tel que calculé par master avant ce lot (valeurs relevées, jamais recalculées ici). */
const JEUX_DE_MASTER = [{"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "acc-duel-tailles"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "ava-cartes-tombent"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "tit-mot-objet"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "eta-entrer-dedans", "animObjet": 1}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "eta-schema-feutre", "raccordEntree": "dedans-ivoire", "animObjet": 2}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "obj-etiquette-pend"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "chi-aplat-orange"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "pre-compter-objets", "raccordSortie": "objet"}, {"groupeParticules": 4, "densiteParticules": "dense", "barres": "proportionnelles", "miseEnPage": "res-mois-rempli", "raccordEntree": "objet"}, {"groupeParticules": 4, "densiteParticules": "dense", "miseEnPage": "que-geante"}];

describe("Vidéos déjà faites : rendu inchangé", () => {
  it("un tirage écrit avant ce lot (sans `habille`) ne pose aucune des cinq dimensions d'habillage", () => {
    const { mise } = chaine(1, "v-ancienne")[0]!;
    const { habille: _h, ...ancien } = mise.tirage;
    void _h;
    const vieille: Mise = { ...mise, tirage: ancien };
    for (const id of Object.keys(vieille.ecrans)) {
      const jeu = jeuDeLEcran(vieille, id) ?? {};
      for (const d of DIMENSIONS_HABILLAGE) expect(d in jeu, `${id}.${d}`).toBe(false);
    }
    // Et la même mise, relue avec `habille`, en pose au moins une (sinon le test ne prouve rien).
    const poses = Object.keys(mise.ecrans).filter((id) => DIMENSIONS_HABILLAGE.some((d) => d in (jeuDeLEcran(mise, id) ?? {})));
    expect(poses.length).toBeGreaterThan(0);
  });

  it("mise réelle écrite par master (avant ce lot, fixture figée) : le jeu de chaque écran est celui, fixe, que master en tirait", () => {
    const mise = schemaMise.parse(JSON.parse(readFileSync(new URL("./fixtures/mise-ecrite-par-master.json", import.meta.url), "utf8")));
    expect(mise.tirage.habille).toBeUndefined();
    const ids = Object.keys(mise.ecrans);
    expect(ids.map((id) => jeuDeLEcran(mise, id) ?? null)).toEqual(JEUX_DE_MASTER);
  });

  it("valeurs v4 et variantes non rendues jamais posées ; tirage v4 : aucun jeu", () => {
    const m = chaine(1, "v-v4")[0]!.mise;
    const sale: Mise = { ...m, ecrans: { e01: { ...m.ecrans.e01!, entree: "fondu-recul-v4", sortie: "aucune-v4", camera: "aucun", motParMot: "v4", transition: "raccord-objet" } } };
    expect(jeuDeLEcran(sale, "e01")).toEqual(expect.not.objectContaining({ entree: expect.anything() }));
    const jeu = jeuDeLEcran(sale, "e01") ?? {};
    for (const d of DIMENSIONS_HABILLAGE) expect(d in jeu).toBe(false);
  });
});
