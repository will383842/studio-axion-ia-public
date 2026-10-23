/**
 * M9 · moteur `montage-cas-concret` au contrat commun, construit avec des outils injectés (sans passer par le registre) :
 * parcours pas à pas jusqu'à « terminé », échec puis « Réessayer » sans rien repayer, « Arrêter » pendant les écrans,
 * estimation en montants réels, refus lisibles. Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas, phraseEtapeEchouee } from "@/moteurs/montage-cas-concret";
import { LIBELLES_ETAPES_CAS_CONCRET } from "@/moteurs/montage-cas-concret/etapes";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const terminees = (t: Travail) => t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);

/** Avance jusqu'à `condition` ; le travail fait l'aller-retour JSON entre deux tours (comme en base). */
async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail, condition: (t: Travail) => boolean = (t) => t.statut === "termine" || t.statut === "echec") {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  const tours: string[][] = [];
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    tours.push(terminees(t));
    if (condition(t)) return { travail: t, resultat, tours, maintenant: T0 + n * 1000 };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

describe("M9 · parcours pas à pas", () => {
  it("un travail avance d'étape en étape jusqu'à « terminé » : la première fin est la sortie, chaque fin au projet", async () => {
    const b = banc();
    const c = b.commande();
    const t = await b.moteur.lancer(c, ctx("t-parcours"));
    expect(t.statut).toBe("en_file");
    expect(t.etapes.map((e) => e.cle)).toEqual(["ecriture", "fiche", "captures", "voix", "calage", "ecrans", "montage", "controle"]);
    const fin = await avancerJusqua(b.moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    expect(fin.travail.progression).toBe(100);
    // Jamais plus d'une étape de plus par tour.
    for (let i = 1; i < fin.tours.length; i++) expect(fin.tours[i].length - fin.tours[i - 1].length).toBeLessThanOrEqual(1);
    expect(fin.tours.length).toBeGreaterThanOrEqual(7);
    const r = fin.resultat!;
    expect(r.sorties).toHaveLength(1);
    expect(r.sorties[0]).toMatchObject({ ratio: "9:16", resolution: "1080x1920" });
    const projet = r.projetMontage.casConcret as { fins: { id: string; fichierCle: string; reseaux: string[] }[]; rapport: { verdict: string }; liens: Record<string, string>; fiche: { casId: string } };
    // Rien de branché (X6) : Instagram et TikTok partagent leur fin, Facebook et LinkedIn ont chacun la leur.
    expect(projet.fins).toHaveLength(3);
    expect(r.sorties[0].fichierCle).toBe(projet.fins[0].fichierCle);
    expect(projet.rapport.verdict).toBe("ok");
    expect(Object.keys(projet.liens)).toEqual(["facebook", "instagram", "tiktok", "linkedin"]);
    expect(projet.fiche.casId).toBe("recrutement-apporteurs");
    expect(r.lignesReelles.every((l) => l.nature === "reel")).toBe(true);
    // La voix payée : une prise pour le corps, une par fin, chacune une fois.
    expect(b.d.lus).toHaveLength(4);
    const voix = r.lignesReelles.find((l) => l.etape === "Voix");
    expect(voix?.total.centimes).toBeGreaterThan(0);
    expect(b.moteur.lignesPayees?.(fin.travail, c)).toEqual([voix]);
  });

  it("L0d · chaque fin garde SES sous-titres (Facebook, Instagram-TikTok, LinkedIn), la première = ceux de la vidéo", async () => {
    const b = banc();
    const c = b.commande();
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-st-fins")));
    const r = fin.resultat!;
    const fins = (r.projetMontage.casConcret as { fins: { id: string; reseaux: string[]; sousTitres?: { mots: { mot: string }[] }[] }[] }).fins;
    expect(fins).toHaveLength(3);
    for (const f of fins) expect(f.sousTitres?.length).toBeGreaterThan(0);
    expect(fins[0].sousTitres).toEqual(r.sousTitres);
    const derniers = fins.map((f) => f.sousTitres!.flatMap((s) => s.mots.map((m) => m.mot)).slice(-4).join(" "));
    expect(new Set(derniers).size).toBe(3);
  });

  it("L0a · le moteur renvoie ses vrais plans : un par écran du corps, texte dit, horaires du calage", async () => {
    const b = banc();
    const c = b.commande();
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-plans")));
    const r = fin.resultat!;
    const fiche = (r.projetMontage.casConcret as { fiche: { ecrans: { texteDit: string; debutMs?: number; finMs?: number }[] } }).fiche;
    expect(r.plans).toHaveLength(fiche.ecrans.length);
    r.plans!.forEach((p, i) => {
      const e = fiche.ecrans[i];
      expect(p.ordre).toBe(i + 1);
      expect(p.texte).toBe(e.texteDit.trim());
      expect(p.segmentId).toBe(`${c.videoId}-s${i + 1}`);
      expect(p.debutSec).toBeCloseTo(e.debutMs! / 1000, 3);
      expect(p.finSec).toBeCloseTo(e.finMs! / 1000, 3);
      expect(p.sourceImage).toBe("motion");
    });
  });

  it("non relié : échec lisible et réessayable", async () => {
    const b = banc({ relie: false });
    const c = b.commande();
    const r = await b.moteur.avancer(await b.moteur.lancer(c, ctx("t-non-relie")), c, T0);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur?.reessayable).toBe(true);
    expect(r.travail.erreur?.messagePourWill).toMatch(/pas relié/);
  });
});

describe("M9 · échec et reprise", () => {
  it("échec puis « Réessayer » : rien n'est repayé, rien n'est rendu deux fois", async () => {
    const b = banc();
    const c = b.commande({ simulerEchecEtape: "montage" });
    const enEchec = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-echec")));
    expect(enEchec.travail.statut).toBe("echec");
    expect(enEchec.travail.erreur?.reessayable).toBe(true);
    expect(enEchec.travail.etapes.find((e) => e.cle === "montage")?.statut).toBe("echec");
    const faites = terminees(enEchec.travail);
    expect(faites).toEqual(["ecriture", "fiche", "captures", "voix", "calage", "ecrans"]);
    const lus = b.d.lus.length;
    const ecrans = b.d.ecransSoumis().length;
    const appels = b.d.appelsEcriture();
    const paye = b.moteur.lignesPayees?.(enEchec.travail, c);

    const repris = await b.moteur.reessayer(enEchec.travail, enEchec.maintenant);
    expect(repris.tentatives).toBe(2);
    for (const cle of faites) expect(repris.etapes.find((e) => e.cle === cle)?.statut).toBe("terminee");
    const fin = await avancerJusqua(b.moteur, c, repris);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lus).toHaveLength(lus);
    expect(b.d.ecransSoumis()).toHaveLength(ecrans);
    expect(b.d.appelsEcriture()).toBe(appels);
    expect(b.moteur.lignesPayees?.(fin.travail, c)).toEqual(paye);
  });

  it("fiche fournie refusée : échec à la relecture, non réessayable, ni écriture ni voix", async () => {
    const b = banc();
    const fiche = ficheParGabarit(trouverCas("recrutement-apporteurs")!, { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" });
    b.fiches.set("studio/dev/fiches/video-cc.json", { ...fiche, casId: "un-autre-cas" });
    const c = b.commande({ entrees: { casConcret: { ...b.d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" } } });
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-refus")));
    expect(fin.travail.statut).toBe("echec");
    expect(fin.travail.etapes.find((e) => e.cle === "fiche")?.statut).toBe("echec");
    expect(fin.travail.erreur?.reessayable).toBe(false);
    expect(fin.travail.erreur?.messagePourWill).toMatch(/^L'étape « La relecture » n'a pas abouti\./);
    expect(b.d.appelsEcriture()).toBe(0);
    expect(b.d.lus).toHaveLength(0);
  });

  it("fiche fournie valide : l'écriture est sautée, la vidéo est faite", async () => {
    const b = banc();
    const fiche = ficheParGabarit(trouverCas("recrutement-apporteurs")!, { videoId: "video-cc", versionId: "ver-t-fournie", habillage: "charte-duo/1", origine: "porte-a" });
    b.fiches.set("studio/dev/fiches/video-cc.json", fiche);
    const c = b.commande({ entrees: { casConcret: { ...b.d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" } } });
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-fournie")));
    expect(fin.travail.statut).toBe("termine");
    expect(fin.travail.etapes.map((e) => e.cle)).not.toContain("ecriture");
    expect(b.d.appelsEcriture()).toBe(0);
  });
});

describe("M9 · « Arrêter »", () => {
  it("annuler pendant les écrans : statut annulé, étapes faites gardées, plus rien n'avance", async () => {
    const b = banc();
    const c = b.commande();
    const pendant = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-arret")), (t) => t.etapes.find((e) => e.cle === "ecrans")?.statut === "en_cours");
    const faites = terminees(pendant.travail);
    expect(faites).toEqual(["ecriture", "fiche", "captures", "voix", "calage"]);
    const arrete = await b.moteur.annuler!(pendant.travail, pendant.maintenant);
    expect(arrete.statut).toBe("annule");
    expect(terminees(arrete)).toEqual(faites);
    expect(arrete.etapes.find((e) => e.cle === "voix")?.coutReel?.centimes).toBeGreaterThan(0);
    const apres = await b.moteur.avancer(arrete, c, pendant.maintenant + 60_000);
    expect(apres.travail.statut).toBe("annule");
    expect(apres.resultat).toBeUndefined();
    expect(b.d.compositionsSoumises()).toHaveLength(0);
  });
});

describe("M9 · estimation", () => {
  it("cas témoin : plus de 0 et moins de 150 centimes ; voix au caractère, aucune écriture (V4-3 : script validé)", async () => {
    const b = banc();
    const c = b.commande();
    const e = await b.moteur.estimer(c);
    expect(e.total.centimes).toBeGreaterThan(0);
    expect(e.total.centimes).toBeLessThan(150);
    const ecriture = e.lignes.find((l) => l.etape === "Écriture");
    const voix = e.lignes.find((l) => l.etape === "Voix");
    expect(ecriture).toBeUndefined();
    // L'écriture au pire reste comptée pour un cas sans script validé.
    expect(estimerDepuisCas(trouverCas("rappels-rendez-vous")!, ["facebook"], true, { voix: { fournisseur: "heygen" } }).lignes.find((l) => l.etape === "Écriture")!.total.centimes).toBeGreaterThan(0);
    expect(voix).toMatchObject({ unite: "caractere", fournisseur: "heygen" });
    expect(voix!.total.centimes).toBeGreaterThan(0);
    // Même calcul sans commande.
    expect(estimerDepuisCas(trouverCas("recrutement-apporteurs")!, ["facebook", "instagram", "tiktok", "linkedin"], true, { voix: { fournisseur: "heygen" } }).total).toEqual(e.total);
  });

  it("la voix compte chaque fin : plus de réseaux, plus de caractères ; sans voix, aucune ligne de voix", async () => {
    const b = banc();
    const un = await b.moteur.estimer(b.commande({ entrees: { casConcret: { ...b.d.options.entrees, reseaux: ["facebook"] } } }));
    const quatre = await b.moteur.estimer(b.commande());
    expect(quatre.lignes.find((l) => l.etape === "Voix")!.quantite).toBeGreaterThan(un.lignes.find((l) => l.etape === "Voix")!.quantite);
    expect((await b.moteur.estimer(b.commande({ distribution: [] }))).lignes.map((l) => l.etape)).not.toContain("Voix");
  });

  it("une fiche fournie : ni écriture estimée, ni étape d'écriture", async () => {
    const b = banc();
    const c = b.commande({ entrees: { casConcret: { ...b.d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" } } });
    expect((await b.moteur.estimer(c)).lignes.map((l) => l.etape)).not.toContain("Écriture");
    expect(b.moteur.etapes(c).map((e) => e.cle)).not.toContain("ecriture");
  });
});

describe("M9 · refus lisibles", () => {
  it("au lancement : pas de voix, ni cas ni fiche, aucun réseau", () => {
    const b = banc();
    const c = b.commande();
    expect(b.moteur.refusAuLancement?.(c)).toBeNull();
    expect(b.moteur.refusAuLancement?.({ ...c, distribution: [] })?.code).toBe("CAS_CONCRET_SANS_VOIX");
    expect(b.moteur.refusAuLancement?.({ ...c, entrees: { casConcret: { reseaux: ["facebook"] } } })?.code).toBe("CAS_CONCRET_SANS_CAS");
    expect(b.moteur.refusAuLancement?.({ ...c, entrees: { casConcret: { ...b.d.options.entrees, reseaux: [] } } })?.code).toBe("CAS_CONCRET_SANS_RESEAU");
  });

  it("retouche, réexport, sous-titres : « viendra en version 2 », rien n'est lancé", async () => {
    const b = banc();
    const c = b.commande();
    const r = await b.moteur.retoucher({ commande: c, contexte: ctx("t-r"), planIds: [], consigne: "" });
    const x = await b.moteur.reexporter({ commande: c, contexte: ctx("t-x"), cible: { ratio: "1:1" } });
    const s = await b.moteur.recalquer!({ commande: c, contexte: ctx("t-s"), sousTitresId: "s", segments: [], parent: { versionId: "v", pistes: [] } });
    for (const t of [r, x, s]) {
      expect(t.statut).toBe("echec");
      expect(t.erreur?.reessayable).toBe(false);
      expect(t.erreur?.messagePourWill).toContain("viendra en version 2");
    }
    expect(r.type).toBe("retouche");
    expect(x.type).toBe("reexport");
    expect(b.moteur.capacites.maquette).toBe(false);
    expect((await b.moteur.maquette(c)).fichierCle).toBeUndefined();
    expect(b.d.lus).toHaveLength(0);
  });
});

describe("X1 · phrase d'une étape en échec", () => {
  it.each(Object.values(LIBELLES_ETAPES_CAS_CONCRET))("« %s » : une seule tournure, accordée pour tout nom d'étape", (nom) => {
    expect(phraseEtapeEchouee(nom)).toBe(`L'étape « ${nom} » n'a pas abouti.`);
  });
  it("sans étape connue : « La fabrication n'a pas abouti. »", () => {
    expect(phraseEtapeEchouee(undefined)).toBe("La fabrication n'a pas abouti.");
  });
});
