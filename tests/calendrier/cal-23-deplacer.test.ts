/**
 * CAL-23 (écrite EN AVANCE, avant RC-08a) : déplacer ou modifier une publication déjà programmée.
 * AUCUN appel réel : le diffuseur est un FAUX qui enregistre ses appels. Interrupteurs d'essai uniquement ; rien n'est allumé.
 * Règles : « annuler puis recréer » avec une NOUVELLE clé ; la date ne change qu'après un retrait confirmé ; rien n'est supprimé.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FicheEntree, PHRASE_PROGRAMMEE_MODIFIABLE } from "@/components/calendrier/FicheEntree";
import { describe, expect, it } from "vitest";
import type { LotEcritures } from "@/domaine/depots";
import { cleEnvoi, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { instantParis } from "@/lib/horloge-paris";
import { deplacerProgrammation, modifierTexteProgramme, PHRASES_DEPLACEMENT, type DepsDeplacement, type IssueRetraitDiffuseur } from "@/services/deplacer-programmation";

const MAINTENANT = new Date("2026-12-10T10:00:00.000Z");
const DEMAIN = "2026-12-11T08:30:00.000Z";
const CLE = "a".repeat(64);

const envoi = (sur: Partial<EnvoiPlanifie> = {}): EnvoiPlanifie => ({
  id: "envoi:vis_1:linkedin:v0", cle: "envoi:vis_1:linkedin:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: CLE,
  reseau: "linkedin", versionCreneau: 0, jour: "2026-12-11", heure: "09:30", statut: "programme", valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur",
  creeLe: "2026-12-01T00:00:00Z", modifieLe: "2026-12-01T00:00:00Z", ...sur,
});

function monde(opts: { creneau?: Record<string, unknown>; envois?: EnvoiPlanifie[]; issues?: IssueRetraitDiffuseur[]; sansDiffuseur?: boolean; reglages?: boolean; ecritureEchoue?: number; marques?: Record<string, string> } = {}) {
  const creneaux = new Map<string, Record<string, unknown>>([["cre_1", {
    id: "cre_1", jourVise: "2026-12-11", heuresParReseau: { linkedin: DEMAIN }, compteCible: "c1", visuelId: "vis_1", statut: "programme", decalages: 0,
    valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur", textes: { linkedin: { texte: "Le texte", premierCommentaire: "Et vous ?" } }, ...opts.creneau,
  }]]);
  const envois = new Map((opts.envois ?? [envoi()]).map((e) => [e.id, e]));
  const visuels = new Map<string, Record<string, unknown>>([["vis_1", { id: "vis_1", statut: "programme", titre: "Carrousel", modifieLe: "x" }]]);
  const marques = new Map<string, string>(Object.entries(opts.marques ?? {}));
  const ordre: string[] = [];
  const retraits: string[] = [];
  const notifs: { cle: string; motif: string; raison: string }[] = [];
  const supprime: unknown[] = [];
  const issues = [...(opts.issues ?? [])];
  let ecritures = 0;
  const ouvert = opts.reglages ?? true;
  const deps: DepsDeplacement = {
    diffuseur: opts.sansDiffuseur ? null : { retirer: async (e) => { ordre.push("retrait"); retraits.push(e.cle); return issues.shift() ?? "retire"; } },
    reglagesOuverts: async () => ouvert,
    creneau: async (id) => (creneaux.get(id) as never) ?? null,
    envois: async (id) => [...envois.values()].filter((e) => e.creneauId === id),
    visuel: async (id) => (visuels.get(id) as never) ?? null,
    appliquer: async (lot: LotEcritures) => {
      ordre.push("ecriture");
      supprime.push(...lot.supprimer);
      if (opts.ecritureEchoue && ++ecritures <= opts.ecritureEchoue) throw new Error("écriture impossible");
      for (const { collection, entite } of lot.enregistrer) {
        if (collection === "creneauxEditoriaux") creneaux.set(entite.id, entite as never);
        if (collection === "envoisPlanifies") envois.set(entite.id, entite as EnvoiPlanifie);
        if (collection === "visuels") visuels.set(entite.id, entite as never);
      }
    },
    etats: { lire: async (c) => marques.get(c), noter: async (c, v) => void marques.set(c, v) },
    notifier: async (n) => void notifs.push(n),
    maintenant: () => MAINTENANT,
  };
  return { deps, creneaux, envois, visuels, marques, ordre, retraits, notifs, supprime, creneau: () => creneaux.get("cre_1") as Record<string, never> & { heuresParReseau: Record<string, string>; textes: Record<string, { texte: string }>; decalages: number; statut: string; valideeLe?: string; retireLe?: string; jourVise: string } };
}

const demande = (sur: Record<string, unknown> = {}) => ({ creneauId: "cre_1", nouveauJour: "2026-12-14", cle: "form-1", ...sur });
const vivants = (m: ReturnType<typeof monde>) => [...m.envois.values()].filter((e) => e.statut !== "annule");

describe("CAL-23 · déplacer : annuler puis recréer, une seule fois, à la nouvelle date", () => {
  it("retire chez le diffuseur AVANT toute écriture, puis recrée à la nouvelle date avec une NOUVELLE clé", async () => {
    const m = monde();
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.ordre[0]).toBe("retrait");
    // La recréation est faite par le tour d'envoi du créneau (clé = créneau + version) : le service pose la version suivante, sans doublon.
    expect(vivants(m)).toHaveLength(0);
    expect(r.ok && r.nouvellesCles).toEqual(["envoi:vis_1:linkedin:v1"]);
    expect(r.ok && r.nouvellesCles?.[0]).not.toBe("envoi:vis_1:linkedin:v0");
    expect(cleEnvoi("vis_1", "linkedin", m.creneau().decalages)).toBe("envoi:vis_1:linkedin:v1");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
    expect(m.creneau().heuresParReseau.linkedin).toBe(instantParis("2026-12-14", "09:30"));
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.creneau().decalages).toBe(1);
    expect(m.creneau().statut).toBe("valide");
    expect(m.supprime).toEqual([]);
  });

  it("un rejeu du même formulaire ne double rien : aucun second retrait, aucun second envoi", async () => {
    const m = monde();
    await deplacerProgrammation(m.deps, demande());
    const encore = await deplacerProgrammation(m.deps, demande());
    expect(encore.ok).toBe(true);
    expect(m.retraits).toHaveLength(1);
    expect(vivants(m)).toHaveLength(0);
    expect(m.envois.size).toBe(1);
    expect(m.creneau().decalages).toBe(1);
  });

  it("deux réseaux : un retrait par envoi, une nouvelle clé par réseau", async () => {
    const f = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "b".repeat(64) });
    const m = monde({ envois: [envoi(), f], creneau: { heuresParReseau: { linkedin: DEMAIN, facebook: DEMAIN } } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits.sort()).toEqual(["envoi:vis_1:facebook:v0", "envoi:vis_1:linkedin:v0"]);
    expect(r.ok && r.nouvellesCles?.sort()).toEqual(["envoi:vis_1:facebook:v1", "envoi:vis_1:linkedin:v1"]);
    expect(m.creneau().decalages).toBe(1);
  });

  it("avant la promotion (aucun brouillon chez le diffuseur) : aucun appel, la date change", async () => {
    const m = monde({ envois: [envoi({ cleDiffuseur: undefined, statut: "valide" })], creneau: { statut: "valide" } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits).toEqual([]);
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
  });

  it.each([["publie"], ["echec"], ["archive"]])("un créneau « %s » ne se déplace pas : aucun appel, aucune écriture", async (statut) => {
    const m = monde({ creneau: { statut } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(m.ordre).toEqual([]);
  });

  it("un envoi déjà parti ou en cours d'envoi bloque tout", async () => {
    for (const statut of ["envoye", "a-envoyer"] as const) {
      const m = monde({ envois: [envoi({ statut })] });
      const r = await deplacerProgrammation(m.deps, demande());
      expect(r.ok).toBe(false);
      expect(m.ordre).toEqual([]);
    }
    const m = monde({ marques: { "promotion:envoi:vis_1:linkedin:v0": "en-cours" } });
    expect((await deplacerProgrammation(m.deps, demande())).ok).toBe(false);
    expect(m.ordre).toEqual([]);
  });

  it("une heure déjà passée, ou un nouveau jour passé ou illisible : refus, ancienne date gardée", async () => {
    const passee = monde({ creneau: { heuresParReseau: { linkedin: "2026-12-10T09:00:00.000Z" } } });
    expect((await deplacerProgrammation(passee.deps, demande())).ok).toBe(false);
    expect(passee.ordre).toEqual([]);
    for (const nouveauJour of ["2026-12-09", "2026-12-10", "2026-13-40", "demain", ""]) {
      const m = monde();
      const r = await deplacerProgrammation(m.deps, demande({ nouveauJour }));
      expect(r.ok, nouveauJour).toBe(false);
      expect(m.ordre, nouveauJour).toEqual([]);
      expect(m.creneau().jourVise).toBe("2026-12-11");
    }
  });
});

describe("CAL-23 · le retrait échoue : l'ancienne date reste, un message le dit", () => {
  it.each([["refuse"], ["sans-reponse"], ["a-verifier"]] as const)("retrait « %s » : créneau et envois inchangés", async (issue) => {
    const m = monde({ issues: [issue] });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(10);
    expect(m.creneau().jourVise).toBe("2026-12-11");
    expect(m.creneau().statut).toBe("programme");
    expect(vivants(m).map((e) => e.cle)).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.envois.size).toBe(1);
  });

  it("réponse incertaine : marque « à vérifier » sur l'envoi, jamais un nouvel essai automatique", async () => {
    const m = monde({ issues: ["a-verifier"] });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok === false && r.etat).toBe("a-verifier");
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(m.retraits).toHaveLength(1);
  });

  it("envoi éteint : aucun appel au diffuseur, la publication reste programmée", async () => {
    const m = monde({ reglages: false });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(m.retraits).toEqual([]);
    expect(m.creneau().jourVise).toBe("2026-12-11");
  });

  it("retrait partiel (deux réseaux, le second échoue) : le premier retiré est noté annulé, le créneau reste programmé et le dit", async () => {
    const f = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "b".repeat(64) });
    const m = monde({ envois: [envoi(), f], issues: ["retire", "sans-reponse"], creneau: { heuresParReseau: { linkedin: DEMAIN, facebook: DEMAIN } } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(m.creneau().statut).toBe("programme");
    expect(m.creneau().jourVise).toBe("2026-12-11");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
    expect(m.envois.get("envoi:vis_1:facebook:v0")!.statut).toBe("programme");
    expect(r.ok === false && r.message).toMatch(/Facebook|LinkedIn/);
  });
});

describe("CAL-23 · la recréation échoue après un retrait réussi : retour dans « À placer », jamais « Programmé »", () => {
  it("garde le texte, marque a-reprogrammer, notifie, archive le créneau avec retireLe", async () => {
    const m = monde({ ecritureEchoue: 1 });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.etat).toBe("a-reprogrammer");
    expect(m.retraits).toHaveLength(1);
    expect(m.creneau().statut).toBe("archive");
    expect(m.creneau().retireLe).toBeTruthy();
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
    expect(m.marques.get("deplacement:envoi:vis_1:linkedin:v0")).toBe("a-reprogrammer");
    expect(m.notifs).toHaveLength(1);
    expect(m.notifs[0].motif).toBe("a-reprogrammer");
    expect(m.visuels.get("vis_1")!.statut).toBe("valide");
    expect(vivants(m).every((e) => e.statut !== "programme")).toBe(true);
    expect(m.supprime).toEqual([]);
  });

  it("si même le repli ne s'écrit pas : « à vérifier », rien de faux n'est affirmé", async () => {
    const m = monde({ ecritureEchoue: 2 });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.etat).toBe("a-verifier");
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
  });
});

describe("CAL-23 · fonction du client manquante sur master : déplacement LOCAL « à vérifier »", () => {
  it("sans port de retrait : aucun appel, la date est notée dans le Studio, l'envoi est marqué « à vérifier », aucun nouvel envoi (pas de doublon)", async () => {
    const m = monde({ sansDiffuseur: true });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(r.ok && r.etat).toBe("deplace-a-verifier");
    expect(r.ok && r.message).toContain("à vérifier");
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(m.envois.size).toBe(1);
    expect(m.retraits).toEqual([]);
  });
});

describe("CAL-23 · modifier le texte : repasse par le contrôleur et par le clic Valider", () => {
  const saisie = (sur: Record<string, unknown> = {}) => ({ creneauId: "cre_1", reseau: "linkedin", texte: "Un nouveau texte clair.", premierCommentaire: "Et vous ?", auteur: "will", cle: "txt-1", ...sur });

  it("retire chez le diffuseur, écrit le texte, dévalide (plus de valideeLe) : « À valider », aucun nouvel envoi", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r.ok).toBe(true);
    expect(m.retraits).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.creneau().textes.linkedin.texte).toBe("Un nouveau texte clair.");
    expect(m.creneau().statut).toBe("a_valider");
    expect(m.creneau().valideeLe).toBeUndefined();
    expect(vivants(m)).toHaveLength(0);
    expect(m.creneau().decalages).toBe(1); // la validation recréera l'envoi sous une NOUVELLE clé, jamais sous l'ancienne
  });

  it("un changement fait par un autre remet l'entrée à « Proposée »", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie({ auteur: "autre" }) as never);
    expect(r.ok).toBe(true);
    expect(m.creneau().statut).toBe("propose");
    expect(m.creneau().valideeLe).toBeUndefined();
  });

  it("texte vide ou trop long : refus avant tout appel", async () => {
    for (const texte of ["", "   ", "x".repeat(6000)]) {
      const m = monde();
      const r = await modifierTexteProgramme(m.deps, saisie({ texte }) as never);
      expect(r.ok).toBe(false);
      expect(m.ordre).toEqual([]);
    }
  });

  it("le retrait échoue : l'ancien texte et l'ancienne validation restent", async () => {
    const m = monde({ issues: ["sans-reponse"] });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r.ok).toBe(false);
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
    expect(m.creneau().statut).toBe("programme");
    expect(m.creneau().valideeLe).toBeTruthy();
  });

  it("texte identique : rien ne bouge, aucun appel", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie({ texte: "Le texte" }) as never);
    expect(r.ok).toBe(true);
    expect(m.ordre).toEqual([]);
    expect(m.creneau().statut).toBe("programme");
  });

  it("publiée ou passée : refus", async () => {
    const m = monde({ creneau: { statut: "publie" } });
    expect((await modifierTexteProgramme(m.deps, saisie() as never)).ok).toBe(false);
    expect(m.ordre).toEqual([]);
  });

  it("sans port de retrait : texte noté dans le Studio, dévalidé, envoi marqué « à vérifier »", async () => {
    const m = monde({ sansDiffuseur: true });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r.ok && r.etat).toBe("modifie-a-verifier");
    expect(m.creneau().statut).toBe("a_valider");
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
  });
});

describe("CAL-23 · périmètre, écran et vocabulaire", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  const action = lire("src/app/(studio)/calendrier/actions/deplacer.ts");
  const service = lire("src/services/deplacer-programmation.ts");
  const fiche = lire("src/components/calendrier/FicheEntree.tsx");

  it("l'action est « use server », exige la session en premier et n'appelle aucun fournisseur", () => {
    expect(action.trimStart().startsWith('"use server"')).toBe(true);
    for (const nom of ["deplacerProgrammationAction", "modifierTexteProgrammeAction"]) {
      const corps = action.slice(action.indexOf(`export async function ${nom}`));
      expect(corps.slice(0, corps.indexOf("{") + 120)).toContain("exigerSession");
    }
    expect(action).not.toMatch(/fournisseurs\/publication/);
  });

  it("le service n'importe aucun fournisseur ni le client du diffuseur (zone Zernio intacte)", () => {
    expect(service).not.toMatch(/from\s+["']@\/fournisseurs/);
    expect(service).not.toMatch(/zernio-client/);
  });

  const entreeProgrammee = { cle: "creneau:cre_1|linkedin", etat: "programme", jour: "2026-12-11", heure: "09:30", reseau: "linkedin", type: "carrousel", texte: "Le texte", confiee: true } as never;
  const rendre = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(FicheEntree, { entree: entreeProgrammee, aujourdhui: "2026-12-10", action: () => {}, selonStatut: true, surPrincipal: () => {}, ...extra }));

  it("fiche « Programmé » : verrouillée par défaut, modifiable seulement quand l'hôte le permet, et elle le dit", () => {
    expect(rendre({})).toMatch(/readonly/i);
    expect(rendre({})).not.toContain(PHRASE_PROGRAMMEE_MODIFIABLE);
    const ouverte = rendre({ texteProgrammeModifiable: true });
    expect(ouverte).not.toMatch(/<textarea[^>]*readonly/i);
    expect(ouverte).toContain(PHRASE_PROGRAMMEE_MODIFIABLE);
    expect(fiche).toContain("Modifier le texte");
    expect(PHRASE_PROGRAMMEE_MODIFIABLE).toMatch(/vous/);
  });

  it("phrases : vouvoiement, aucun prix, aucun nom d'outil", () => {
    const toutes = JSON.stringify(Object.values(PHRASES_DEPLACEMENT).map((p) => (typeof p === "function" ? (p as (...a: string[]) => string)("LinkedIn", "14/12") : p)));
    expect(toutes).not.toMatch(/€|\$|euro|prix|tarif|zernio|buffer/i);
    expect(toutes).toMatch(/vous|Vous|vos|votre|Rechargez|réessayez|relisez|retirez/i);
  });
});
