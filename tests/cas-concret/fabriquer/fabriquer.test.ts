/**
 * M8 (cas concret, plan § 5) : la chaîne de fabrication, avec des doubles seulement (aucun appel réel). Sorties par fin,
 * fins regroupées, écrans du corps rendus une fois, reprise après panne, arrêt avant toute voix, rendu par empreinte,
 * commande sans musique, sous-titres et bruitages, panne d'essai.
 */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { ErreurFabricationCasConcret, fabriquerCasConcret, type CompteRenduCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { doubles, SONS_VALIDES, type Doubles } from "./doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const ficheDe = (casId: string): FicheEcrans => ficheParGabarit(trouverCas(casId)!, FIXE);

/** La fiche est fournie (l'écriture est sautée). */
function avecFiche(d: Doubles, fiche: unknown): Doubles {
  d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
  d.options.lireFiche = async () => structuredClone(fiche);
  return d;
}

async function echec(d: Doubles): Promise<ErreurFabricationCasConcret> {
  const err = await fabriquerCasConcret(d.options).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
  return err as ErreurFabricationCasConcret;
}

const parametres = (d: Doubles) => d.compositionsSoumises().map((c) => ({ entrees: c.entrees, p: c.parametres as { son: Record<string, unknown>; texte: { sousTitres?: { segments: unknown[] } } } }));

describe("M8 · sorties", () => {
  it("cas « recrutement-apporteurs » simulé, 4 réseaux, rien de branché → 3 sorties (Instagram et TikTok partagent la leur)", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["instagram", "tiktok"], ["linkedin"]]);
    expect(new Set(cr.fins.map((f) => f.fichierCle)).size).toBe(3);
    expect(d.compositionsSoumises()).toHaveLength(3);
    expect(cr.ecriture).toEqual({ appels: 1, simule: true });
    expect(cr.etapes.map((e) => e.etape)).toEqual(["ecriture", "fiche", "captures", "voix", "calage", "ecrans", "montage", "controle"]);
    // Une prise pour le corps, une par fin ; chaque lecture réservée avant d'être payée.
    expect(d.lus).toHaveLength(4);
    expect(cr.prises).toHaveLength(4);
    expect(d.reservationsVoix).toHaveLength(4);
    expect(cr.coutCentimes).toBe(cr.prises.reduce((s, p) => s + p.coutCentimes, 0));
    expect(cr.estimation.centimes).toBeGreaterThanOrEqual(cr.coutCentimes);
    // Corps puis fin raccordés par la recette de la voix (X4), au tempo du format, un son par fin.
    expect(d.assemblages).toHaveLength(3);
    expect(d.assemblages.every((a) => a.tempo === 1.08 && a.recette?.parametres.mode === "recette")).toBe(true);
    // Liens suivis et textes de publication, par réseau.
    expect(Object.keys(cr.liens)).toEqual(["facebook", "instagram", "tiktok", "linkedin"]);
    expect(cr.publication).toHaveLength(4);
    expect(cr.rapport.phrases.length).toBeGreaterThan(0);
  });

  it("formation, mot coché mais branché nulle part → le diagnostic partout, la raison au compte rendu", async () => {
    const d = doubles({ casId: "email-difficile" });
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.fins.map((f) => [...f.reseaux].sort())).toEqual([["facebook"], ["instagram", "tiktok"], ["linkedin"]]);
    expect(d.compositionsSoumises()).toHaveLength(3);
    expect(cr.plan.reduites.map((r) => r.reseaux).flat().sort()).toEqual(["facebook", "instagram"]);
    expect(cr.rapport.phrases.some((p) => p.includes("Fin réduite"))).toBe(true);
    // Chaque réseau garde son texte de publication.
    expect(cr.publication.map((t) => t.reseau).sort()).toEqual(["facebook", "instagram", "linkedin", "tiktok"]);
  });
});

describe("M8 · écrans", () => {
  it("les écrans du corps ne sont rendus qu'une fois pour 4 réseaux", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    const corps = cr.fiche.ecrans.map((e) => e.id);
    const soumis = d.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string } }).proprietes.id);
    for (const id of corps) expect(soumis.filter((x) => x === id)).toHaveLength(1);
    expect(d.ecransSoumis()).toHaveLength(cr.ecrans.rendus.length);
    // Chaque écran d'une fin est rendu au plus une fois par contenu (LinkedIn reprend l'écran du diagnostic de Facebook).
    expect(cr.ecrans.rendus.filter((id) => id.startsWith("fin-"))).toEqual(["fin-facebook-f01", "fin-facebook-f02", "fin-instagram-tiktok-f01", "fin-instagram-tiktok-f02", "fin-linkedin-f02"]);
  });

  it("les adresses signées des captures sont dans les propriétés, hors de l'empreinte", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    const reel = d.ecransSoumis().find((s) => JSON.stringify(s.parametres).includes('"capture"'));
    expect(reel).toBeDefined();
    expect(JSON.stringify(reel!.parametres)).toMatch(/https:\/\/r2\.exemple\/signe\//);
    // Deuxième lancement (journal perdu, mêmes fichiers) : une autre signature, aucun écran rendu de nouveau.
    const d2 = doubles({ partage: { fichiers: d.partage.fichiers, journal: { valeur: null } } });
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(d2.ecransSoumis()).toHaveLength(0);
    expect(cr2.ecrans.repris).toHaveLength(cr.ecrans.rendus.length);
  });

  it("un seul écran changé → un seul rendu", async () => {
    const fiche = ficheDe("recrutement-apporteurs");
    const d = avecFiche(doubles(), fiche);
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.ecriture).toBeUndefined();
    expect(d.appelsEcriture()).toBe(0);
    const i = fiche.ecrans.findIndex((e) => e.type === "etape" && e.puces.length === 0);
    expect(i).toBeGreaterThan(-1);
    const changee = structuredClone(fiche);
    (changee.ecrans[i] as { puces: string[] }).puces = ["Sans papier"];
    const d2 = avecFiche(doubles({ partage: d.partage }), changee);
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(d2.lus).toHaveLength(0);
    expect(d2.ecransSoumis()).toHaveLength(1);
    expect(cr2.ecrans.rendus).toEqual([fiche.ecrans[i].id]);
  });
});

describe("M8 · reprise et arrêts", () => {
  it("relance après une panne à « ecrans » : voix non relue, écrans déposés non rendus", async () => {
    const d = doubles();
    d.pannes.journalEcransApres = 1;
    const err = await echec(d);
    expect(err.etape).toBe("ecrans");
    expect(d.lus).toHaveLength(4);
    const avant = d.ecransSoumis().length;
    expect(avant).toBeGreaterThan(0);

    const d2 = doubles({ partage: d.partage });
    const cr = await fabriquerCasConcret(d2.options);
    expect(d2.lus).toHaveLength(0);
    expect(cr.coutCentimes).toBe(0);
    expect(cr.etapes.find((e) => e.etape === "voix")?.statut).toBe("reprise");
    // Chaque écran n'a été soumis qu'une fois sur les deux lancements.
    const ids = [...d.ecransSoumis(), ...d2.ecransSoumis()].map((s) => s.sortie.cle);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids).size).toBe(cr.ecrans.rendus.length + cr.ecrans.repris.length);
  });

  it("une panne pendant la voix ne fait relire aucune prise déjà payée", async () => {
    const d = doubles();
    d.pannes.journalApres = "voix";
    await echec(d);
    const lus = d.lus.length;
    const d2 = doubles({ partage: d.partage });
    await fabriquerCasConcret(d2.options);
    expect(lus + d2.lus.length).toBe(4);
  });

  it("fiche refusée → arrêt avant toute voix, avant toute capture", async () => {
    const fiche = ficheDe("recrutement-apporteurs");
    const mauvaise = structuredClone(fiche);
    mauvaise.ecrans[1] = { ...mauvaise.ecrans[1], marque: "autre-site.fr" };
    const d = avecFiche(doubles(), mauvaise);
    const err = await echec(d);
    expect(err.etape).toBe("fiche");
    expect(err.message).toMatch(/marque/i);
    expect(d.lus).toHaveLength(0);
    expect(d.captures).toHaveLength(0);
    expect(d.reservationsVoix).toHaveLength(0);
  });

  it("écriture refusée deux fois → arrêt à l'écriture, jamais de troisième appel, aucune voix", async () => {
    const d = doubles({ retoucherFiche: (f) => ({ ...f, ecrans: [] }) });
    const err = await echec(d);
    expect(err.etape).toBe("ecriture");
    expect(d.appelsEcriture()).toBe(2);
    expect(d.lus).toHaveLength(0);
  });

  it("panne d'essai sur « ecrans » : un échec, puis la réussite (compteur au journal)", async () => {
    const d = doubles({ panneDEssai: "ecrans" });
    const err = await echec(d);
    expect(err.etape).toBe("ecrans");
    expect(err.message).toMatch(/Panne d'essai/);
    expect(d.ecransSoumis()).toHaveLength(0);
    expect(d.partage.journal.valeur?.pannesDEssai).toEqual({ ecrans: 1 });

    const d2 = doubles({ panneDEssai: "ecrans", partage: d.partage });
    const cr = await fabriquerCasConcret(d2.options);
    expect(cr.pannesDEssai).toEqual({ ecrans: 1 });
    expect(d2.lus).toHaveLength(0);
    expect(d2.ecransSoumis().length).toBeGreaterThan(0);
  });
});

describe("M8 · finitions", () => {
  let sansSon: { d: Doubles; cr: CompteRenduCasConcret } | null = null;
  const lancer = async () => {
    if (!sansSon) {
      const d = doubles();
      sansSon = { d, cr: await fabriquerCasConcret(d.options) };
    }
    return sansSon;
  };

  it("aucune musique dans la commande", async () => {
    const { d } = await lancer();
    for (const { entrees, p } of parametres(d)) {
      expect(Object.keys(entrees).some((k) => /musique/i.test(k))).toBe(false);
      expect(Object.keys(p.son).some((k) => /musique/i.test(k))).toBe(false);
    }
  });

  it("des sous-titres pour chaque fin", async () => {
    const { d, cr } = await lancer();
    const ps = parametres(d);
    expect(ps).toHaveLength(cr.fins.length);
    for (const { p } of ps) expect(p.texte.sousTitres?.segments.length).toBeGreaterThan(0);
  });

  it("sans son validé, aucune entrée de bruitage ; le rapport le dit", async () => {
    const { d, cr } = await lancer();
    for (const { entrees, p } of parametres(d)) {
      expect(Object.keys(entrees).some((k) => k.startsWith("bruitage-"))).toBe(false);
      expect(p.son.bruitages).toBeUndefined();
    }
    expect(cr.fins.every((f) => f.bruitages === 0)).toBe(true);
    expect(cr.rapport.phrases).toContain("À noter · Bruitages : Aucun bruitage validé : la vidéo est sans bruitages.");
  });

  it("avec des sons validés : seulement eux, rien dans la dernière seconde sauf la clôture", async () => {
    const d = doubles({ bruitages: SONS_VALIDES });
    const cr = await fabriquerCasConcret(d.options);
    const valides = new Set(SONS_VALIDES.map((s) => s.cle));
    for (const [i, { entrees, p }] of parametres(d).entries()) {
      const sons = Object.entries(entrees).filter(([k]) => k.startsWith("bruitage-"));
      expect(sons.length).toBeGreaterThan(0);
      expect(sons.every(([, url]) => [...valides].some((cle) => url.includes(cle)))).toBe(true);
      const poses = p.son.bruitages as { debutSec: number }[];
      const duree = cr.fins[i].dureeSec;
      expect(poses.filter((b) => b.debutSec > duree - 1)).toHaveLength(0);
      expect(poses.some((b) => Math.abs(b.debutSec - (duree - 1.5)) < 1e-6)).toBe(true);
    }
  });
});
