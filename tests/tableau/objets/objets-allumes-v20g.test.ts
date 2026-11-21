/**
 * ALLUMER-OBJETS-TABLEAU-v20g (Williams 20/11 : fini + vérifié + gratuit = allumé par défaut).
 * Chaîne réelle : réglage de la bibliothèque absent en base → profil `tableau-anime` → pièces permises → VRAIE
 * `fabriquerTableau` (doubles du stockage et du rendu, aucun appel Claude, aucun euro). Modèle : `objets-branches.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { OutilsFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import { objetsDesScenes } from "../../../src/moteurs/montage-tableau/objets-tableau";
import { proprietesScenes } from "../../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, ProprietesTableauScene, SceneCalee } from "../../../src/briques/tableau-scene/types";
import type { MotMinute } from "../../../src/briques/plan-scenes/schema";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { lireReglageBibliotheque } from "../../../src/briques/bibliotheque-video/reglage";
import { PROFIL_TABLEAU_ANIME } from "../../../src/briques/bibliotheque-video/profils/tableau-anime";
import type { EntreeBibliotheque } from "../../../src/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "../../../src/briques/bibliotheque-video/version";
import { ID } from "../../../src/briques/bibliotheque-video/noms";
import { piecesPermisesDesEntrees } from "../../../src/briques/plan-scenes-objets/pieces-permises";
import { auStyleReference, caleeReguliere, ficheReference } from "../reference-1/fiches";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const FIN = { fin: "Enregistrez cette vidéo pour la refaire" };
const TROIS = [ID.objetChiffre, ID.objetEtape, ID.objetMarque];
const vide = async () => undefined;

const entreeProfil = (fermee = false): EntreeBibliotheque => ({
  version: VERSION_BIBLIOTHEQUE,
  profil: { ...PROFIL_TABLEAU_ANIME, capacites: { ...PROFIL_TABLEAU_ANIME.capacites, ...(fermee ? Object.fromEntries(TROIS.map((id) => [id, { permis: false, maxParVideo: 1 }])) : {}) } },
  recents: [],
  graine: "G",
  figeeLe: "2026-11-20",
});

function ficheAvecNombre() {
  const f = structuredClone(auStyleReference(ficheDemonstration));
  f.scenes[4]!.texteDit = `On a gagné 3 clients. ${f.scenes[4]!.texteDit}`;
  return f;
}

async function fabriquer(fiche: typeof ficheDemonstration, plus: Partial<OutilsFabrication> = {}) {
  const d = doubles(fiche, FIN);
  await fabriquerTableau({ ...d.outils, ...plus });
  const scenes = d.scenesSoumises();
  return {
    cles: scenes.map((s) => s.sortie.cle.split("/").pop()!),
    proprietes: scenes.map((s) => (s.parametres as unknown as { proprietes: ProprietesTableauScene }).proprietes),
    lectures: d.lectures(),
    soumises: d.soumises.length,
  };
}

const piecesParDefaut = () => piecesPermisesDesEntrees({ bibliothequeVideo: entreeProfil() });

describe("(a) réglage absent en base : le défaut du code ouvre les 3 objets", () => {
  it("réglage par défaut = 3 capacités ; un nombre dit sur une page à moitié vide → 1 gros chiffre, dans la place libre, hors bande des sous-titres", async () => {
    expect(await lireReglageBibliotheque("tableau-anime", vide)).toEqual({ actif: true, capacites: TROIS });
    const apres = await fabriquer(ficheAvecNombre(), { objetsPermis: piecesParDefaut() });
    const avec = apres.proprietes.filter((p) => "objets" in p);
    expect(avec).toHaveLength(1);
    expect(avec[0]!.scene.id).toBe("s05");
    const o = avec[0]!.objets![0]!;
    expect(o.id).toBe("objet-gros-chiffre");
    const z = avec[0]!.zoneSure.px;
    expect(o.boite.y).toBeGreaterThanOrEqual(z.y);
    expect(o.boite.y + o.boite.hauteur).toBeLessThanOrEqual(avec[0]!.bandeSousTitres.px.y);
  });
  it("seules les 3 pièces du tableau sont posées, même si la capacité en ouvre d'autres au registre", () => {
    const pieces = [...piecesParDefaut()];
    const f = ficheAvecNombre();
    const c = caleeReguliere(ficheReference("relances"), "relances");
    const mise = mettreEnPage(c.fiche, {});
    const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
    const mots: MotMinute[] = "on a gagné 3 clients".split(" ").map((texte, i) => ({ texte, debutMs: 13000 + i * 300, finMs: 13000 + i * 300 + 250 }));
    const r = objetsDesScenes({ proprietes: props, mots, permis: pieces });
    for (const liste of Object.values(r)) for (const o of liste) expect(["objet-gros-chiffre", "objet-etape", "objet-coche"]).toContain(o.id);
    expect(f.scenes.length).toBeGreaterThan(0);
  });
});

describe("(b) réglage false en base : rien posé, empreintes d'avant", () => {
  it("réglage false → éteint ; profil fermé → aucune pièce, aucune scène ne porte `objets`, empreintes identiques à l'absence de permis", async () => {
    expect(await lireReglageBibliotheque("tableau-anime", async () => false)).toEqual({ actif: false });
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: entreeProfil(true) })).toEqual([]);
    const sans = await fabriquer(ficheAvecNombre());
    const ferme = await fabriquer(ficheAvecNombre(), { objetsPermis: [...piecesPermisesDesEntrees({ bibliothequeVideo: entreeProfil(true) })] });
    expect(ferme.cles).toEqual(sans.cles);
    expect([...sans.proprietes, ...ferme.proprietes].some((p) => "objets" in p)).toBe(false);
  });
});

describe("(c) page pleine ou style v2 : aucun objet", () => {
  const c = caleeReguliere(ficheReference("relances"), "relances");
  const mise = mettreEnPage(c.fiche, {});
  const props = proprietesScenes({ miseEnPage: mise as unknown as MiseBrique, scenes: c.fiche.scenes as SceneCalee[], heures: c.elements, stylo: c.fiche.stylo, mots: c.mots });
  const dit = (debutMs: number): MotMinute[] => "on a gagné 3 clients".split(" ").map((texte, i) => ({ texte, debutMs: debutMs + i * 300, finMs: debutMs + i * 300 + 250 }));
  it("page pleine (s01) → abandonné", () => {
    expect(objetsDesScenes({ proprietes: props, mots: dit(1000), permis: [...piecesParDefaut()] })).toEqual({});
  });
  it("style v2 → aucun objet", () => {
    const v2 = props.map((p) => ({ ...p, v2: {} as never }));
    expect(objetsDesScenes({ proprietes: v2, mots: dit(13000), permis: [...piecesParDefaut()] })).toEqual({});
  });
});

describe("(d) au plus 1 objet par capacité et par vidéo", () => {
  it("deux nombres dits dans la même vidéo → un seul gros chiffre", async () => {
    const f = ficheAvecNombre();
    f.scenes[5]!.texteDit = `Et 5 rendez-vous. ${f.scenes[5]!.texteDit}`;
    const apres = await fabriquer(f, { objetsPermis: piecesParDefaut() });
    const gros = apres.proprietes.flatMap((p) => p.objets ?? []).filter((o) => o.id === "objet-gros-chiffre");
    expect(gros.length).toBeLessThanOrEqual(1);
  });
});

describe("(e) gratuit : aucun appel de plus, prix identique", () => {
  it("mêmes lectures de voix et mêmes demandes de rendu avec et sans objets", async () => {
    const avant = await fabriquer(ficheAvecNombre());
    const apres = await fabriquer(ficheAvecNombre(), { objetsPermis: piecesParDefaut() });
    expect(apres.lectures).toBe(avant.lectures);
    expect(apres.soumises).toBe(avant.soumises);
  });
});
