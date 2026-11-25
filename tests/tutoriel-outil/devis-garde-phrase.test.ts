/**
 * PHRASE-4 : la garde du devis ne réserve plus d'appels au chef de projet (cahier établi) ni à l'analyste (pièce créée depuis une
 * phrase : sa carte est déduite sans Claude). Le total du devis, son empreinte et les essais permis ne changent pas.
 * Moteur réel, outils doubles : aucun appel réel, aucune voix, aucun rendu.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import type { OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { ENTREE_DEVIS_TUTORIEL, etablirDevis, lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { appliquerSortie, prochainPas, ROLES_APPELES, type EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { commandeTutoriel, outilsDoubles, type Journal } from "./doubles";
import { commandeDossier, FILM, fauxPort, fauxScenariste } from "./equipe-doubles";

const T0 = Date.UTC(2026, 10, 24, 9);
const PHRASE = "un tableau de bord pour un atelier";
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
type Devis = NonNullable<OutilsTutoriel["devis"]>;

// Devis de PRODUCTION : chef 1, analyste 1, maquettiste 1, stratège 1, scénariste 2, plan 2 = 8 appels.
const ROLES: Devis["roles"] = [
  { id: "chef-de-projet", essaisMax: 1 },
  { id: "analyste", essaisMax: 1 },
  { id: "maquettiste", essaisMax: 1 },
  { id: "stratege", essaisMax: 1 },
  { id: "scenariste", essaisMax: 2 },
  { id: "plan", essaisMax: 2 },
];

const commandePhrase = (): CommandeFabrication => commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { depot: { mode: "phrase", phrase: PHRASE }, fin: "aucune" } } } as never);
const avecAccord = (c: CommandeFabrication, empreinte: string): CommandeFabrication => ({ ...c, entrees: { ...c.entrees, [ENTREE_DEVIS_TUTORIEL]: { empreinte, le: "2026-11-18T10:00:00.000Z" } } });
const devisDe = (c: CommandeFabrication) => etablirDevis({ roles: ROLES, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c.ratios, essai: false });

function avecDevis(j: Journal, c: () => CommandeFabrication, equipe: PortEquipe): () => Promise<OutilsTutoriel> {
  const doubles = outilsDoubles(j, {});
  return async () => ({
    ...doubles,
    equipe,
    devis: {
      roles: ROLES,
      accord: lireAccordDevis(c().entrees),
      consomme: async (e) => ({ appelsClaude: (e.appelsClaude?.script ?? 0) + (e.appelsClaude?.plan ?? 0) + Object.values(e.appelsClaude?.roles ?? {}).reduce((n, v) => n + v, 0), caracteresVoix: 0, rendus: e.rendus.length }),
    },
  });
}

/** Port d'une phrase : la fiche garde 2 moments (la garde du scénariste limite les phrases) ; `refusePremier` : le 1er scénariste est illisible. */
function portPhrase(refusePremier = false) {
  const eq = fauxPort();
  const appels: string[] = [];
  let fiche: { moments: { id: string; zoneId: string }[] } | undefined;
  const port = {
    ...eq.port,
    phraseOuverte: true,
    async appelerRole(role: string, entree: unknown) {
      appels.push(role);
      if (role === "scenariste") return refusePremier && appels.filter((r) => r === role).length === 1 ? { illisible: true } : fauxScenariste(fiche!);
      let sortie = (await eq.port.appelerRole(role as never, entree as never)) as { moments: { id: string; zoneId: string }[] };
      if (role === "stratege") fiche = sortie = { ...sortie, moments: sortie.moments.slice(0, 2) };
      return sortie;
    },
  } as PortEquipe;
  return { port, appels };
}

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: () => CommandeFabrication, travail: Travail, jusqua = 60) {
  let t = travail;
  for (let i = 0; i < jusqua; i++) {
    t = (await moteur.avancer(t, c(), T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}
const pause = (t: Travail) => (t.parametres?.pause as { code: string } | undefined)?.code ?? null;

/** L'état de l'équipe d'une phrase dont la maquette est GARDÉE : le cahier est établi, la carte est déduite sans Claude. */
async function equipePieceGardee(): Promise<EtatEquipe> {
  let e: EtatEquipe = { demande: { phrase: PHRASE, ratios: ["4:5"] }, payes: {} };
  for (let i = 0; i < 6; i++) {
    const p = prochainPas(e, { dossier: null }, { phraseOuverte: true });
    if ("faire" in p && !p.payant) e = p.etat;
    else if ("faire" in p && p.faire === "maquettiste") e = (await appliquerSortie(e, "maquettiste", ROLES_APPELES.maquettiste!.simuler(p.entree as never), { dossier: null })).etat;
    else break;
  }
  const p = e.pieceCreee!;
  e = { ...e, pieceCreee: { ...p, statut: "gardee", apercu: { version: "apercu-piece.v1", empreinteDescription: p.empreinte, images: [{ ecranId: "accueil", etat: "avant", cle: "apercu/a.png" }], controle: { ok: true, defauts: [] } }, gardee: { empreinte: p.empreinte, le: "2026-11-24T10:00:00.000Z" } } };
  return e;
}

const avecEtat = (t: Travail, equipe: EtatEquipe, roles: Record<string, number>): Travail => ({
  ...t,
  parametres: { ...t.parametres, tutoriel: { ...(t.parametres!.tutoriel as object), equipe, appelsClaude: { plan: 0, roles } } },
});

describe("PHRASE-4 : garde du devis, vidéo partie d'une phrase", () => {
  it("(a) maquettiste appelé 2 fois (refus puis accord), puis stratège et scénariste ×2 : jamais TO_DEVIS_ATTEINT, écran de validation atteint", async () => {
    const j = journalVide();
    const eq = portPhrase(true);
    const c = avecAccord(commandePhrase(), devisDe(commandePhrase()).empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const equipe = await equipePieceGardee();
    expect(equipe.cahier).toBeDefined();
    // 2 appels au maquettiste déjà revenus : 2 consommés + 3 restants (stratège 1, scénariste 2) + plan 2 = 7 ≤ 8. L'ancienne garde comptait 9.
    const t = await mener(moteur, () => c, avecEtat(t0, { ...equipe, appels: { maquettiste: 2 } }, { maquettiste: 2 }));
    expect(eq.appels).toEqual(["stratege", "scenariste", "scenariste"]);
    expect(pause(t)).toBe("TO_SCRIPT_A_VALIDER");
    expect(j.claude).toHaveLength(0);
  });

  it("(b) un appel de trop est toujours arrêté : le devis reste une vraie borne", async () => {
    const j = journalVide();
    const eq = portPhrase();
    const c = avecAccord(commandePhrase(), devisDe(commandePhrase()).empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const equipe = await equipePieceGardee();
    // Maquettiste appelé 4 fois (2 de plus que le devis ne le permet avec la reprise) : 4 + 3 restants + plan 2 = 9 > 8 : arrêt, 0 appel.
    const t = await mener(moteur, () => c, avecEtat(t0, { ...equipe, appels: { maquettiste: 4 } }, { maquettiste: 4 }));
    expect(pause(t)).toBe("TO_DEVIS_ATTEINT");
    expect(eq.appels).toHaveLength(0);
    // Et l'orchestre ne peut pas dépasser : après tous les essais (stratège 1, scénariste 2) plus rien ne part.
    const t2 = await mener(moteur, () => c, avecEtat(t0, { ...equipe, appels: { maquettiste: 2 } }, { maquettiste: 2, stratege: 1, scenariste: 3 }));
    expect(pause(t2)).toBe("TO_DEVIS_ATTEINT");
    expect(eq.appels).toHaveLength(0);
  });
});

describe("PHRASE-4 : le dossier (.zip) ne change pas", () => {
  it("sans cahier, le chef et l'analyste restent réservés : stratège faux départ = même arrêt qu'avant", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const c0 = commandeDossier(FILM);
    const devis = etablirDevis({ roles: ROLES, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    // Devis 8 ; maquettiste appelé 3 fois (état forcé, aucun cahier) : 3 + 5 restants (chef, analyste, stratège, scénariste ×2) + plan 2 = 10 > 8 : arrêt.
    const depart = { ...t0, parametres: { ...t0.parametres, tutoriel: { ...(t0.parametres!.tutoriel as object), appelsClaude: { plan: 0, roles: { maquettiste: 3 } } } } };
    const t = await mener(moteur, () => c, depart);
    expect(pause(t)).toBe("TO_DEVIS_ATTEINT");
    expect(eq.appels).toHaveLength(0);
  });

  it("dossier, cahier établi, analyste jamais passé : l'analyste reste réservé (pas de pièce créée)", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const c0 = commandeDossier(FILM);
    const devis = etablirDevis({ roles: ROLES, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    // Chef 1 + maquettiste 3 consommés = 4 ; restants : analyste 1 + stratège 1 + scénariste 2 = 4 ; plan 2 : 4+4+2 = 10 > 8 (le dossier garde l'analyste).
    const equipe = await equipePieceGardee();
    const depart = avecEtat(t0, { demande: equipe.demande, payes: {}, ...(equipe.cahier ? { cahier: equipe.cahier } : {}) }, { "chef-de-projet": 1, maquettiste: 3 });
    const t = await mener(moteur, () => c, depart);
    expect(pause(t)).toBe("TO_DEVIS_ATTEINT");
    expect(eq.appels).toHaveLength(0);
  });
});
