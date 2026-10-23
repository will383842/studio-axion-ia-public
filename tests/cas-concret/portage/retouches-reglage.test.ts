/**
 * Portage phase 2 · P5 : la retouche par opérations est derrière `casConcret.retouches`, ÉTEINT par défaut. Éteint : le
 * moteur refuse comme avant (rien lu, rien payé, rien rendu) et `refusRetouche` reste non nul, donc la réponse commune de
 * « Demander une modification » ne change pas. Allumé (dans le double seulement) : la retouche garde la variété de la
 * version d'avant, et la réservation est le « au plus » de master. Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { type EntreeHistorique } from "@/moteurs/montage-cas-concret/variete";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { banc, versOutils } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const ops = (o: unknown[]) => o as OperationMontage[];
const PHRASE = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }];

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

describe("P5 · retouches éteintes (défaut)", () => {
  it("le moteur refuse toute retouche : refusRetouche non nul, retoucher échoue sans rien lire ni rendre", async () => {
    const b = banc({ retouches: false });
    const c = b.commande();
    expect(b.moteur.refusRetouche?.(c)).toEqual({ code: "RETOUCHE_NON_PRISE_EN_CHARGE", message: expect.stringContaining("retouche") });
    const lus = b.d.lus.length;
    const soumises = b.d.soumises.length;
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops(PHRASE), parent: { versionId: "v", pistes: [] } });
    expect(t.statut).toBe("echec");
    expect(t.erreur?.code).toBe("RETOUCHE_NON_PRISE_EN_CHARGE");
    expect(b.d.lus.length).toBe(lus);
    expect(b.d.soumises.length).toBe(soumises);
  });

  it("sans fourniture du réglage au moteur (défaut du code), c'est éteint aussi", async () => {
    const b = banc();
    const moteur = creerMoteurMontageCasConcret({ outils: async () => versOutils(b.d, b.fiches) });
    expect(moteur.refusRetouche?.(b.commande())).not.toBeNull();
  });
});

describe("P5 · retouches allumées dans le double", () => {
  it("la variété de la version d'avant est gardée : même mise, aucun nouveau tirage dans l'historique", async () => {
    const b = banc({ motSur: ["facebook", "instagram"], retouches: true });
    const c = b.commande();
    const historique: EntreeHistorique[] = [];
    const ajouts: EntreeHistorique[] = [];
    const variete = { lireHistorique: async () => historique, ajouter: async (e: EntreeHistorique) => void ajouts.push(e) };
    const moteur = creerMoteurMontageCasConcret({ outils: async () => ({ ...versOutils(b.d, b.fiches), variete }), retouchesAllumees: () => true });
    const premiere = await avancerJusqua(moteur, c, await moteur.lancer(c, ctx("t-1")));
    expect(premiere.travail.statut).toBe("termine");
    const miseAvant = (premiere.resultat!.projetMontage.casConcret as { fiche: { mise?: unknown } }).fiche.mise;
    expect(miseAvant).toBeTruthy();
    const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(premiere.resultat!.projetMontage)), pistes: [] };
    const avant = ajouts.length;
    const t = await moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "", operations: ops(PHRASE), parent });
    const fin = await avancerJusqua(moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    const miseApres = (fin.resultat!.projetMontage.casConcret as { fiche: { mise?: unknown } }).fiche.mise;
    expect(miseApres).toEqual(miseAvant);
    // Le tirage noté pour la vidéo est le même (l'historique remplace la ligne de la vidéo, il ne gagne pas de tirage).
    expect(ajouts.length).toBeGreaterThan(0);
    for (const e of ajouts.slice(avant)) expect(e.tirage).toEqual((miseAvant as { tirage: unknown }).tirage);
  });

  it("sans opération, la réservation est le corps à lectures maximales (la ressemblance les multiplie), jamais les fins ni l'écriture", async () => {
    const b = banc({ retouches: true });
    const sans = b.commande();
    const avec = b.commande({ entrees: { ...sans.entrees, ressemblanceVoix: { actif: true, relancesMax: 2, seuil: 0.8 } } as never });
    const vie = (await b.moteur.estimer(avec)).lignes.find((l) => l.etape === "Voix")!.total.centimes;
    const r1 = await b.moteur.estimerRetouche(sans, []);
    const r3 = await b.moteur.estimerRetouche(avec, []);
    expect(r3.lignes.map((l) => l.etape)).not.toContain("Écriture");
    expect(r3.lignes.find((l) => l.etape === "Voix")!.total.centimes).toBeGreaterThan(r1.lignes.find((l) => l.etape === "Voix")!.total.centimes);
    expect(r3.lignes.find((l) => l.etape === "Voix")!.total.centimes).toBeLessThan(vie);
  });
});
