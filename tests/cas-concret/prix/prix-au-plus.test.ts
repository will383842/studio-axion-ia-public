/**
 * PRIX « AU PLUS » DU CAS CONCRET (essai réel du 17/10, v-99d2f6353f41 « Cas concret MD ») : « Lancer la vidéo (≈ 0,56 €) »,
 * confirmé « au plus 0,56 € », puis 1,05 € payés après l'arrêt de la voix. Le prix comptait le texte entier × les
 * lectures du contrôle de ressemblance (1 021 caractères × 2) ; la chaîne lit le corps jusqu'à 3 fois et chaque fin
 * 2 fois, CHACUNE de ces lectures pouvant être relancée par la ressemblance (le corps de 769 caractères lu 5 fois à
 * 21 c = 1,05 €). Ici : le pire cas réel tient dans le prix annoncé, et la chaîne s'arrête avant toute lecture qui
 * dépasserait la part « voix » du prix confirmé. Doubles seulement, aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { centimes, formaterMontant } from "@/lib/montants";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { phrasePlafondVoix } from "@/moteurs/montage-cas-concret/fabriquer";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { scriptValideDuCatalogue } from "@/moteurs/montage-cas-concret/script-valide";
import { LECTURES_CORPS_MAX, LECTURES_FIN_MAX } from "@/moteurs/montage-cas-concret/voix";
import type { MoteurVideo } from "@/moteurs/types";
import { banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 17, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;
/** Toutes les lectures avalent un mot : chaque prise est rejetée, jusqu'à l'arrêt de la voix. */
const TOUTES = Array.from({ length: 80 }, (_, i) => i + 1);

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, t: Travail) {
  for (let n = 0; n < 300 && t.statut !== "termine" && t.statut !== "echec"; n++) t = (await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000)).travail;
  return t;
}

type Lignes = { lignes: { etape: string; quantite: number; total: { centimes: number } }[] };
const voixDe = (e: Lignes) => e.lignes.find((l) => l.etape === "Voix")!;
/** Prix d'une lecture au tarif HeyGen de l'estimation (0,03 $ × 0,9 le caractère), arrondi au centime supérieur. */
const prixLecture = (n: number) => Math.ceil(n * 0.03 * 0.9 - 1e-9);

describe("cas concret · le prix annoncé est un vrai plafond (17/10)", () => {
  it("l'essai réel : 4 réseaux, 2 lectures de ressemblance, 5 lectures du corps payées (1,05 €) tiennent dans le prix annoncé", () => {
    const cas = trouverCas("recrutement-apporteurs")!;
    const corps = texteDuCorps({ ecrans: scriptValideDuCatalogue(cas.id)!.ecrans } as never);
    const voix = voixDe(estimerDepuisCas(cas, [...RESEAUX], false, { voix: { fournisseur: "heygen" }, lecturesVoixMax: 2 }));
    // Avant : 1 021 caractères × 2 = 0,56 € ; payé : 5 lectures du corps à 21 c.
    expect(5 * prixLecture(corps.length)).toBe(105);
    expect(voix.total.centimes).toBeGreaterThanOrEqual(105);
    // Le pire cas : le corps 3 × 2 fois, chaque fin 2 × 2 fois.
    expect(voix.total.centimes).toBeGreaterThanOrEqual(LECTURES_CORPS_MAX * 2 * prixLecture(corps.length));
  });

  it("pire cas réel de la chaîne (toutes les lectures ratent) : les caractères lus tiennent dans le prix annoncé", async () => {
    const b = banc({ scriptValide: "catalogue", lecturesFautives: TOUTES });
    const c = b.commande();
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-pire")));
    expect(t.statut).toBe("echec");
    expect(b.d.lus.length).toBe(LECTURES_CORPS_MAX);
    const annonce = voixDe(await b.moteur.estimer(c));
    expect(b.d.lus.reduce((n, x) => n + x.length, 0)).toBeLessThanOrEqual(annonce.quantite);
    expect(b.d.lus.reduce((n, x) => n + prixLecture(x.length), 0)).toBeLessThanOrEqual(annonce.total.centimes);
  });

  it("chaque fin peut être relue : le prix compte 2 lectures par fin", () => {
    const cas = trouverCas("recrutement-apporteurs")!;
    const corps = texteDuCorps({ ecrans: scriptValideDuCatalogue(cas.id)!.ecrans } as never);
    const un = voixDe(estimerDepuisCas(cas, ["facebook"], false, { voix: { fournisseur: "heygen" } }));
    const fins = (un.quantite - LECTURES_CORPS_MAX * corps.length) / LECTURES_FIN_MAX;
    expect(fins).toBeGreaterThan(0);
    expect(Number.isInteger(fins)).toBe(true);
    expect(voixDe(estimerDepuisCas(cas, ["facebook"], false, { voix: { fournisseur: "heygen" }, lecturesVoixMax: 3 })).quantite).toBe(un.quantite * 3);
  });

  it("une lecture qui dépasserait le prix confirmé n'est pas faite : arrêt clair, rien de payé au-delà", async () => {
    // Prononciation qui allonge le texte lu (le prix est compté sur le texte écrit) : le plafond est atteint avant le pire cas.
    const longue = "recrute ".repeat(40).trim();
    const b = banc({ scriptValide: "catalogue", lecturesFautives: TOUTES, coutVoixParCaractere: 0.027 });
    const c = b.commande({ prononciations: [{ mot: "recrute", prononciation: longue }] } as Partial<CommandeFabrication>);
    const plafond = voixDe(await b.moteur.estimer(c)).total.centimes;
    const t = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-plafond")));
    expect(t.statut).toBe("echec");
    expect(t.erreur?.messagePourWill).toContain("dépasserait le prix confirmé de la voix");
    expect(b.d.lus.length).toBeGreaterThan(0);
    expect(b.d.lus.length).toBeLessThan(LECTURES_CORPS_MAX);
    expect(b.d.lus.reduce((n, x) => n + prixLecture(x.length), 0)).toBeLessThanOrEqual(plafond);
  });

  it("la phrase de l'arrêt dit le plafond et ce qui est déjà payé", () => {
    expect(phrasePlafondVoix(156, 105)).toBe(`Une lecture de plus dépasserait le prix confirmé de la voix (au plus ${formaterMontant(centimes(156))}, ${formaterMontant(centimes(105))} déjà payés) : rien de plus n'est payé. Relancez la vidéo pour confirmer un nouveau prix.`);
    expect(formaterMontant(centimes(156))).toMatch(/^1,56\s€$/u);
  });
});
