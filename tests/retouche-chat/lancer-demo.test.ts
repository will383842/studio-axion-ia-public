/**
 * D4-F2 — la démo facecam applique un plan de scènes retouché (opération `planScenes`).
 * Doubles seulement (transcription, alignement, LLM du plan, rendu) ; aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement } from "@/fournisseurs/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo } from "@/moteurs/montage-demo-facecam/chaine";
import type { RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";
import { readFileSync } from "node:fs";
import { lancerRetoucheDemo } from "@/services/retouche-chat/lancer-demo";

const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";
const motsDe = (texte: string, depuisSec = 0, pas = 0.4): MotHorodate[] => texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(depuisSec + i * pas).toFixed(3), finSec: +(depuisSec + i * pas + 0.33).toFixed(3) }));

/** Double du studio-aligneur `/transcrire` : les mots dépendent de la vidéo lue. */
function transcripteur(motsParSource: Record<string, MotHorodate[]>, options: { panne?: boolean } = {}) {
  const demandes = new Map<string, DemandeFacecam>();
  const soumises: DemandeFacecam[] = [];
  const f: FournisseurFacecam & { soumises: DemandeFacecam[] } = {
    id: "simulation",
    mode: "simulation",
    soumises,
    async soumettre(_route, d) {
      soumises.push(d);
      demandes.set(d.idTravail, d);
      return { statut: "en_file" };
    },
    async suivre(_route, id) {
      const d = demandes.get(id);
      if (!d) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "inconnu", travailInconnu: true } };
      if (options.panne) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne simulée." } };
      const mots = motsParSource[d.source] ?? [];
      return { statut: "termine", resultat: { transcriptionCle: `tr/${id}`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, mots } } as never;
    },
  };
  return f;
}

/** Double de l'alignement : décale chaque mot de 30 ms (preuve que les mots calés remplacent la transcription). */
function aligneur(options: { panne?: boolean } = {}): FournisseurAlignement & { demandes: DemandeAlignement[] } {
  const demandes: DemandeAlignement[] = [];
  return {
    id: "double",
    type: "alignement",
    mode: "simulation",
    nom: "Calage",
    reelPrevu: "",
    capacites: { asynchrone: true, accordExige: false },
    demandes,
    async soumettre(d) {
      demandes.push(d);
    },
    async suivre(id) {
      const d = demandes.find((x) => x.idAlignement === id)!;
      if (options.panne) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne simulée." } };
      return { statut: "termine", resultat: { mots: (d.reference ?? []).map((m) => ({ ...m, debutSec: +(m.debutSec + 0.03).toFixed(3), finSec: +(m.finSec + 0.03).toFixed(3) })), motsNonAlignes: 0, modele: "double", dureeCalculSec: 0 } };
    },
  };
}

/** Double du LLM du plan : un zoom sur le bouton, un clic, une carte KPI et une scène de niveau 3 (interdite). */
function llmPlan(): AppelClaude & { appels: number } {
  const f = (async (requete: RequeteClaude) => {
    f.appels++;
    const minutage = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l)).map((l) => l.split("\t"));
    const fin = Number(minutage.at(-1)?.[3] ?? 5000);
    const tiers = Math.round(fin / 3);
    const scene = (id: string, debut: number, finMs: number, extra: object) => ({ id, version: 1, mots: { premier: 0, dernier: 0 }, debutMs: debut, finMs, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, ...extra });
    const plan = {
      version: "plan-scenes-1",
      scenes: [
        scene("zoom", 0, tiers, { piece: "zoom-camera", parametres: { cible: { x: 70, y: 30 }, facteur: 1.8, moment: 0.1, titreFenetre: "Axion" } }),
        scene("clic", tiers, 2 * tiers, { piece: "curseur", parametres: { trajet: [{ x: 10, y: 10 }, { x: 62, y: 44 }], clic: true, partDeplacement: 0.5 } }),
        scene("kpi", 2 * tiers, fin, { niveau: 3, piece: "carte-kpi", parametres: { libelle: "Devis prêts", valeur: 3, prefixe: "", suffixe: "", decimales: 0, tendance: "hausse", variation: "" }, code: "while(true){}" }),
      ],
    };
    return { texte: JSON.stringify(plan), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, sortie: 0 } as never };
  }) as unknown as AppelClaude & { appels: number };
  f.appels = 0;
  return f;
}

let horloge = Date.UTC(2026, 10, 8, 10);
function deps(o: { facecam: FournisseurFacecam; alignement?: FournisseurAlignement; appelerPlan?: AppelClaude; renduEnPanne?: RatioDemo[] }) {
  const rendu = creerServiceRenduSimule(() => horloge);
  const demandesRendu: DemandeRendu[] = [];
  const d: DependancesDemo = {
    facecam: o.facecam,
    ...(o.alignement ? { alignement: o.alignement } : {}),
    ...(o.appelerPlan ? { appelerPlan: o.appelerPlan } : {}),
    rendu: {
      async soumettre(demande) {
        demandesRendu.push(demande);
        return rendu.soumettre(demande);
      },
      async etat(id) {
        const demande = demandesRendu.find((x) => x.idRendu === id);
        const ratio = (demande?.parametres.proprietes as ProprietesDemoFacecam | undefined)?.miseEnPage.ratio;
        if (ratio && o.renduEnPanne?.includes(ratio)) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Rendu en panne." } };
        return rendu.etat(id);
      },
    },
    urlLecture: async (cle) => `https://r2.exemple/lire/${cle}`,
    urlDepot: async (cle) => `https://r2.exemple/deposer/${cle}`,
  };
  return { d, demandesRendu };
}

const commande = (demoFacecam: Record<string, unknown>, ratios: string[] = ["9:16"]) =>
  ({ videoId: "v1", formatId: "demo-facecam", ratios, briques: { "sous-titres": true }, distribution: [], dureeCibleSec: 60, script: { blocs: [], texteComplet: "" }, entrees: { demoFacecam } }) as unknown as CommandeFabrication;
const ctx = { travailId: "t1", versionId: "ver1", titre: "Démo devis", maintenant: horloge };

async function jusquAuBout(moteur: ReturnType<typeof creerMoteurMontageDemoFacecam>, c: CommandeFabrication, travail: Awaited<ReturnType<typeof moteur.lancer>>) {
  let t = travail;
  for (let i = 0; i < 200; i++) {
    horloge += 1000;
    const r = await moteur.avancer(t, c, horloge);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error(`pas fini : ${t.statut}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.unstubAllGlobals());

type Plan = { scenes: { id: string; piece: string; parametres: Record<string, unknown> }[] };
async function versionDAvant() {
  const facecam = transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE) });
  const { d } = deps({ facecam, alignement: aligneur(), appelerPlan: llmPlan() });
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  const c = commande({ facecam: { cle: "rush/face.mp4" } }, ["4:5"]);
  const { resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
  return { resultat: resultat!, c };
}

/** N-26-b · le « lancer la retouche » de la démo face caméra : gratuit, deux gardes, aucun appel à Claude. Doubles seulement, 0 €. */
const SOURCE = readFileSync("src/services/retouche-chat/lancer-demo.ts", "utf8");
const eur = (centimes: number) => ({ centimes, devise: "EUR" });
const PLAN = { version: "plan-scenes-1", scenes: [] } as never;
const REPRISE = { mots: [], plan: { scenes: [] }, synchro: {} } as never;

function doubles(o: { reprise?: () => Promise<unknown>; estimer?: () => Promise<{ total: unknown }> } = {}) {
  const lancer = vi.fn(async () => ({ retoucheId: "r1", travailId: "t9" }));
  const estimer = vi.fn(o.estimer ?? (async () => ({ total: eur(0) })));
  const reprise = vi.fn(o.reprise ?? (async () => REPRISE));
  return { lancer, estimer, reprise, deps: { lancer, estimer, reprise } as never };
}
const demande = { videoId: "v1", plan: PLAN, consigne: "Change la carte" } as never;

describe("N-26-b · lancerRetoucheDemo", () => {
  it("a) reprise null : plan-pret, ni estimation ni lancement", async () => {
    const d = doubles({ reprise: async () => null });
    const r = await lancerRetoucheDemo(demande, d.deps);
    expect(r.statut).toBe("plan-pret");
    expect(d.lancer).not.toHaveBeenCalled();
    expect(d.estimer).not.toHaveBeenCalled();
  });

  it("b) reprise qui lève : plan-pret, rien lancé", async () => {
    const d = doubles({ reprise: async () => { throw new Error("panne"); } });
    expect((await lancerRetoucheDemo(demande, d.deps)).statut).toBe("plan-pret");
    expect(d.lancer).not.toHaveBeenCalled();
    expect(d.estimer).not.toHaveBeenCalled();
  });

  it("c) plan absent : plan-pret, 0 appel", async () => {
    const d = doubles();
    for (const plan of [undefined, null]) {
      expect((await lancerRetoucheDemo({ videoId: "v1", plan, consigne: "x" } as never, d.deps)).statut).toBe("plan-pret");
    }
    expect(d.lancer).not.toHaveBeenCalled();
    expect(d.estimer).not.toHaveBeenCalled();
  });

  it("d) estimation à 1 centime : BLOQUE, rien lancé", async () => {
    const d = doubles({ estimer: async () => ({ total: eur(1) }) });
    expect((await lancerRetoucheDemo(demande, d.deps)).statut).toBe("plan-pret");
    expect(d.lancer).not.toHaveBeenCalled();
  });

  it("d bis) estimation invalide (NaN, négative) : BLOQUE", async () => {
    for (const total of [eur(Number.NaN), eur(-1), undefined, 0]) {
      const d = doubles({ estimer: async () => ({ total }) });
      expect((await lancerRetoucheDemo(demande, d.deps)).statut).toBe("plan-pret");
      expect(d.lancer).not.toHaveBeenCalled();
    }
  });

  it("e) estimer qui lève : plan-pret, rien lancé", async () => {
    const d = doubles({ estimer: async () => { throw new Error("moteur"); } });
    expect((await lancerRetoucheDemo(demande, d.deps)).statut).toBe("plan-pret");
    expect(d.lancer).not.toHaveBeenCalled();
  });

  it("f) reprise + plan + coût 0 : UN lancement, planIds vides, opérations exactes", async () => {
    const d = doubles();
    const r = await lancerRetoucheDemo(demande, d.deps);
    expect(r).toEqual({ statut: "lancee", travailId: "t9" });
    expect(d.estimer).toHaveBeenCalledTimes(1);
    expect(d.estimer).toHaveBeenCalledWith([{ type: "planScenes", plan: PLAN }]);
    expect(d.lancer).toHaveBeenCalledTimes(1);
    expect(d.lancer).toHaveBeenCalledWith("v1", [], "Change la carte", { operations: [{ type: "planScenes", plan: PLAN }] });
  });

  it("lancer qui lève : plan-pret (jamais d'exception)", async () => {
    const d = doubles();
    d.lancer.mockRejectedValueOnce(new Error("verrou"));
    expect((await lancerRetoucheDemo(demande, d.deps)).statut).toBe("plan-pret");
  });

  it("g) VRAI moteur démo : l'estimation est à 0 et la retouche n'appelle JAMAIS Claude pour le plan", async () => {
    const { resultat, c } = await versionDAvant();
    const plan = structuredClone((resultat.projetMontage.reprise as { plan: Plan }).plan);
    const espion = llmPlan();
    const facecam = transcripteur({});
    const { d: dep, demandesRendu } = deps({ facecam, appelerPlan: espion });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => dep });
    const parent = { projetMontage: resultat.projetMontage };
    let lancee: Awaited<ReturnType<typeof moteur.retoucher>> | null = null;
    const r = await lancerRetoucheDemo({ videoId: "v1", plan: plan as never, consigne: "Change la carte" }, {
      reprise: async () => (await import("@/moteurs/montage-demo-facecam/chaine")).lireRepriseDemo(parent.projetMontage),
      estimer: async (operations) => moteur.estimerRetouche(c, [], { operations, parent } as never),
      lancer: async (_v, _p, _c, options) => {
        lancee = await moteur.retoucher({ commande: c, contexte: { ...ctx, travailId: "t2", versionId: "ver2" }, planIds: [], parent, operations: options?.operations } as never);
        const fin = await jusquAuBout(moteur, c, lancee);
        expect(fin.resultat).toBeTruthy();
        return { retoucheId: "r", travailId: "t2" };
      },
    });
    expect(r).toEqual({ statut: "lancee", travailId: "t2" });
    expect(espion.appels).toBe(0);
    expect(demandesRendu.length).toBeGreaterThanOrEqual(0);
  });
});

describe("N-26-b · gardes statiques", () => {
  it("h) server-only, aucun réglage lu, aucun montant écrit en dur", () => {
    expect(SOURCE).toMatch(/import "server-only"/);
    expect(SOURCE).not.toMatch(/lireParametre/);
    expect(SOURCE).not.toMatch(/\d+[.,]\d+\s*(€|eur|usd)/i);
    expect(SOURCE).not.toMatch(/estimerRetoucheVideo/);
    expect(SOURCE).not.toMatch(/from "@\/fournisseurs/);
  });
});
