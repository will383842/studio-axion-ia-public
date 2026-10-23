/**
 * D1 — intensité et bruitages DANS le moteur avocat (contrat §4) : réglage global figé dans la commande, un son
 * « à vérifier » jamais posé, sons validés posés sur la courbe, « Aucun » = aucun son, remixage d'un plan sans rien
 * refaire d'autre. Fournisseurs simulés, AUCUN appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const bruitages = await import("@/services/bruitages");
const { etape16Bruitages } = await import("@/services/migrations/etape-16-bruitages");
const { moteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { verifierIntensite, demandesDesPlans, demandesDesSousTitres, POIDS_EFFETS, ENTREE_BRUITAGES_PLANS } = await import("@/briques/intensite");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";

const MDP_TEST = "essai-d1-intensite";
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
});

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

/** Script riche en déclencheurs (chiffres, document, téléphone), pour que des sons aient leur place. */
async function commandeRiche(): Promise<CommandeFabrication> {
  const c = await fabrication.construireCommande("v-03");
  const segments = [
    { id: "a", texte: "Vous recevez un PV de 135 € ?", emphase: ["135 €"] },
    { id: "b", texte: "Ne le payez pas tout de suite, je vous explique pourquoi." },
    { id: "c", texte: "Regardez d'abord la date inscrite sur l'avis de contravention.", intentionIllustration: "un avis de contravention sur une table" },
    { id: "d", texte: "Si elle dépasse quarante-cinq jours, la procédure peut tomber entièrement.", emphase: ["quarante-cinq jours"] },
    { id: "e", texte: "Votre patron vous écrit un SMS à 23 heures pour vous licencier ?", intentionIllustration: "un téléphone posé sur un bureau avec une notification" },
    { id: "f", texte: "Un client a récupéré 2 500 € grâce à ce détail.", emphase: ["2 500 €"], incrustation: { type: "montant" as const, texte: "+ 2 500 €", sens: "gain" as const } },
    { id: "g", texte: "Gardez cette vidéo pour le prochain PV, et ne payez jamais tout de suite." },
  ];
  const blocs = [{ id: "b1", blocRecette: "accroche", segments: segments.slice(0, 1) }, { id: "b2", blocRecette: "promesse", segments: segments.slice(1, 2) }, { id: "b3", blocRecette: "coeur", segments: segments.slice(2, 5) }, { id: "b4", blocRecette: "preuve", segments: segments.slice(5, 6) }, { id: "b5", blocRecette: "appel", segments: segments.slice(6) }];
  return { ...c, script: { ...c.script, blocs, texteComplet: segments.map((s) => s.texte).join(" ") }, briques: { ...c.briques, illustrations: true, son: true, "sous-titres": true } };
}

async function validerTout() {
  await etape16Bruitages(depots(), "2026-10-02T00:00:00.000Z");
  for (const e of await depots().elements.lister((x) => x.id.startsWith("bruit-"))) await bruitages.changerEcouteBruitage(e.id, "validee");
}

describe("D1 — intensité et bruitages dans le moteur avocat", () => {
  it("réglage global : avocat = Équilibré + Discrets, choix de la vidéo prioritaire, figé dans la commande", async () => {
    const c = await fabrication.construireCommande("v-03");
    expect(c.intensite).toEqual({ niveau: "equilibre", bruitages: "discrets" });
    expect(c.sousTitres?.intensite).toBe("equilibre");
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { styles: { ...v.styles, intensite: "sobre", bruitages: "aucun" } });
    const c2 = await fabrication.construireCommande("v-03");
    expect(c2.intensite).toEqual({ niveau: "sobre", bruitages: "aucun" });
    expect(c2.sousTitres?.intensite).toBe("sobre");
  });

  it("un son « à vérifier » n'est JAMAIS dans la commande ; validé par Will, il l'est (avec son fichier)", async () => {
    await etape16Bruitages(depots(), "2026-10-02T00:00:00.000Z");
    expect((await fabrication.construireCommande("v-03")).bruitagesDisponibles).toBeUndefined();
    await bruitages.changerEcouteBruitage("bruit-chiffre-2", "validee");
    const c = await fabrication.construireCommande("v-03");
    expect(c.bruitagesDisponibles?.map((b) => b.elementId)).toEqual(["bruit-chiffre-2"]);
    expect(c.medias?.["bruit-chiffre-2"]?.cle).toBe("/bruitages/chiffre-2.wav");
    await bruitages.changerEcouteBruitage("bruit-chiffre-2", "a_verifier");
    expect((await fabrication.construireCommande("v-03")).bruitagesDisponibles).toBeUndefined();
    // Rien n'est effacé : le son est toujours là, simplement « à vérifier ».
    expect(await depots().elements.obtenir("bruit-chiffre-2")).toBeTruthy();
  });

  it("fabrication : rapport d'intensité sur la version, sons validés posés sur la courbe, jamais au-dessus du plafond", async () => {
    await validerTout();
    const c = await commandeRiche();
    const t = await moteurMontageAvocat.lancer(c, { travailId: "t-d1", versionId: "ver-d1", titre: "Essai", maintenant: T0 });
    const { travail, resultat } = await jusquAuBout(moteurMontageAvocat, c, t);
    expect(travail.statut).toBe("termine");
    const r = resultat!.rapportIntensite!;
    expect(r.niveau).toBe("equilibre");
    expect(r.depassements).toEqual([]);
    const projet = resultat!.projetMontage as { bruitages?: { elementId: string; debutSec: number; gainDb: number }[]; plansProduits: never[] };
    expect(projet.bruitages?.length ?? 0).toBeGreaterThan(0);
    for (const b of projet.bruitages!) {
      expect(c.bruitagesDisponibles?.some((x) => x.elementId === b.elementId)).toBe(true);
      expect(b.gainDb).toBe(-21);
    }
    const effets = [...demandesDesPlans(resultat!.plans as never[], "profil"), ...demandesDesSousTitres(resultat!.sousTitres ?? [])].map((d) => ({ id: d.id, type: d.type, debutSec: d.debutSec, finSec: d.finSec, poids: POIDS_EFFETS[d.type], verrouille: d.priorite === "verrouille" }));
    for (const b of projet.bruitages!) effets.push({ id: `son-${b.debutSec}`, type: "bruitage", debutSec: b.debutSec, finSec: b.debutSec + 0.2, poids: 1, verrouille: false });
    expect(verifierIntensite(effets, "equilibre")).toEqual([]);
  });

  it("« Aucun » : aucun son posé, même si des sons sont validés", async () => {
    await validerTout();
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { styles: { ...v.styles, bruitages: "aucun" } });
    const c = await commandeRiche();
    expect(c.bruitagesDisponibles).toBeUndefined();
    const t = await moteurMontageAvocat.lancer(c, { travailId: "t-d1b", versionId: "ver-d1b", titre: "Essai", maintenant: T0 });
    const { resultat } = await jusquAuBout(moteurMontageAvocat, c, t);
    expect((resultat!.projetMontage as { bruitages?: unknown[] }).bruitages).toBeUndefined();
    expect(resultat!.rapportIntensite).toBeTruthy();
  });

  it("après fabrication, « Aucun son » sur un plan : remixage seul (son refait, rien d'autre), gratuit", async () => {
    await validerTout();
    const c = await commandeRiche();
    const t = await moteurMontageAvocat.lancer(c, { travailId: "t-d1c", versionId: "ver-d1c", titre: "Essai", maintenant: T0 });
    const { resultat } = await jusquAuBout(moteurMontageAvocat, c, t);
    const projet = resultat!.projetMontage as { bruitages: { planId?: string }[] };
    const cible = projet.bruitages.find((b) => b.planId)!.planId!;
    const ordre = cible.replace("plan-", "");
    const c2 = { ...c, entrees: { ...c.entrees, [ENTREE_BRUITAGES_PLANS]: { [ordre]: { mode: "retire" } } } };
    const parent = { projetMontage: resultat!.projetMontage, pistes: [] } as never;
    const travail = await moteurMontageAvocat.recalquer!({ commande: c2, contexte: { travailId: "t-remix", versionId: "ver-remix", titre: "Sons" }, sousTitresId: "st", segments: resultat!.sousTitres ?? [], parent });
    const comp = travail.parametres!.composition as { mode: string; base: { bruitages: { planId?: string }[]; plans: unknown[] } };
    expect(comp.mode).toBe("remixage");
    expect(comp.base.bruitages.some((b) => b.planId === cible)).toBe(false);
    expect(comp.base.plans).toHaveLength((resultat!.plans ?? []).length);
    expect(travail.etapes.map((e) => e.cle)).toEqual(["son", "sous-titres", "export"]);
    // Sans changement de son : simple recalque des sous-titres, comme avant.
    const t2 = await moteurMontageAvocat.recalquer!({ commande: c, contexte: { travailId: "t-st", versionId: "ver-st", titre: "Sous-titres" }, sousTitresId: "st", segments: resultat!.sousTitres ?? [], parent });
    expect((t2.parametres!.composition as { mode: string }).mode).toBe("recalque");
  });
});
