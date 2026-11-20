/** T-EXT-V2-08 : le pas « pièce créée » (pur). Aucun appel, aucun rendu, 0 €. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { lireTableauDeBord } from "@/briques/donnees-video/types";
import { roleMaquettiste, entreeMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import type { DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { lireFluxAutomatisation, VERSION_FLUX, type FluxAutomatisation } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { appliquerPieceGardee, pasPieceCreee, recevoirProposition, type EtatPiece, type PieceCreee } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import type { ApercuPiece } from "@/moteurs/montage-tutoriel-outil/maquette-creee";

const description = (): DescriptionMaquette => {
  const sortie = roleMaquettiste.simuler(entreeMaquettiste("maquette", { metier: "x", carteZones: [], interdits: [], demande: "un tableau de bord pour un atelier", proposition: 1 })) as { contenu: unknown };
  return sortie.contenu as DescriptionMaquette;
};

type Libre = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- données de test
function flux(): FluxAutomatisation {
  const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils/demo-data.js"), "utf8");
  const ctx: Libre = {};
  vm.runInNewContext(source, { window: ctx });
  const contenus = JSON.parse(JSON.stringify(ctx.DONNEES_ECRANS.contenus)) as Libre;
  delete contenus.tableur;
  delete contenus.agenda;
  const lu = lireFluxAutomatisation({
    version: VERSION_FLUX,
    avant: { vue: "boite", etat: "avant", surMot: "déborde" },
    declencheur: { vue: "boite", etat: "nouveau", surMot: "arrive" },
    etapes: [
      { id: "classement", vue: "boite", etat: "etiquete", acteur: "automatisation", libelleSchema: "Classement du message", surMot: "classe" },
      { id: "brouillon", vue: "boite", etat: "brouillon", acteur: "ia", libelleSchema: "Brouillon de réponse", surMot: "brouillon" },
      { id: "validation", vue: "boite", etat: "brouillon", acteur: "humain", libelleSchema: "Vous validez", surMot: "validez" },
      { id: "equipe", vue: "messagerie", etat: "notification", acteur: "automatisation", libelleSchema: "Équipe prévenue", surMot: "équipe" },
      { id: "fiche", vue: "crm", etat: "fiche-remplie", acteur: "automatisation", libelleSchema: "Fiche à jour", surMot: "fiche" },
    ],
    moments: ["classement", "brouillon", "validation"],
    resultat: { vue: "crm", etat: "fiche-remplie", surMot: "résultat" },
    contenus,
  });
  if (!lu.ok) throw new Error(lu.erreurs.join(" | "));
  return lu.flux;
}

const apercuDe = (p: PieceCreee, ok = true): ApercuPiece => ({ version: "apercu-piece.v1", empreinteDescription: p.empreinte, images: [{ ecranId: "accueil", etat: "avant", cle: "apercu/a.png" }], controle: { ok, defauts: ok ? [] : ["défaut"] } });
const proposee = (): EtatPiece => recevoirProposition({}, { genre: "maquette", proposition: 1, contenu: description() });

describe("recevoirProposition", () => {
  it("une maquette sans défaut : à construire, avec son empreinte", () => {
    const e = proposee();
    expect(e.pieceCreee?.statut).toBe("a-construire");
    expect(e.pieceCreee?.empreinte).toMatch(/\S/);
    expect(e.pieceCreee?.erreurs).toBeUndefined();
  });

  it("un texte fautif (nom propre) : à revoir, les erreurs sont gardées", () => {
    const d = description();
    d.ecrans[0]!.titre = "Voir Jean Dupont";
    const e = recevoirProposition({}, { genre: "maquette", proposition: 1, contenu: d });
    expect(e.pieceCreee?.statut).toBe("a-revoir");
    expect(e.pieceCreee?.erreurs?.length).toBeGreaterThan(0);
  });

  it("un flux : contrôlé par les règles du flux, genre « flux »", () => {
    const e = recevoirProposition({}, { genre: "flux", proposition: 2, contenu: flux() });
    expect(e.pieceCreee?.genre).toBe("flux");
    expect(e.pieceCreee?.proposition).toBe(2);
    expect(["a-construire", "a-revoir"]).toContain(e.pieceCreee?.statut);
  });

  it("ne lève jamais sur un contenu abîmé", () => {
    expect(() => recevoirProposition({}, { genre: "maquette", proposition: 1, contenu: null as never })).not.toThrow();
    expect(recevoirProposition({}, { genre: "maquette", proposition: 1, contenu: null as never }).pieceCreee?.statut).toBe("a-revoir");
  });
});

describe("pasPieceCreee", () => {
  const base = () => proposee().pieceCreee!;
  const message = (r: ReturnType<typeof pasPieceCreee>) => ("pause" in r ? r.pause.message : "");
  const code = (r: ReturnType<typeof pasPieceCreee>) => ("pause" in r ? r.pause.code : "suite");

  it("chaque statut donne le bon code", () => {
    expect(code(pasPieceCreee({ ...base(), statut: "a-revoir" }))).toBe("TO_PIECE_A_REVOIR");
    expect(code(pasPieceCreee({ ...base(), statut: "refusee" }))).toBe("TO_DEMANDE_ARRETEE");
    expect(code(pasPieceCreee(base()))).toBe("TO_PIECE_A_CONSTRUIRE");
    const p = base();
    expect(code(pasPieceCreee({ ...p, apercu: apercuDe(p) }))).toBe("TO_PIECE_A_VALIDER");
    expect(code(pasPieceCreee({ ...p, statut: "a-valider", apercu: apercuDe(p) }))).toBe("TO_PIECE_A_VALIDER");
    expect(code(pasPieceCreee({ ...p, statut: "a-valider" }))).toBe("TO_PIECE_A_CONSTRUIRE");
    expect(code(pasPieceCreee({ ...p, apercu: apercuDe(p, false) }))).toBe("TO_PIECE_A_REVOIR");
    expect(code(pasPieceCreee(undefined))).toBe("TO_PIECE_A_REVOIR");
  });

  it("aucune phrase sans « € », « $ » ni « tu » ; vouvoiement", () => {
    const p = base();
    const toutes = [pasPieceCreee({ ...p, statut: "a-revoir" }), pasPieceCreee({ ...p, statut: "refusee" }), pasPieceCreee(p), pasPieceCreee({ ...p, apercu: apercuDe(p) }), pasPieceCreee({ ...p, apercu: apercuDe(p, false) })].map(message);
    for (const m of toutes) {
      expect(m).not.toMatch(/€|\$|euro/i);
      expect(m).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
      expect(m.length).toBeGreaterThan(10);
    }
    expect(toutes.some((m) => /Votre|vous/i.test(m))).toBe(true);
  });

  it("gardée avec la même empreinte (et l'aperçu vu) : la suite ; empreinte changée : retour à « à construire »", () => {
    const p = base();
    const gardee: PieceCreee = { ...p, statut: "gardee", apercu: apercuDe(p), gardee: { empreinte: p.empreinte, le: "2026-11-20T10:00:00.000Z" } };
    expect(pasPieceCreee(gardee)).toEqual({ suite: true });
    const changee = { ...gardee, empreinte: "autre-empreinte" };
    const r = pasPieceCreee(changee);
    expect(code(r)).toBe("TO_PIECE_A_CONSTRUIRE");
    expect("etat" in r && r.etat?.statut).toBe("a-construire");
    expect("etat" in r && r.etat?.gardee).toBeUndefined();
  });
});

describe("appliquerPieceGardee", () => {
  it("maquette : carte d'au moins 3 zones, données lues par G4, textes « créés », analyste sauté", () => {
    const e = appliquerPieceGardee(proposee());
    expect(e.carte?.zones.length).toBeGreaterThanOrEqual(3);
    expect(e.donnees).toBeDefined();
    expect(lireTableauDeBord(e.donnees).ok).toBe(true);
    expect(e.textesMaquette?.length).toBeGreaterThan(0);
    expect(e.textesMaquette?.every((t) => t.creee === true && t.textes.length > 0)).toBe(true);
    expect(e.carteOrigine).toBe("piece-gardee");
  });

  it("flux : carte par étape, textes créés, aucune donnée chiffrée", () => {
    const e = appliquerPieceGardee(recevoirProposition({ donnees: {} as never }, { genre: "flux", proposition: 1, contenu: flux() }));
    expect(e.carte?.zones.length).toBe(5);
    expect(e.donnees).toBeUndefined();
    expect(e.textesMaquette?.every((t) => t.creee === true)).toBe(true);
  });

  it("sans pièce : l'état est rendu tel quel ; pièce illisible : à revoir, sans lever", () => {
    const vide: EtatPiece = {};
    expect(appliquerPieceGardee(vide)).toBe(vide);
    const abimee: EtatPiece = { pieceCreee: { genre: "maquette", proposition: 1, contenu: {} as never, empreinte: "x", statut: "gardee" } };
    expect(() => appliquerPieceGardee(abimee)).not.toThrow();
    expect(appliquerPieceGardee(abimee).pieceCreee?.statut).toBe("a-revoir");
  });
});
