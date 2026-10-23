/**
 * LOT M1 — moteur `montage-avocat` : contrat partagé (`testerMoteurVideo`, « Arrêter » compris), voix → audio maître →
 * plans, conteneur `studio-rendu` (file courte, 404 après redémarrage, échec passager), maquette réutilisée sans être
 * repayée, refus d'une voix sans son seul. Fournisseurs simulés, AUCUN appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const { ecrireParametre } = await import("@/services/_commun");
const { testerMoteurVideo } = await import("@/moteurs/contrat");
const moteurs = await import("@/moteurs");
const { creerMoteurMontageAvocat, moteurMontageAvocat, ErreurMoteurAvocat, empreinteAudioMaitre } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP_TEST = "essai-moteur-avocat-m1";
const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP_TEST, false);
  // 14/10 (voix de référence) : ce test porte sur le chemin de la voix SANS contrôle de ressemblance (réglage coupé) ;
  // l'avocat avec le contrôle actif est prouvé par tests/voix-reference/avocat.test.ts.
  await ecrireParametre("voix.ressemblance", { actif: false, relancesMax: 2 });
});

/** Une commande avocat avec un « PV » et sa prononciation. */
async function commandeAvecPrononciation(): Promise<CommandeFabrication> {
  const c = await fabrication.construireCommande("v-03");
  const blocs = c.script.blocs.map((b, i) => (i === 0 ? { ...b, segments: [{ id: "s-pv", texte: "Vous recevez un PV de 135 € ?" }, ...b.segments] } : b));
  const texteComplet = blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
  return { ...c, script: { ...c.script, blocs, texteComplet }, prononciations: [{ mot: "PV", prononciation: "pé vé" }] };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail, depuis = T0): Promise<{ travail: Travail; resultat?: ResultatFabrication; ms: number }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = depuis; ms < depuis + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat, ms };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/** Stockage relié (adresses signées https), pour vérifier ce que reçoit `studio-rendu`. */
const stockageSigne = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}?court`,
  urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
  urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
});

/* ---------------- Contrat partagé ---------------- */
testerMoteurVideo(moteurMontageAvocat, async () => {
  reinitialiserDepots();
  return fabrication.construireCommande("v-03");
});

describe("moteur montage-avocat (lot M1, B.1)", () => {
  it("inscrit au registre, mais la production reste en simulation tant que le réglage n'est pas posé", async () => {
    expect(moteurs.moteurExiste("montage-avocat")).toBe(true);
    expect((await fabrication.construireCommande("v-03")).moteurId).toBe("simulation");
    await ecrireParametre("moteur.avocat", "montage-avocat");
    expect((await fabrication.construireCommande("v-03")).moteurId).toBe("montage-avocat");
    expect(moteurMontageAvocat.capacites.ratios).toEqual(["9:16", "4:5", "1:1"]);
    expect(moteurMontageAvocat.etapes(await fabrication.construireCommande("v-03")).map((e) => e.nom)).toEqual(
      expect.arrayContaining(["Votre voix", "Plans", "Vous", "Montage", "Vérification"]),
    );
  });

  it("refuse une voix qui ne sait pas produire un son seul (erreur typée, message clair)", async () => {
    const sansSonSeul = { ...fournisseurVoixSimulation, capacites: { ...fournisseurVoixSimulation.capacites, audioSeul: false } };
    const m = creerMoteurMontageAvocat({ voix: () => sansSonSeul });
    const c = await fabrication.construireCommande("v-03");
    const erreur = await m.lancer(c, { travailId: "t", versionId: "v", titre: "Essai", maintenant: T0 }).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurMoteurAvocat);
    expect(erreur).toMatchObject({ code: "VOIX_INCOMPATIBLE", reessayable: false });
    expect(erreur.messagePourWill).toMatch(/Personnages/);
  });

  it("la voix reçoit le texte PRONONCÉ (prononciations substituées) ; les plans portent le texte VALIDÉ", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const c = await commandeAvecPrononciation();
    const t = await moteurMontageAvocat.lancer(c, { travailId: "t-pv", versionId: "ver-pv", titre: "PV", maintenant: T0 });
    const fin = await jusquAuBout(moteurMontageAvocat, c, t);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire.mock.calls[0][0].texte).toContain("un pé vé de 135");
    expect(lire.mock.calls[0][0].prononciations).toEqual([]);
    const r = fin.resultat!;
    expect(r.plans!.map((p) => p.texte).join(" ")).toContain("un PV de 135");
    expect(r.plans!.map((p) => p.texte).join(" ")).not.toContain("pé vé");
    // Sous-titres sur le texte validé, à l'horodatage de l'audio maître.
    const motsSt = r.sousTitres!.flatMap((s) => s.mots);
    const pv = motsSt.find((m) => m.mot === "PV")!;
    expect(pv.finSec).toBeGreaterThan(pv.debutSec);
    expect(r.pistes).toEqual([expect.objectContaining({ type: "audio-maitre", empreinte: empreinteAudioMaitre(c) })]);
    expect(r.lignesReelles.find((l) => l.etape === "Voix")).toMatchObject({ nature: "reel", fournisseur: "simulation" });
    expect(fin.travail.etapes.find((e) => e.cle === "voix")?.coutReel?.centimes).toBeGreaterThan(0);
    expect(r.projetMontage).toMatchObject({ moteur: "montage-avocat" });
  });

  it("studio-rendu reçoit, sur la file courte, l'analyse puis la coupe, avec des adresses signées (24 h max côté conteneur)", async () => {
    let horloge = T0;
    const rendu = creerServiceRenduSimule(() => horloge);
    const recues: DemandeRendu[] = [];
    const espion: ServiceRendu = { soumettre: (d) => (recues.push(d), rendu.soumettre(d)), etat: (id) => rendu.etat(id) };
    const m = creerMoteurMontageAvocat({ rendu: espion, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    let t = await m.lancer(c, { travailId: "t-r", versionId: "ver-r", titre: "R", maintenant: T0 });
    for (; horloge < T0 + 30_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge += 500) t = (await m.avancer(t, c, horloge)).travail;
    expect(recues.map((d) => [d.operation, d.file, d.parametres.mode])).toEqual([
      ["nettoyage-audio", "courte", "analyse"],
      ["nettoyage-audio", "courte", "appliquer"],
    ]);
    expect(recues[0].entrees.audio).toMatch(/^https:\/\/r2\.exemple\//);
    expect(recues[1].sortie.urlDepot).toMatch(/depot=3600/);
    expect((recues[1].parametres.coupures as unknown[]).length).toBeGreaterThan(0);
    expect(recues[1].parametres.fonduMs).toBe(15);
    // Rendu réel : l'audio maître est le fichier déposé par le conteneur.
    const voix = t.parametres?.voix as { phase: string; audio: { fichierCle: string } };
    expect(voix.phase).toBe("faite");
    expect(voix.audio.fichierCle).toBe(recues[1].sortie.cle);
    expect(voix.audio.fichierCle).toMatch(/^studio\/dev\/audio-maitre\/v-03\//);
  });

  it("404 de studio-rendu (conteneur redémarré) pendant le nettoyage : la même demande est soumise à nouveau, même identifiant", async () => {
    let horloge = T0;
    const rendu = creerServiceRenduSimule(() => horloge);
    const m = creerMoteurMontageAvocat({ rendu, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    let t = await m.lancer(c, { travailId: "t-404", versionId: "ver-404", titre: "404", maintenant: T0 });
    t = (await m.avancer(t, c, horloge)).travail; // lecture SEULE (E2E-1 n° 1 : la voix payée est gardée d'abord)
    t = (await m.avancer(t, c, horloge)).travail; // analyse soumise
    const demande = (t.parametres?.voix as { demande: DemandeRendu }).demande;
    rendu.oublierTout();
    horloge += 500;
    t = (await m.avancer(t, c, horloge)).travail;
    expect(rendu.soumissions(demande.idRendu)).toBe(2);
    for (; horloge < T0 + 30_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge += 500) t = (await m.avancer(t, c, horloge)).travail;
    expect(t.etapes.find((e) => e.cle === "voix")?.statut).toBe("terminee");
  });

  it("échec passager du conteneur : nouvelle demande (3 fois au plus) ; échec définitif : erreur typée non réessayable", async () => {
    const etats = new Map<string, EtatRendu>();
    const rendu: ServiceRendu = {
      soumettre: async (d) => {
        etats.set(d.idRendu, d.idRendu.endsWith("-e1") ? { statut: "termine", sortieCle: d.sortie.cle } : { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "panne" } });
        return { idRendu: d.idRendu };
      },
      etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
    };
    const m = creerMoteurMontageAvocat({ rendu, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    let t = await m.lancer(c, { travailId: "t-e", versionId: "ver-e", titre: "E", maintenant: T0 });
    t = (await m.avancer(t, c, T0)).travail; // lecture seule
    t = (await m.avancer(t, c, T0)).travail; // analyse soumise
    t = (await m.avancer(t, c, T0 + 500)).travail;
    expect((t.parametres?.voix as { essai?: number; demande: DemandeRendu }).demande.idRendu).toMatch(/-analyse-e1$/);

    const definitif: ServiceRendu = {
      soumettre: async (d) => ({ idRendu: d.idRendu }),
      etat: async () => ({ statut: "echec", erreur: { code: "refuse", reessayable: false, message: "son illisible" } }),
    };
    const m2 = creerMoteurMontageAvocat({ rendu: definitif, stockage: stockageSigne });
    let t2 = await m2.lancer(c, { travailId: "t-d", versionId: "ver-d", titre: "D", maintenant: T0 });
    t2 = (await m2.avancer(t2, c, T0)).travail;
    t2 = (await m2.avancer(t2, c, T0)).travail;
    await expect(m2.avancer(t2, c, T0 + 500)).rejects.toMatchObject({ reessayable: false });
  });

  it("stockage non relié alors que studio-rendu est réel : refus clair, non réessayable", async () => {
    // Correcteur 4 (B4) : un montage réel exige la voix HeyGen de Will ; ici doublée par la voix d'essai (aucun appel).
    const m = creerMoteurMontageAvocat({ environnement: { STUDIO_RENDU_URL: "http://studio-rendu:4100" }, voix: () => fournisseurVoixSimulation });
    // Lot R7 : un montage réel avec le double est refusé dès le lancement (le double parle dans HeyGen,
    // tests/r7-double-heygen.test.ts) ; ici, la même vidéo sans double, pour atteindre le refus du stockage.
    const essai = await fabrication.construireCommande("v-03");
    const c = { ...essai, distribution: essai.distribution.map((d) => ({ ...d, source: "rush" as const, fournisseurVoix: "heygen" })) };
    const t = await m.lancer(c, { travailId: "t-s", versionId: "ver-s", titre: "S", maintenant: T0 });
    // E2E-1 n° 1 : la lecture de la voix passe seule (et est gardée), le refus vient à l'appel suivant.
    const lu = (await m.avancer(t, c, T0)).travail;
    await expect(m.avancer(lu, c, T0)).rejects.toMatchObject({ code: "STOCKAGE_NON_RELIE", reessayable: false });
  });

  it("« Réessayer » après un échec de la voix ne relit pas le son déjà payé : seul le nettoyage repart", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const c = await fabrication.construireCommande("v-03");
    let t = await moteurMontageAvocat.lancer(c, { travailId: "t-re", versionId: "ver-re", titre: "Re", maintenant: T0 });
    t = (await moteurMontageAvocat.avancer(t, c, T0)).travail;
    // La boucle a abandonné l'étape (outil indisponible 24 h) : étape « voix » en échec.
    t = { ...t, statut: "echec", etapes: t.etapes.map((e) => (e.cle === "voix" ? { ...e, statut: "echec" as const } : e)) };
    const repris = await moteurMontageAvocat.reessayer(t, T0 + 1000);
    expect((repris.parametres?.voix as { phase: string }).phase).toBe("a-analyser");
    const fin = await jusquAuBout(moteurMontageAvocat, c, repris, T0 + 1000);
    expect(fin.travail.statut).toBe("termine");
    expect(lire).toHaveBeenCalledTimes(1);
  });
});

describe("maquette puis fabrication : l'audio maître est réutilisé, pas repayé (B.0 §19, B.1)", () => {
  it("la maquette paie la voix une fois, crée une version « maquette » avec plans, sous-titres et piste ; la fabrication la réutilise", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const d = depots();
    const avant = await d.depenses.compter(() => true);

    const m = await fabrication.maquetteRapide("v-03");
    expect(lire).toHaveBeenCalledTimes(1);
    expect(m.url).toBe(""); // aucune vidéo : composée dans le navigateur
    expect(m.audioUrl).toBeTruthy();
    const maquette = (await d.versions.obtenir(m.versionId))!;
    expect(maquette.statut).toBe("maquette");
    const plans = await d.plans.lister((p) => p.versionId === m.versionId);
    expect(plans.length).toBeGreaterThan(3);
    expect(plans.every((p) => p.segmentId)).toBe(true);
    expect(await d.sousTitres.compter((s) => s.versionId === m.versionId)).toBe(1);
    const piste = (await d.pistes.lister((p) => p.versionId === m.versionId))[0];
    expect(piste).toMatchObject({ type: "audio-maitre" });
    expect(piste.mots?.length).toBeGreaterThan(10);
    expect(await d.depenses.compter(() => true)).toBe(avant + 1);

    // Fabrication : même texte, même voix → l'audio maître est transmis, la voix n'est ni estimée ni repayée.
    const { travailId, versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const version = (await d.versions.obtenir(versionId))!;
    expect(version.commande.moteurId).toBe("montage-avocat");
    expect(version.commande.audioMaitre?.empreinte).toBe(piste.empreinte);
    expect((await moteurMontageAvocat.estimer(version.commande)).lignes.map((l) => l.etape)).not.toContain("Voix");
    const travail = (await d.travaux.obtenir(travailId))!;
    const fin = await jusquAuBout(moteurMontageAvocat, version.commande, travail, Date.now());
    expect(fin.travail.statut).toBe("termine");
    expect(lire).toHaveBeenCalledTimes(1);
    expect(fin.travail.etapes.find((e) => e.cle === "voix")?.coutReel?.centimes).toBe(0);
    expect(fin.resultat!.lignesReelles.map((l) => l.etape)).not.toContain("Voix");
    // Les plans de la fabrication sont ceux de la maquette (même son, même découpage).
    expect(fin.resultat!.plans!.map((p) => [p.debutSec, p.finSec, p.segmentId])).toEqual(plans.sort((a, b) => a.ordre - b.ordre).map((p) => [p.debutSec, p.finSec, p.segmentId]));
    // Appliqués à la version : plans remplacés (anciens gardés), sous-titres en nouvelle version, piste enregistrée.
    await travaux.appliquerProduitsDuMoteur("v-03", versionId, fin.resultat!, "fr-FR");
    expect(await d.pistes.compter((p) => p.versionId === versionId && p.type === "audio-maitre")).toBe(1);
  });

  it("le texte change : l'empreinte change, la voix est refaite", async () => {
    const c = await fabrication.construireCommande("v-03");
    const autre = { ...c, script: { ...c.script, texteComplet: `${c.script.texteComplet} Une phrase de plus.` } };
    expect(empreinteAudioMaitre(autre)).not.toBe(empreinteAudioMaitre(c));
    const vitesse = { ...c, distribution: c.distribution.map((x) => ({ ...x, reglagesVoix: { vitesse: 1.1, stabilite: 40, emotion: 30 } })) };
    expect(empreinteAudioMaitre(vitesse)).not.toBe(empreinteAudioMaitre(c));
    expect(empreinteAudioMaitre({ ...c, prononciations: [{ mot: "IA", prononciation: "i a" }] })).not.toBe(empreinteAudioMaitre(c));
  });
});

describe("accroches de référence de la fiche de style (B.9 bis, migration étape 8)", () => {
  it("ajoutées une seule fois, jamais réécrites, rangées comme scripts de référence de l'avocat", async () => {
    const { migrerDonnees } = await import("@/services/migrations");
    const { DepotMemoire } = await import("@/donnees/memoire");
    // Base neuve : déjà là (démonstration). Base en ligne d'avant le lot M1 : sans elles.
    expect((await migrerDonnees(depots())).scriptsReferenceAjoutes).toBeUndefined();
    const d = depots();
    const scripts = new DepotMemoire<import("@/domaine/types").Script>([]);
    for (const sc of await d.scripts.lister((x) => !x.id.startsWith("script-ref-fiche-"))) await scripts.enregistrer(sc);
    (d as unknown as Record<string, unknown>).scripts = scripts;
    const r1 = await migrerDonnees(d);
    expect(r1.scriptsReferenceAjoutes).toEqual(["script-ref-fiche-radar", "script-ref-fiche-controle", "script-ref-fiche-6-points"]);
    const radar = (await d.scripts.obtenir("script-ref-fiche-radar"))!;
    expect(radar).toMatchObject({ formatId: "avocat", reference: true, adresse: "tu", accroche: { type: "contre-intuitif" } });
    await d.scripts.modifier(radar.id, { favori: true });
    const r2 = await migrerDonnees(d);
    expect(r2.scriptsReferenceAjoutes).toBeUndefined();
    expect((await d.scripts.obtenir(radar.id))?.favori).toBe(true);
  });
});
