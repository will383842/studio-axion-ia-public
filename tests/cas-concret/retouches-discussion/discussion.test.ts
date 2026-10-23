/**
 * P2S, lot A, point 2 · retouches par discussion. Une phrase de Will devient des opérations de la liste fermée (P2-02)
 * par UN appel détaché ; l'aperçu (ce qui change, ce qui est refait, le prix) est montré AVANT d'agir ; rien ne part sans
 * l'accord ; une demande hors liste est refusée en une phrase avec ce qui est possible ; si seule la fin change, le corps
 * n'est ni relu ni rendu. Doubles de Claude et du chemin de retouche : aucun appel réel, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret-retouches");
const { estimerRetoucheCasConcret } = await import("@/moteurs/montage-cas-concret");
const discussion = await import("@/moteurs/montage-cas-concret/discussion");
const { ecritureDetachee } = await import("@/moteurs/montage-cas-concret/appels");
const { banc } = await import("../moteur/doubles");

import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { MoteurVideo, ParentRetouche, ResultatFabrication } from "@/moteurs/types";

const MDP = "cas-concret-discussion";
const VIDEO = "v-03";
const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

/* ---------- Une vidéo fabriquée en simulation (mot branché sur Facebook et Instagram) ---------- */

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

let fabriquee: { commande: CommandeFabrication; parent: ParentRetouche; fiche: FicheEcrans } | undefined;
async function videoFabriquee() {
  if (fabriquee) return fabriquee;
  const b = banc({ motSur: ["facebook", "instagram"] });
  const commande = b.commande();
  const fin = await avancerJusqua(b.moteur, commande, await b.moteur.lancer(commande, { travailId: "t-1", versionId: "ver-t-1", titre: "Essai", maintenant: T0 }));
  expect(fin.travail.statut).toBe("termine");
  const projetMontage = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as Record<string, unknown>;
  fabriquee = { commande, parent: { versionId: "ver-t-1", projetMontage, pistes: [] }, fiche: (projetMontage.casConcret as { fiche: FicheEcrans }).fiche };
  return fabriquee;
}

const ecransCorps = (f: FicheEcrans) => f.ecrans.map((e) => ({ id: e.id, type: e.type, texteDit: e.texteDit }));

/* ---------- Doubles de Claude ---------- */

function claude(reponse: "simuler" | ReponseAppelEcriture = "simuler") {
  const appels: EntreeRole[] = [];
  const reservations: string[] = [];
  const outils: OutilsEcriture = {
    async appeler(role: DefinitionRole, e: EntreeRole) {
      appels.push(e);
      return reponse === "simuler" ? { ok: true, simule: true, donnees: role.simuler(e) } : reponse;
    },
    budget: {
      async reserver(d) {
        reservations.push(d.appelId);
        return { ok: true };
      },
    },
  };
  return { outils, appels, reservations };
}

describe("discussion : de la phrase aux opérations (simulation déterministe)", () => {
  it("chaque tournure donne l'opération de la liste fermée ; le reste est hors liste", async () => {
    const { fiche } = await videoFabriquee();
    const ecrans = ecransCorps(fiche);
    const etapes = ecrans.filter((e) => e.type === "etape");
    const dernier = ecrans[ecrans.length - 1];
    expect(discussion.operationsSimulees("Faites-la sans le mot.", ecrans).operations).toEqual([{ type: "sans-le-mot" }]);
    expect(discussion.operationsSimulees("Changez le mot à commenter : RDV", ecrans).operations).toEqual([{ type: "changer-mot", mot: "RDV" }]);
    expect(discussion.operationsSimulees("Retirez l'étape 2.", ecrans).operations).toEqual([{ type: "retirer-etape", ecranId: etapes[1].id }]);
    expect(discussion.operationsSimulees("Remontez la troisième étape.", ecrans).operations).toEqual([{ type: "deplacer-etape", ecranId: etapes[2].id, vers: "avant" }]);
    expect(discussion.operationsSimulees("Changez la fin : « Et vous, que confieriez-vous ? »", ecrans).operations).toEqual([{ type: "changer-phrase", ecranId: dernier.id, avant: dernier.texteDit.trim(), apres: "Et vous, que confieriez-vous ?" }]);
    const hors = discussion.operationsSimulees("Mettez une musique plus gaie.", ecrans);
    expect(hors.operations).toEqual([]);
    expect(hors.horsListe).toBeTruthy();
  });

  it("UN appel, précédé de sa réservation ; hors liste : la phrase qui dit ce qui est possible", async () => {
    const { fiche } = await videoFabriquee();
    const reglages = { mot: "IA", avecMot: true };
    const c = claude();
    const ok = await discussion.traduireDemande({ demande: "Faites-la sans le mot.", fiche, reglages, videoId: "v", cle: "k1" }, c.outils);
    expect(ok).toEqual({ ok: true, operations: [{ type: "sans-le-mot" }] });
    expect(c.appels).toHaveLength(1);
    expect(c.reservations).toEqual(["ccret-v-k1"]);
    expect(c.appels[0].variable).toContain("<demande>Faites-la sans le mot.</demande>");

    const hors = await discussion.traduireDemande({ demande: "Mettez une musique plus gaie.", fiche, reglages, videoId: "v", cle: "k2" }, claude().outils);
    expect(hors).toEqual({ ok: false, motif: "hors-liste", message: discussion.PHRASE_HORS_LISTE });
    expect(discussion.PHRASE_HORS_LISTE).toMatch(/^Je ne sais pas faire cette retouche\. Je peux : changer une phrase, .*sans le mot\.$/);
  });

  it("une opération inventée hors de la liste, une réponse coupée, une demande vide : rien n'est proposé", async () => {
    const { fiche } = await videoFabriquee();
    const reglages = { mot: "IA", avecMot: true };
    const inventee = claude({ ok: true, simule: false, texte: JSON.stringify({ operations: [{ type: "changer-musique" }] }) });
    expect(await discussion.traduireDemande({ demande: "Une autre musique.", fiche, reglages, videoId: "v", cle: "k" }, inventee.outils)).toMatchObject({ ok: false, motif: "hors-liste" });
    const coupee = claude({ ok: true, simule: false, texte: "{", stopReason: "max_tokens" });
    expect(await discussion.traduireDemande({ demande: "Sans le mot.", fiche, reglages, videoId: "v", cle: "k" }, coupee.outils)).toMatchObject({ ok: false, motif: "illisible" });
    const vide = claude();
    expect(await discussion.traduireDemande({ demande: "  ", fiche, reglages, videoId: "v", cle: "k" }, vide.outils)).toEqual({ ok: false, motif: "vide", message: discussion.PHRASE_DEMANDE_VIDE });
    expect(vide.appels).toHaveLength(0);
  });

  it("appel détaché : le premier passage le lance sans l'attendre ; tant qu'il n'a pas répondu, rien n'est relancé", async () => {
    const { fiche } = await videoFabriquee();
    const c = claude();
    const lances: string[] = [];
    const reponses = new Map<string, ReponseAppelEcriture>();
    const journal = {};
    const detache = { lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void (lances.push(cle), appel().then((r) => reponses.set(cle, r))), lire: async (cle: string) => reponses.get(cle) ?? null };
    const attente = new Error("attente");
    const outils = () => ecritureDetachee({ ...c.outils, detache }, { journal, garder: async () => undefined, horloge: () => T0, libelle: "La retouche", attente: () => attente, expire: (p) => new Error(p) });
    const entree = { demande: "Sans le mot.", fiche, reglages: { mot: "IA", avecMot: true }, videoId: "v", cle: "k" };
    await expect(discussion.traduireDemande(entree, outils())).rejects.toBe(attente);
    await new Promise((r) => setTimeout(r, 0));
    expect(await discussion.traduireDemande(entree, outils())).toEqual({ ok: true, operations: [{ type: "sans-le-mot" }] });
    expect(lances).toHaveLength(1);
    expect(c.reservations).toHaveLength(1);
  });
});

describe("discussion : seul ce qui change est refait", () => {
  it("changer le mot (seule la fin change) : le corps n'est ni relu ni rendu, la voix de la fin est refaite", async () => {
    const { commande, parent } = await videoFabriquee();
    const a = estimerRetoucheCasConcret(commande, [{ type: "changer-mot", mot: "RDV" }], parent);
    expect(a.refus).toBeNull();
    expect(a.apercu?.corpsRelu).toBe(false);
    expect(a.apercu?.finsRelues.length).toBeGreaterThan(0);
    expect(a.apercu?.ecransRefaits.length).toBeGreaterThan(0);
    expect(a.apercu?.ecransRefaits.every((id) => id.startsWith("fin-"))).toBe(true);
    expect(discussion.phraseRefaits(a.apercu!)).toMatch(/^je refais la voix des? fins? ; \d+ écrans? refaits?$/);
  });

  it("« changez la fin » (la dernière phrase) : un seul écran du corps est refait, avec les fins qu'il décale", async () => {
    const { commande, parent, fiche } = await videoFabriquee();
    const ops = discussion.operationsSimulees("Changez la fin : « Et vous, quelle tâche confieriez-vous à l'IA ? »", ecransCorps(fiche)).operations;
    const a = estimerRetoucheCasConcret(commande, ops, parent);
    expect(a.refus).toBeNull();
    const corps = a.apercu!.ecransRefaits.filter((id) => !id.startsWith("fin-"));
    expect(corps).toEqual([fiche.ecrans[fiche.ecrans.length - 1].id]);
    expect(discussion.phraseOperation(ops[0], fiche)).toBe(`Je change l'écran ${fiche.ecrans.length} : « Et vous, quelle tâche confieriez-vous à l'IA ? »`);
  });
});

/* ---------- Le service, sur la vidéo v-03 devenue une vidéo du format ---------- */

/** Double des appels détachés : l'appel ne répond qu'à `repondre()`. */
function detaches() {
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  return {
    enAttente,
    appels: { lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void enAttente.set(cle, appel), lire: async (cle: string) => reponses.get(cle) ?? null },
    repondre: async () => {
      for (const [cle, appel] of enAttente) reponses.set(cle, await appel());
      enAttente.clear();
    },
  };
}

async function videoDuFormat() {
  const { commande, parent } = await videoFabriquee();
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(video.versionChoisieId!, { estDemo: false, commande: { ...commande, videoId: VIDEO }, projetMontage: parent.projetMontage });
}

describe("service : proposer, montrer, confirmer", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    await videoDuFormat();
    // Réglage `casConcret.retouches` allumé DANS LE DOUBLE seulement (éteint par défaut dans le studio).
    await ecrireParametre("casConcret.retouches", true);
  });

  function dependances() {
    const det = detaches();
    const executer = vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
    const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
    return { det, executer, lancerRetouche, dep: { appels: det.appels, executer, claudeActif: async () => false, lancerRetouche } };
  }

  it("« changez le mot » : lu sans être attendu, montré avec le prix, rien ne part sans l'accord, puis la retouche part", async () => {
    const { det, executer, lancerRetouche, dep } = dependances();
    const premier = await service.proposerRetouche(VIDEO, "Changez le mot à commenter : RDV", dep);
    expect(premier).toMatchObject({ statut: "en-cours", phrase: service.PHRASE_LECTURE });
    expect(executer).not.toHaveBeenCalled();
    // La même demande, relue : jamais un second appel.
    expect((await service.proposerRetouche(VIDEO, "Changez le mot à commenter : RDV", dep)).statut).toBe("en-cours");
    expect(det.enAttente.size).toBe(1);
    await det.repondre();
    const propose = await service.suivreRetouche(VIDEO, dep);
    expect(propose).toMatchObject({ statut: "proposee", changements: ["Je fais dire le mot RDV"] });
    if (propose.statut !== "proposee") throw new Error(propose.statut);
    expect(propose.refaits).toMatch(/^je refais la voix des? fins?/);
    expect(propose.refaits).not.toContain("corps");
    expect(propose.prix).toMatch(/^environ .*€$/);
    expect(executer).toHaveBeenCalledTimes(1);

    // Un montant trop bas redemande. Un accord absent ou illisible (`false`) n'est jamais changé en `true` : il va tel quel à
    // `lancerRetouche`, qui applique la règle commune du seuil (voir tests/modifications/cas-concret-correctifs.test.ts).
    if (propose.centimes > 0) expect((await service.confirmerRetouche(VIDEO, propose.centimes - 1, dep)).statut).toBe("accord-requis");
    expect(lancerRetouche).not.toHaveBeenCalled();
    expect(await service.confirmerRetouche(VIDEO, propose.centimes, dep)).toEqual({ statut: "lancee", travailId: "t-retouche" });
    expect(lancerRetouche).toHaveBeenCalledWith(VIDEO, [], "Changez le mot à commenter : RDV", { confirme: propose.centimes, operations: [{ type: "changer-mot", mot: "RDV" }] });
    // La demande est oubliée.
    expect(await service.suivreRetouche(VIDEO, dep)).toEqual({ statut: "aucune" });
  });

  it("« Confirmer » sans montant (accord `true`) lance avec cet accord : le budget du studio redemande le montant au-delà de son seuil", async () => {
    const { det, lancerRetouche, dep } = dependances();
    await service.proposerRetouche(VIDEO, "Sans le mot.", dep);
    await det.repondre();
    await service.suivreRetouche(VIDEO, dep);
    expect(await service.confirmerRetouche(VIDEO, true, dep)).toEqual({ statut: "lancee", travailId: "t-retouche" });
    expect(lancerRetouche).toHaveBeenCalledWith(VIDEO, [], "Sans le mot.", { confirme: true, operations: [{ type: "sans-le-mot" }] });
  });

  it("une confirmation visant une autre demande que celle en cours est refusée", async () => {
    const { det, lancerRetouche, dep } = dependances();
    await service.proposerRetouche(VIDEO, "Sans le mot.", dep);
    await det.repondre();
    await service.suivreRetouche(VIDEO, dep);
    expect(await service.confirmerRetouche(VIDEO, true, { ...dep, demande: "Une autre demande." })).toMatchObject({ statut: "refusee" });
    expect(lancerRetouche).not.toHaveBeenCalled();
  });

  it("une demande hors liste : refusée en une phrase, avec ce qui est possible ; rien ne peut partir", async () => {
    const { det, lancerRetouche, dep } = dependances();
    await service.proposerRetouche(VIDEO, "Mettez une musique plus gaie.", dep);
    await det.repondre();
    const r = await service.suivreRetouche(VIDEO, dep);
    expect(r).toMatchObject({ statut: "refusee", phrase: discussion.PHRASE_HORS_LISTE });
    if (r.statut !== "refusee") throw new Error(r.statut);
    expect(r.possibles).toContain("changer une phrase");
    expect(await service.confirmerRetouche(VIDEO, 10_000, dep)).toMatchObject({ statut: "refusee" });
    expect(lancerRetouche).not.toHaveBeenCalled();
  });

  it("une retouche qui enfreint une règle est refusée avec sa raison, sans rien lancer", async () => {
    const { det, lancerRetouche, dep } = dependances();
    await service.proposerRetouche(VIDEO, "Changez le mot à commenter : MACHINE", dep);
    await det.repondre();
    const r = await service.suivreRetouche(VIDEO, dep);
    expect(r).toMatchObject({ statut: "refusee", phrase: expect.stringContaining("mots interdits") });
    expect(await service.confirmerRetouche(VIDEO, 10_000, dep)).toMatchObject({ statut: "refusee" });
    expect(lancerRetouche).not.toHaveBeenCalled();
  });

  it("« Annuler » oublie la demande", async () => {
    const { dep } = dependances();
    await service.proposerRetouche(VIDEO, "Sans le mot.", dep);
    await service.abandonnerRetouche(VIDEO);
    expect(await service.suivreRetouche(VIDEO, dep)).toEqual({ statut: "aucune" });
  });
});

describe("service : réglage « casConcret.retouches » éteint (défaut)", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    await videoDuFormat();
  });

  it("aucune demande n'est lue, aucun appel Claude, rien ne part", async () => {
    const executer = vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }));
    const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
    const dep = { executer, claudeActif: async () => false, lancerRetouche };
    expect(await service.proposerRetouche(VIDEO, "Sans le mot.", dep)).toEqual({ statut: "refusee", demande: "Sans le mot.", phrase: service.PHRASE_RETOUCHES_ETEINTES, possibles: [] });
    expect(await service.suivreRetouche(VIDEO, dep)).toEqual({ statut: "aucune" });
    expect(await service.confirmerRetouche(VIDEO, 10_000, dep)).toEqual({ statut: "refusee", phrase: service.PHRASE_RETOUCHES_ETEINTES });
    expect(executer).not.toHaveBeenCalled();
    expect(lancerRetouche).not.toHaveBeenCalled();
  });
});

describe("service : « déplacer une étape » reste au catalogue, son refus est lisible", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    await videoDuFormat();
    await ecrireParametre("casConcret.retouches", true);
  });

  it("l'opération est comprise, puis refusée par la règle d'ordre avec une phrase claire ; rien ne part", async () => {
    const det = detaches();
    const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
    const dep = { appels: det.appels, executer: vi.fn(async (_v: string, role: DefinitionRole, entree: EntreeRole) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) })), claudeActif: async () => false, lancerRetouche };
    expect(discussion.RETOUCHES_POSSIBLES).toContain("déplacer une étape");
    await service.proposerRetouche(VIDEO, "Remontez la troisième étape.", dep);
    await det.repondre();
    const r = await service.suivreRetouche(VIDEO, dep);
    expect(r.statut).toBe("refusee");
    if (r.statut !== "refusee") throw new Error(r.statut);
    expect(r.phrase).toBe(service.PHRASE_DEPLACER_REFUSE);
    expect(r.phrase).not.toMatch(/\be\d{2}\b|undefined|\[object/);
    expect(await service.confirmerRetouche(VIDEO, 10_000, dep)).toMatchObject({ statut: "refusee" });
    expect(lancerRetouche).not.toHaveBeenCalled();
  });
});
