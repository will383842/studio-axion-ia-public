/**
 * P2-02 · retouche par opérations, côté MOTEUR, sur la vraie chaîne branchée sur les doubles (aucun appel réel) : une
 * vidéo est fabriquée, puis retouchée depuis le projet de montage de sa version. Seules les prises dont le texte change
 * sont relues (payées), seuls les écrans dont l'empreinte change sont rendus ; un refus ne lance rien.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { estimerRetoucheCasConcret } from "@/moteurs/montage-cas-concret";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { banc, versOutils } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
/** Les opérations du format passent par le contrat commun (typé pour les autres formats). */
const ops = (o: unknown[]) => o as OperationMontage[];

async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** Une vidéo fabriquée : le banc, sa commande et le parent qu'une retouche reçoit (projet relu « comme en base »). */
async function videoFabriquee(motSur: ("facebook" | "instagram")[] = ["facebook", "instagram"], lecturesFautives?: number[]) {
  // P2R : le mot n'est dit que là où il est branché ; ces essais le branchent sur Facebook et Instagram (comme X7).
  const b = banc({ motSur, retouches: true, ...(lecturesFautives ? { lecturesFautives } : {}) });
  const c = b.commande();
  const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
  expect(fin.travail.statut).toBe("termine");
  const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(fin.resultat!.projetMontage)), pistes: [] };
  return { b, c, parent };
}

/** Identifiants d'écran (« e06 », « f01 ») des rendus d'écrans soumis depuis `depuis`. */
const ecransRendus = (b: ReturnType<typeof banc>, depuis: number) => b.d.ecransSoumis().slice(depuis).map((d) => (d.parametres as { proprietes: { id: string } }).proprietes.id);

describe("P2-02 · moteur : retouches acceptées", () => {
  it("changer une phrase du corps relit le corps seul et ne rend que les écrans décalés", async () => {
    const { b, c, parent } = await videoFabriquee();
    const lus = b.d.lus.length;
    const ecrans = b.d.ecransSoumis().length;
    const operation = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }];
    const apercu = estimerRetoucheCasConcret(c, operation, parent);
    expect(apercu.refus).toBeNull();
    expect(apercu.apercu?.corpsRelu).toBe(true);
    expect(apercu.apercu?.finsRelues).toEqual([]);

    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Changer une phrase", operations: ops(operation), parent });
    expect(t.type).toBe("retouche");
    expect(t.statut).toBe("en_file");
    expect(t.etapes.map((e) => e.cle)).not.toContain("ecriture");
    const fin = await avancerJusqua(b.moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    // Une seule lecture : le corps, avec la nouvelle phrase ; aucune fin relue.
    expect(b.d.lus.slice(lus)).toHaveLength(1);
    expect(b.d.lus.slice(lus)[0]).toContain("La personne voit notre petite annonce.");
    expect(b.d.appelsEcriture()).toBe(1);
    // Écrans : seuls ceux que la phrase décale sont rendus (avant elle, tout est repris par empreinte).
    const rendus = ecransRendus(b, ecrans);
    expect(rendus).toContain("e07");
    for (const id of ["e01", "e02", "e03", "e04", "e05"]) expect(rendus).not.toContain(id);
    const projet = fin.resultat!.projetMontage.casConcret as { fiche: { ecrans: { id: string; texteDit: string }[] } };
    expect(projet.fiche.ecrans.find((e) => e.id === "e06")?.texteDit).toBe("La personne voit notre petite annonce.");
  });

  it("changer le mot ne relit que les fins qui le disent ; le corps et ses écrans sont repris", async () => {
    const { b, c, parent } = await videoFabriquee();
    const lus = b.d.lus.length;
    const ecrans = b.d.ecransSoumis().length;
    // « RDV » dit « R.D.V. » : sur la voix simulée, l'écran du mot garde au moins 1 s (vérification de la vidéo).
    const operation = [{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }];
    const { apercu, estimation } = estimerRetoucheCasConcret(c, operation, parent);
    expect(apercu?.corpsRelu).toBe(false);
    expect(apercu?.finsRelues).toEqual(["fin-facebook", "fin-instagram"]);
    expect(estimation.total.centimes).toBeGreaterThan(0);

    const fin = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Changer le mot", operations: ops(operation), parent }));
    expect(fin.travail.statut).toBe("termine");
    const relus = b.d.lus.slice(lus);
    expect(relus).toHaveLength(2);
    for (const t of relus) expect(t).toContain("R.D.V.");
    expect(ecransRendus(b, ecrans).every((id) => id.startsWith("f"))).toBe(true);
    // Les sorties : une fin par réseau, le mot gardé pour la retouche suivante.
    const projet = fin.resultat!.projetMontage.casConcret as { mot: string; motDit: string; fins: unknown[] };
    expect(projet.mot).toBe("RDV");
    expect(projet.motDit).toBe("R.D.V.");
    expect(projet.fins).toHaveLength(4);
    // Coût de la voix de la retouche : les deux fins seulement.
    const voix = fin.travail.etapes.find((e) => e.cle === "voix");
    expect(voix?.coutReel?.centimes).toBeGreaterThan(0);
  });

  it("une prise retenue à la 2ᵉ lecture (déjà payée) est reprise : l'aperçu et la chaîne ne relisent que le corps", async () => {
    // Lecture n° 2 (la 1ʳᵉ fin) avale un mot : rejetée, la fin est relue (2ᵉ essai, empreinte d'essai) et retenue.
    const { b, c, parent } = await videoFabriquee(["facebook", "instagram"], [2]);
    const prises = (parent.projetMontage!.casConcret as { prisesVoix: { fins: { prise?: { essai?: number } }[] } }).prisesVoix;
    expect(prises.fins.some((f) => (f.prise?.essai ?? 1) > 1)).toBe(true);
    const lus = b.d.lus.length;
    const operation = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }];
    const { apercu } = estimerRetoucheCasConcret(c, operation, parent);
    expect(apercu?.finsRelues).toEqual([]);
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Phrase", operations: ops(operation), parent }));
    expect(fin.travail.statut).toBe("termine");
    // Annoncé : le corps seul ; payé : le corps seul (la fin déjà payée n'est ni relue ni repayée).
    expect(b.d.lus.slice(lus)).toHaveLength(1);
  });

  it("une retouche de retouche reprend les prises déjà faites (le nouveau mot n'est pas relu)", async () => {
    const { b, c, parent } = await videoFabriquee();
    const r1 = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Mot", operations: ops([{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }]), parent }));
    const parent2: ParentRetouche = { versionId: "ver-t-2", projetMontage: JSON.parse(JSON.stringify(r1.resultat!.projetMontage)), pistes: [] };
    const lus = b.d.lus.length;
    const r2 = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-3"), planIds: [], consigne: "Phrase", operations: ops([{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre offre" }]), parent: parent2 }));
    expect(r2.travail.statut).toBe("termine");
    expect(b.d.lus.slice(lus)).toHaveLength(1);
    expect((r2.resultat!.projetMontage.casConcret as { mot: string }).mot).toBe("RDV");
  });
});

describe("P2-02 · moteur : la voix d'une retouche ne paie jamais plus que le prix confirmé", () => {
  it("une lecture qui dépasserait la réservation de la retouche n'est pas faite (plafond de la voix, comme la vidéo)", async () => {
    const opt: Parameters<typeof banc>[0] = { motSur: ["facebook", "instagram"], retouches: true };
    const b = banc(opt);
    const c = b.commande();
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
    expect(fin.travail.statut).toBe("termine");
    const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(fin.resultat!.projetMontage)), pistes: [] };
    const operation = [{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }];
    const reserve = (await b.moteur.estimerRetouche(c, [], { operations: ops(operation), parent })).lignes.find((l) => l.etape === "Voix")!.total.centimes;
    // Désormais chaque lecture coûte plus que toute la réservation de la voix : la 1ʳᵉ passe (rien de payé avant), aucune autre.
    opt!.coutVoixParCaractere = reserve;
    const lus = b.d.lus.length;
    const r = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Mot", operations: ops(operation), parent }));
    expect(b.d.lus.length - lus).toBe(1);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur?.messagePourWill).toContain("dépasserait le prix confirmé de la voix");
  });

  it("rien à relire réservé (aucune ligne « Voix ») : si la voix change pendant l'attente, aucune lecture n'est payée", async () => {
    const { b, c, parent } = await videoFabriquee();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Phrase", operations: ops([{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }]), parent });
    // État d'une retouche dont l'aperçu n'a rien à relire (ex. un chiffre affiché mais jamais dit) : sa réservation n'a
    // aucune ligne « Voix ». Puis la voix change avant que le travail ne parte (voix épinglée à nouveau) : tout est à relire.
    const etat = t.parametres!.casConcret as { retouche: { aRelire: unknown } };
    etat.retouche.aRelire = { fins: [] };
    expect((await b.moteur.estimerRetouche(c, [], { travail: t })).lignes.map((l) => l.etape)).not.toContain("Voix");
    b.d.options.outils.voix = { ...b.d.options.outils.voix, idVoix: "une-autre-voix" };
    const lus = b.d.lus.length;
    const r = await avancerJusqua(b.moteur, c, t);
    expect(b.d.lus.length - lus).toBe(0);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur?.messagePourWill).toContain("dépasserait le prix confirmé de la voix");
  });
});

describe("P2-02 · moteur : refus avant tout lancement", () => {
  it("P2R : un mot branché nulle part n'est jamais dit : le changer est refusé sans rien lancer", async () => {
    const { b, c, parent } = await videoFabriquee([]);
    const lus = b.d.lus.length;
    const soumises = b.d.soumises.length;
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops([{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }]), parent });
    expect(t.statut).toBe("echec");
    expect(t.erreur?.messagePourWill).toBe("Cette retouche ne change rien à la vidéo.");
    expect(b.d.lus.length).toBe(lus);
    expect(b.d.soumises.length).toBe(soumises);
  });

  it("une opération qui enfreint une règle est refusée sans rien lancer", async () => {
    const { b, c, parent } = await videoFabriquee();
    const lus = b.d.lus.length;
    const soumises = b.d.soumises.length;
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops([{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "nos 37 annonces" }]), parent });
    expect(t.statut).toBe("echec");
    expect(t.erreur?.reessayable).toBe(false);
    expect(t.erreur?.messagePourWill).toContain("Cette retouche n'est pas possible.");
    expect(t.erreur?.messagePourWill).toContain("« 37 »");
    expect(t.etapes.every((e) => e.statut === "ignoree")).toBe(true);
    expect(b.d.lus.length).toBe(lus);
    expect(b.d.soumises.length).toBe(soumises);
    expect(estimerRetoucheCasConcret(c, [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "nos 37 annonces" }], parent).estimation.total.centimes).toBe(0);
  });

  it("une opération inconnue est refusée sans rien lancer", async () => {
    const { b, c, parent } = await videoFabriquee();
    const lus = b.d.lus.length;
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops([{ type: "changer-musique" }]), parent });
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("CAS_CONCRET_RETOUCHE_REFUSEE");
    expect(t.erreur?.messagePourWill).toBe("Cette retouche ne fait pas partie de la liste proposée.");
    expect(b.d.lus.length).toBe(lus);
    expect(estimerRetoucheCasConcret(c, [{ type: "changer-musique" }], parent).refus).toBe("Cette retouche ne fait pas partie de la liste proposée.");
  });

  it("sans fiche gardée par la version d'avant : refus lisible", async () => {
    const b = banc({ retouches: true });
    const c = b.commande();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops([{ type: "sans-le-mot" }]), parent: { versionId: "v", pistes: [] } });
    expect(t.statut).toBe("echec");
    expect(t.erreur?.messagePourWill).toBe("La fiche d'écrans de cette vidéo est introuvable : la retouche n'est pas possible.");
  });

  it("sans opération, la réservation est le corps au pire (ni fins ni écriture) : la retouche libre est refusée, rien n'est payé", async () => {
    const b = banc({ retouches: true });
    const c = b.commande();
    const r = await b.moteur.estimerRetouche(c, []);
    expect(r.lignes.map((l) => l.etape)).not.toContain("Écriture");
    expect(r.total.centimes).toBeGreaterThan(0);
    expect(r.total.centimes).toBeLessThan((await b.moteur.estimer(c)).total.centimes);
    expect(b.moteur.capacites.retoucheParPlan).toBe(true);
    expect(b.moteur.refusRetouche?.(c)).toBeNull();
    expect(b.moteur.refusRetouche?.({ ...c, distribution: [] })?.code).toBe("CAS_CONCRET_SANS_VOIX");
  });
});

describe("P5 · la réservation d'une retouche est le coût exact de son aperçu, plus petit que la vidéo", () => {
  const phrase = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }];
  const mot = [{ type: "changer-mot", mot: "RDV", motDit: "R.D.V." }];

  it("avec les opérations : la réservation vaut l'aperçu et reste sous la vidéo entière (jamais l'écriture)", async () => {
    const { b, c, parent } = await videoFabriquee();
    const entiere = (await b.moteur.estimer(c)).total.centimes;
    for (const operation of [phrase, mot]) {
      const r = await b.moteur.estimerRetouche(c, [], { operations: ops(operation), parent });
      expect(r.total.centimes).toBe(estimerRetoucheCasConcret(c, operation, parent).estimation.total.centimes);
      expect(r.total.centimes).toBeLessThan(entiere);
      expect(r.lignes.map((l) => l.etape)).not.toContain("Écriture");
    }
  });

  it("opérations refusées : la réservation est celle d'une retouche sans opération (la retouche ne lira rien)", async () => {
    const { b, c, parent } = await videoFabriquee();
    const r = await b.moteur.estimerRetouche(c, [], { operations: ops([{ type: "changer-musique" }]), parent });
    expect(r.total.centimes).toBe((await b.moteur.estimerRetouche(c, [])).total.centimes);
  });

  it("la voix annoncée et réservée tient compte de la voix d'aujourd'hui : une voix changée relit tout", async () => {
    const { b, c, parent } = await videoFabriquee();
    const outils = versOutils(b.d);
    const memeVoix = estimerRetoucheCasConcret(c, phrase, parent, outils);
    const autreVoix = estimerRetoucheCasConcret(c, phrase, parent, { ...outils, voix: { ...outils.voix, idVoix: "une-autre-voix" } });
    expect(memeVoix.apercu?.finsRelues).toEqual([]);
    expect(autreVoix.apercu?.finsRelues.length).toBeGreaterThan(0);
    expect(autreVoix.estimation.total.centimes).toBeGreaterThan(memeVoix.estimation.total.centimes);
  });

  it("le plafond de la voix d'une retouche est cette réservation, reprise au « Réessayer »", async () => {
    const { b, c, parent } = await videoFabriquee();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Mot", operations: ops(mot), parent });
    const reserve = await b.moteur.estimerRetouche(c, [], { operations: ops(mot), parent });
    const relance = await b.moteur.estimerRetouche(c, [], { travail: t });
    expect(relance.total.centimes).toBe(reserve.total.centimes);
  });
});
