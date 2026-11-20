/**
 * X4-10b : branchement de la note d'intérêt dans l'inscription des extraits, derrière `archiveExtraits.noteInteret` (éteint).
 * Dépôts en mémoire, horloge injectée, aucun appel externe.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Video, VersionVideo, Sortie, SousTitres, Fichier } from "@/domaine/types";

const piege = vi.hoisted(() => ({ actif: false }));
vi.mock("@/briques/archive-extraits/tri-video", async (importer) => {
  const reel = await importer<typeof import("@/briques/archive-extraits/tri-video")>();
  return { ...reel, trierVideo: (...a: Parameters<typeof reel.trierVideo>) => { if (piege.actif) throw new TypeError("tri piégé"); return reel.trierVideo(...a); } };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/archive-extraits");
const note = await import("@/services/note-extraits");

const T0 = "2026-11-17T10:00:00.000Z";
const ANCIEN = "2026-11-01T00:00:00.000Z";
const INSCRIPTION = "bibliothequeVideo.archive.inscription";
const NOTE = "archiveExtraits.noteInteret";
let horlogeMin = 0;
const ports = () => ({ maintenant: () => new Date(Date.parse(T0) + horlogeMin * 60_000).toISOString() });

function mots(depart: number, phrases: string[]) {
  let t = depart;
  return phrases.map((texte) => {
    const m = texte.split(" ").map((mot, i) => ({ mot, debutSec: t + i * 0.4, finSec: t + i * 0.4 + 0.35 }));
    t += m.length * 0.4 + 0.6;
    return m;
  });
}

async function semer(id: string, o: { video?: Partial<Video>; version?: Partial<VersionVideo> } = {}) {
  const d = depots();
  const base = { creeLe: ANCIEN, modifieLe: ANCIEN };
  await d.videos.enregistrer({
    id, titre: `Vidéo ${id}`, formatId: "avocat", statut: "prete", etapeEditoriale: "publiee", marqueId: "m1", styles: {}, entrees: {}, reglages: {},
    versionChoisieId: `ver-${id}`, ...base, ...o.video,
  } as unknown as Video);
  await d.versions.enregistrer({
    id: `ver-${id}`, videoId: id, numero: 1, statut: "prete", choisie: true, ...base,
    commande: { versionContrat: 2, moteurId: "montage-avocat", videoId: id, formatId: "avocat" }, ...o.version,
  } as unknown as VersionVideo);
  await d.fichiers.enregistrer({ id: `fic-${id}`, cleStockage: `studio/prod/video/${id}/a.mp4`, nom: "a.mp4", mime: "video/mp4", taille: 1, origine: "genere", statut: "pret", ...base } as unknown as Fichier);
  await d.sorties.enregistrer({ id: `sor-${id}`, videoId: id, versionId: `ver-${id}`, ratio: "9:16", appelAuMot: false, fichierId: `fic-${id}`, dureeSec: 60, ...base } as unknown as Sortie);
  const segs = mots(1, ["Bonjour à tous voici une première phrase claire.", "Ensuite une deuxième phrase tout aussi claire."]).map((m, i) => ({ id: `s${i}`, debutSec: m[0].debutSec, finSec: m[m.length - 1].finSec, mots: m }));
  await d.sousTitres.enregistrer({ id: `st-${id}`, videoId: id, versionId: `ver-${id}`, langue: "fr", version: 1, segments: segs, ...base } as unknown as SousTitres);
}

const demoCRM = {
  video: { typeAutomatisation: "suivi-commercial" } as Partial<Video>,
  version: {
    commande: {
      versionContrat: 2, moteurId: "montage-demo-facecam", videoId: "d", formatId: "avocat",
      entrees: { demoFacecam: { ecran: { cle: "studio/ecran.mp4", dureeSec: 30 }, synchro: { mode: "fourni", decalageSec: 0 } } },
    },
    projetMontage: { plan: { scenes: [{ piece: "fenetre-app", debutMs: 2000, finMs: 7000 }, { piece: "liste-crm", debutMs: 8000, finMs: 13000 }] } },
  } as unknown as Partial<VersionVideo>,
};

const elementDe = async (id: string) => (await depots().elements.obtenir(svc.idElementArchive(id)))!;

beforeEach(async () => {
  reinitialiserDepots();
  horlogeMin = 0;
  vi.restoreAllMocks();
  await ecrireParametre(INSCRIPTION, true);
});

describe("éteint : identique au chantier 3", () => {
  it("réglage absent, chaîne « true », { actif: \"oui\" } : appliquerNote jamais appelé, même élément, même nom", async () => {
    await semer("a");
    await svc.inscrireVideo("a", ports());
    const ref = await elementDe("a");
    for (const v of [undefined, "true", { actif: "oui" }, false]) {
      reinitialiserDepots();
      await ecrireParametre(INSCRIPTION, true);
      if (v !== undefined) await ecrireParametre(NOTE, v);
      await semer("a");
      const espion = vi.spyOn(note, "appliquerNote");
      expect((await svc.inscrireVideo("a", ports())).ecrite).toBe(true);
      expect(espion).not.toHaveBeenCalled();
      const el = await elementDe("a");
      expect(el).toEqual(ref);
      expect(el.nom).toBe(ref.nom);
      espion.mockRestore();
    }
  }, 30_000); // FIX-INSCRIPTION-NOTE-v20i : 4 inscriptions complètes, > 5 s sous charge
});

describe("allumé", () => {
  beforeEach(async () => ecrireParametre(NOTE, true));

  it("démo CRM : au moins une plage gardée « suivi-commercial » avec l'usage écran ; noteVersion posé", async () => {
    await semer("d", demoCRM);
    expect((await svc.inscrireVideo("d", ports())).ecrite).toBe(true);
    const fiche = (await svc.ficheDeLaVideo("d"))!;
    expect(fiche.noteVersion).toBeTruthy();
    const ecran = fiche.plages.filter((p) => p.etat === "utilisable" && p.sujet === "suivi-commercial" && p.usages?.includes("ecran"));
    expect(ecran.length).toBeGreaterThanOrEqual(1);
  });

  it("v4 « tête qui parle » sans plan : rienARetenir", async () => {
    await semer("t", { video: { formatId: "facecam" } });
    expect((await svc.inscrireVideo("t", ports())).ecrite).toBe(true);
    const fiche = (await svc.ficheDeLaVideo("t"))!;
    expect(fiche.rienARetenir).toBe(true);
    expect(fiche.plages.filter((p) => p.etat === "utilisable")).toEqual([]);
  });

  it("les gestes de Williams survivent au recalcul (écartée, validée, sujet corrigé, chiffres réels)", async () => {
    await semer("d", demoCRM);
    await svc.inscrireVideo("d", ports());
    const d = depots();
    const el = await elementDe("d");
    if (el.valeur.type !== "source-extraits") throw new Error("type");
    const f = el.valeur.fiche;
    const [p1, p2] = f.plages.filter((p) => p.etat === "utilisable");
    expect(p1 && p2).toBeTruthy();
    p1.etat = "ecartee";
    p1.ecarteeLe = "2026-11-10T00:00:00.000Z";
    p2.valideeLe = "2026-11-11T00:00:00.000Z";
    p2.sujet = "appels-offres";
    p2.sujetCorrigeLe = "2026-11-12T00:00:00.000Z";
    f.chiffresReels = true;
    await d.elements.enregistrer(el);
    // seuils très hauts : la plage validée doit rester gardée ; nouvelle empreinte → réécriture
    await ecrireParametre(NOTE, { actif: true, seuils: { garde: 100, peutEtre: 99, gardesMax: 8 } });
    expect((await svc.inscrireVideo("d", ports())).ecrite).toBe(true);
    const apres = (await svc.ficheDeLaVideo("d"))!;
    expect(apres.chiffresReels).toBe(true);
    const e = apres.plages.find((p) => p.id === p1.id)!;
    expect(e.etat).toBe("ecartee");
    expect(e.ecarteeLe).toBe("2026-11-10T00:00:00.000Z");
    const v = apres.plages.find((p) => p.id === p2.id)!;
    expect(v.etat).toBe("utilisable");
    expect(v.valideeLe).toBe("2026-11-11T00:00:00.000Z");
    expect(v.sujet).toBe("appels-offres");
    expect(v.sujetCorrigeLe).toBe("2026-11-12T00:00:00.000Z");
  });

  it("seconde passe sans changement : « inchangée », zéro écriture", async () => {
    await semer("d", demoCRM);
    await svc.inscrireVideo("d", ports());
    const ecrit = vi.spyOn(depots().elements, "enregistrer");
    expect(await svc.inscrireVideo("d", ports())).toEqual({ ecrite: false, raison: "inchangée" });
    expect(ecrit).not.toHaveBeenCalled();
  });

  it("autres seuils : empreinte différente, fiche réécrite", async () => {
    await semer("d", demoCRM);
    await svc.inscrireVideo("d", ports());
    const nom = (await elementDe("d")).nom;
    await ecrireParametre(NOTE, { actif: true, seuils: { garde: 70, peutEtre: 50, gardesMax: 5 } });
    expect((await svc.inscrireVideo("d", ports())).ecrite).toBe(true);
    expect((await elementDe("d")).nom).not.toBe(nom);
  });

  it("erreur dans la note (plan piégé) : fiche du chantier 3 écrite sans note, une ligne de journal, aucune exception", async () => {
    await semer("d", demoCRM);
    piege.actif = true;
    const journal = vi.spyOn(await import("@/services/_commun"), "journaliser");
    try {
      const r = await svc.inscrireVideo("d", ports());
      expect(r.ecrite).toBe(true);
    } finally {
      piege.actif = false;
    }
    const fiche = (await svc.ficheDeLaVideo("d"))!;
    expect(fiche.noteVersion).toBeUndefined();
    expect(journal.mock.calls.filter((c) => String(c[1]).startsWith("Extraits : note non calculée"))).toHaveLength(1);
  });
});

describe("appliquerNote (unité)", () => {
  it("journalise une ligne et rend la fiche inchangée si une exception survient", async () => {
    const fiche = { videoId: "x", versionId: "v", sortieId: "s", ratio: "9:16", licence: "libre", famille: [], plages: [], rangee: false, sourcePreferee: true } as never;
    const journal = vi.fn(async () => {});
    const plan = { get scenes() { throw new TypeError("boum"); } };
    const r = await note.appliquerNote(
      fiche,
      { video: { titre: "t" } as never, version: { commande: { entrees: { demoFacecam: { ecran: { cle: "k", dureeSec: 10 }, synchro: { mode: "fourni", decalageSec: 0 } } } }, projetMontage: { plan } } as never, ancienne: null },
      { garde: 60, peutEtre: 40, gardesMax: 8 },
      { journal },
    );
    expect(r).toBe(fiche);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(journal).toHaveBeenCalledWith("Extraits : note non calculée (TypeError)");
  });

  it("etatNote : empreinte seulement si actif", async () => {
    expect(await note.etatNote(async () => false)).toEqual({ actif: false, seuils: { garde: 60, peutEtre: 40, gardesMax: 8 } });
    const on = await note.etatNote(async () => true);
    expect(on.actif).toBe(true);
    expect(on.empreinte).toBe(note.empreinteNote(on.seuils));
  });
});
