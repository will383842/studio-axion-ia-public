/**
 * N-04e (+ partie `types.ts` de N-04d) : le moteur du tableau pose `objets` sur les propriétés d'une scène SEULEMENT si la
 * commande permet des objets. Chemin réel : vraie `fabriquerTableau`, doubles du stockage et du rendu, aucune dépense.
 * Éteint = identique : empreintes de scènes relevées sur master 41fc7e4f AVANT le changement, écrites en dur.
 * Le rendu (`TableauScene.tsx`) ne lit pas encore `objets` : N-04d-b.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { OutilsFabrication } from "../../../src/moteurs/montage-tableau/fabriquer";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { ID } from "../../../src/briques/bibliotheque-video/noms";
import { PROFIL_TABLEAU_ANIME } from "../../../src/briques/bibliotheque-video/profils/tableau-anime";
import type { EntreeBibliotheque } from "../../../src/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "../../../src/briques/bibliotheque-video/version";
import { piecesPermisesDesEntrees } from "../../../src/briques/plan-scenes-objets/pieces-permises";
import { auStyleReference } from "../reference-1/fiches";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const FIN = { fin: "Enregistrez cette vidéo pour la refaire" };
/** Clés (nom de fichier) des scènes rendues, relevées sur master 41fc7e4f (page écrite, puis reference/1). */
const TEMOIN_PAGE = ["b79447c0fffe3d3fd68c16886aefb338.mp4", "56724138e20770da7d9d273eda1cc320.mp4", "a507472bc9f6cbdd9966b039cd917515.mp4", "b74e0158f4d4af620b55e9d759b9b118.mp4", "117d73db34c925efe987d8f81372556e.mp4", "b82b506bd7c1e497596ba96dc5134ca0.mp4", "548e58ce65d42a531bd0d5a812e7aacb.mp4"];
const TEMOIN_REF1 = ["ae1ecf3cb846a192b7f8b8136089455b.mp4", "7ed5c230dde32299dcc4c88af36b7619.mp4", "70ca8c9eee55f823eaefb77ca5ac3dc5.mp4", "5f77d80d9029ac27225204af3bd9a188.mp4", "8826f4b0920615052a8e26ad1bba5003.mp4", "dec1852a9aae9e8b58f12d236959ea56.mp4"];

/** Fiche de reference/1 où la 5e scène (s05, page encore vide) commence par dire « 3 clients ». */
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
  };
}

const entree = (permis: boolean): EntreeBibliotheque => ({
  version: VERSION_BIBLIOTHEQUE,
  profil: { ...PROFIL_TABLEAU_ANIME, capacites: { ...PROFIL_TABLEAU_ANIME.capacites, [ID.objetChiffre]: { permis, maxParVideo: 1, decision: "test" } } },
  recents: [],
  graine: "G",
  figeeLe: "2026-11-20",
});

describe("éteint = identique (empreintes de master 41fc7e4f)", () => {
  it("sans permis : mêmes empreintes de scènes, page écrite et reference/1, aucun champ objets", async () => {
    const page = await fabriquer(ficheDemonstration);
    const ref = await fabriquer(auStyleReference(ficheDemonstration));
    expect(page.cles).toEqual(TEMOIN_PAGE);
    expect(ref.cles).toEqual(TEMOIN_REF1);
    for (const p of [...page.proprietes, ...ref.proprietes]) expect("objets" in p).toBe(false);
  });
  it("permis vide, ou entrée bibliothèque sans `permis: true` : mêmes empreintes, même avec un nombre dit", async () => {
    const sans = await fabriquer(ficheAvecNombre());
    const vide = await fabriquer(ficheAvecNombre(), { objetsPermis: [] });
    expect(vide.cles).toEqual(sans.cles);
    expect([...sans.proprietes, ...vide.proprietes].some((p) => "objets" in p)).toBe(false);
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: entree(false) })).toEqual([]);
    expect(piecesPermisesDesEntrees({ bibliothequeVideo: entree(true) })).toContain("objet-gros-chiffre");
  });
});

describe("avec permis (profil de test objet.chiffre permis)", () => {
  it("un nombre dit : `objets` sur la bonne scène seulement, jamais un champ vide, empreinte de cette scène changée", async () => {
    const permis = [...piecesPermisesDesEntrees({ bibliothequeVideo: entree(true) })];
    const avant = await fabriquer(ficheAvecNombre());
    const apres = await fabriquer(ficheAvecNombre(), { objetsPermis: permis });
    const avec = apres.proprietes.filter((p) => "objets" in p);
    expect(avec).toHaveLength(1);
    expect(avec[0]!.objets!.length).toBeGreaterThan(0);
    expect(avec[0]!.objets![0]!.id).toBe("objet-gros-chiffre");
    expect(avec[0]!.scene.id).toBe("s05");
    for (const p of apres.proprietes) if ("objets" in p) expect(p.objets!.length).toBeGreaterThan(0);
    const changees = apres.cles.filter((c, i) => c !== avant.cles[i]);
    expect(changees).toHaveLength(1);
    expect(apres.cles.indexOf(changees[0]!)).toBe(apres.proprietes.indexOf(avec[0]!));
  });
});

describe("gardes statiques", () => {
  it("le rendu `TableauScene.tsx` lit `objets` (N-04d-b), livré éteint : rien tant qu'aucun objet", () => {
    const src = readFileSync(join(__dirname, "..", "..", "..", "studio-rendu", "compositions", "tableau", "TableauScene.tsx"), "utf8");
    expect(src).toContain("p.objets?.length");
    expect(src.match(/from "\.\/ObjetsTableau"/g)).toHaveLength(1);
  });
  it("index.ts ne branche les pièces permises que si la liste est non vide", () => {
    const src = readFileSync(join(__dirname, "..", "..", "..", "src", "moteurs", "montage-tableau", "index.ts"), "utf8");
    expect(src).toContain("piecesPermisesDesEntrees(commande.entrees)");
    expect(src).toMatch(/p\.length \? \{ objetsPermis: p \} : \{\}/);
  });
});
