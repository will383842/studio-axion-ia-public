/**
 * N-03b — la démo reçoit la liste des pièces d'objets permises par le profil figé. Liste vide = plan, remarques et
 * consigne identiques à avant (aucune clé `objetsPermis` ajoutée). Aucun réseau : doubles recopiés de
 * `src/moteurs/montage-demo-facecam/demo-facecam.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement } from "@/fournisseurs/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { EntreeBibliotheque, ProfilVideo, RegleProfilCapacite } from "@/briques/bibliotheque-video/types";
import { ID } from "@/briques/bibliotheque-video/noms";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo, EtatDemo } from "@/moteurs/montage-demo-facecam/chaine";
import type { RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";

const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";

const espions = vi.hoisted(() => ({ genererPlan: [] as unknown[], validerPlan: [] as unknown[] }));
vi.mock("@/briques/plan-scenes/generateur", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/briques/plan-scenes/generateur")>();
  return { ...m, genererPlan: (e: unknown, a: never) => (espions.genererPlan.push(e), m.genererPlan(e as never, a)) };
});
vi.mock("@/briques/plan-scenes/validateur", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/briques/plan-scenes/validateur")>();
  return { ...m, validerPlan: (p: unknown, c: unknown) => (espions.validerPlan.push(c), m.validerPlan(p, c as never)) };
});

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
function llmPlan(): AppelClaude & { appels: number; requetes: RequeteClaude[] } {
  const f = (async (requete: RequeteClaude) => {
    f.appels++;
    f.requetes.push(requete);
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
  }) as unknown as AppelClaude & { appels: number; requetes: RequeteClaude[] };
  f.appels = 0;
  f.requetes = [];
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

const commande = (demoFacecam: Record<string, unknown>, ratios: string[] = ["9:16"], autres: Record<string, unknown> = {}) =>
  ({ videoId: "v1", formatId: "demo-facecam", ratios, briques: { "sous-titres": true }, distribution: [], dureeCibleSec: 60, script: { blocs: [], texteComplet: "" }, entrees: { demoFacecam, ...autres } }) as unknown as CommandeFabrication;
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


const HORLOGE_DEPART = Date.UTC(2026, 10, 8, 10);
const ENTREE_PROFIL_DEMO: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil: PROFILS_DU_CODE["demo-facecam"], recents: [], graine: "G", figeeLe: "2026-11-17" };
/** Entrée simulée qui permet `objet.chiffre` (forme recopiée de `tests/bibliotheque-video/facade.test.ts`). */
const ENTREE_OBJET_CHIFFRE: EntreeBibliotheque = {
  version: VERSION_BIBLIOTHEQUE,
  profil: { ...profilNeutre("demo-facecam"), capacites: { [ID.objetChiffre]: { permis: true } } as unknown as ProfilVideo["capacites"] satisfies Partial<Record<string, RegleProfilCapacite>> },
  recents: [],
  graine: "G",
  figeeLe: "2026-11-17",
};

/** Pièces du registre (C9-27b, 19 définitions) qui portent la capacité `objet.chiffre`, dans l'ordre du registre. */
const PIECES_OBJET_CHIFFRE = ["objet-anneau-donnees", "objet-barre-progression", "objet-chrono", "objet-compteur-rouleau", "objet-gros-chiffre"];

let reseau = 0;
beforeEach(() => {
  reseau = 0;
  espions.genererPlan.length = 0;
  espions.validerPlan.length = 0;
  vi.stubGlobal("fetch", () => {
    reseau++;
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.unstubAllGlobals());

async function passage(avecLlm: boolean, autres: Record<string, unknown> = {}, planRetouche?: unknown) {
  horloge = HORLOGE_DEPART;
  const mots = motsDe(PHRASE, 0, 0.4);
  const facecam = transcripteur({ "https://r2.exemple/lire/rush/seule.mp4": mots });
  const llm = avecLlm ? llmPlan() : undefined;
  const { d } = deps({ facecam, alignement: aligneur(), ...(llm ? { appelerPlan: llm } : {}) });
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  const c = commande({ facecam: { cle: "rush/seule.mp4" }, ecranPartage: { ecran: "gauche" }, ...(planRetouche !== undefined ? { plan: planRetouche } : {}) }, ["4:5"], autres);
  const lance = await moteur.lancer(c, { ...ctx, maintenant: HORLOGE_DEPART });
  const { travail } = await jusquAuBout(moteur, c, lance);
  expect(travail.statut).toBe("termine");
  const etat = travail.parametres?.demo as EtatDemo;
  const consigne = llm ? { systeme: llm.requetes[0].systeme.map((s) => s.texte), message: llm.requetes[0].messages[0].contenu } : null;
  return { constat: { plan: etat.plan, sourcePlan: etat.sourcePlan, remarques: etat.remarques.map((r) => r.code) }, consigne, appelsLlm: llm?.appels ?? 0 };
}

for (const avecLlm of [true, false]) {
  describe(`objets permis de la démo — ${avecLlm ? "avec" : "sans"} LLM du plan`, () => {
    it("commande sans entrée bibliothèque et avec l'entrée figée demo-facecam : tout identique, aucune clé objetsPermis", async () => {
      const sans = await passage(avecLlm);
      const clesSans = espions.genererPlan.length + espions.validerPlan.length;
      const avec = await passage(avecLlm, { bibliothequeVideo: ENTREE_PROFIL_DEMO });
      expect(avec.constat).toEqual(sans.constat);
      expect(avec.consigne).toEqual(sans.consigne);
      expect(avec.appelsLlm).toBe(avecLlm ? 1 : 0);
      expect(clesSans).toBeGreaterThan(0);
      for (const e of [...espions.genererPlan, ...espions.validerPlan]) expect(Object.prototype.hasOwnProperty.call(e as object, "objetsPermis")).toBe(false);
      expect(reseau).toBe(0);
    });

    it("entrée simulée qui permet objet.chiffre : validerPlan reçoit la liste ; genererPlan aussi avec le LLM ; plan identique", async () => {
      const sans = await passage(avecLlm);
      espions.genererPlan.length = 0;
      espions.validerPlan.length = 0;
      const avec = await passage(avecLlm, { bibliothequeVideo: ENTREE_OBJET_CHIFFRE });
      if (avecLlm) {
        expect(espions.genererPlan).toHaveLength(1);
        expect((espions.genererPlan[0] as { objetsPermis?: string[] }).objetsPermis).toEqual(PIECES_OBJET_CHIFFRE);
      } else {
        expect(espions.genererPlan).toHaveLength(0);
        expect(avec.appelsLlm).toBe(0);
      }
      // Les appels de la chaîne portent `dureeMs` ; ceux que `genererPlan` fait en interne n'en ont pas (hors fiche : generateur.ts).
      const deLaChaine = espions.validerPlan.filter((c) => "dureeMs" in (c as object));
      expect(deLaChaine.length).toBeGreaterThan(0);
      for (const c of deLaChaine) expect((c as { objetsPermis?: string[] }).objetsPermis).toEqual(PIECES_OBJET_CHIFFRE);
      // 17/11/2026 BR-OBJETS-a (C9-34b) : référence changée volontairement. Le gros chiffre est maintenant au catalogue du plan de scènes : allumé (objet.chiffre permis), la consigne du LLM le liste, et SEULEMENT lui (une ligne de plus) ; plan, source et remarques restent identiques (le double du LLM ne le demande pas).
      expect(avec.constat).toEqual(sans.constat);
      if (avecLlm) {
        const texte = (c: typeof avec.consigne) => (c?.systeme ?? []).join("\n");
        expect(texte(avec.consigne)).toContain("- objet-gros-chiffre (");
        // 18/11/2026 BR-OBJETS-c (amendement n°1 du pilote) : le compteur à rouleau (capacité objet.chiffre) est aussi inscrit : la consigne liste DEUX pièces ; rien retiré de l'attente.
        expect(texte(avec.consigne)).toContain("- objet-compteur-rouleau (");
        // 19/11/2026 N-05-v19b : l'anneau de données (objet.chiffre) est aussi inscrit : la consigne le liste ; attente élargie, rien retiré.
        expect(texte(avec.consigne)).toContain("- objet-anneau-donnees (");
        // MAJ 25/11 (FIX-ROUGES-OBJETS-INSCRITS-v21t, voulue, à relire) : la barre de progression et le chrono (capacité objet.chiffre) sont inscrits par C9-34-FIN-v20h (#1499) : la consigne les liste ; attente élargie, rien retiré.
        expect(texte(avec.consigne)).toContain("- objet-barre-progression (");
        expect(texte(avec.consigne)).toContain("- objet-chrono (");
        const sansBloc = texte(avec.consigne).replace(/- objet-gros-chiffre \(.*\n  paramètres .*\n  schéma .*\n/, "").replace(/- objet-compteur-rouleau \(.*\n  paramètres .*\n  schéma .*\n/, "").replace(/- objet-anneau-donnees \(.*\n  paramètres .*\n  schéma .*\n/, "").replace(/- objet-barre-progression \(.*\n  paramètres .*\n  schéma .*\n/, "").replace(/- objet-chrono \(.*\n  paramètres .*\n  schéma .*\n/, "");
        expect(sansBloc).toBe(texte(sans.consigne));
        expect(avec.consigne?.message).toBe(sans.consigne?.message);
      } else {
        expect(avec.consigne).toEqual(sans.consigne);
      }
      expect(reseau).toBe(0);
    });
  });
}

/**
 * BR-OBJETS-a (C9-34b) — critère de fini : par la VRAIE chaîne de fabrication de la démo (`chaine.ts`, chemin « plan de
 * retouche » qui valide avec les objets permis du profil), pas par un plan monté à la main puis posé dans le rendu.
 * Limite constatée : le chemin « LLM » perd `objetsPermis` dans `genererPlan` (generateur.ts, hors fiche : BR-OBJETS-b).
 */
describe("BR-OBJETS-a : le gros chiffre apparaît dans le plan fabriqué quand objet.chiffre est permis, jamais sinon", () => {
  const scene = (parametres: unknown) => ({ id: "chiffre", version: 1, mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: 3000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "objet-gros-chiffre", parametres });
  const planAvec = (parametres: unknown) => ({ version: "plan-scenes-1", scenes: [scene(parametres)] });
  const pieces = (c: Awaited<ReturnType<typeof passage>>) => (c.constat.plan?.scenes ?? []).map((sc) => sc.piece as string);
  it("permis : la scène objet-gros-chiffre (valeur 3) est dans le plan fabriqué", async () => {
    const r = await passage(false, { bibliothequeVideo: ENTREE_OBJET_CHIFFRE }, planAvec({ valeur: 3, unite: "heures" }));
    expect(pieces(r)).toContain("objet-gros-chiffre");
    const s = (r.constat.plan?.scenes ?? []).find((sc) => sc.piece === "objet-gros-chiffre") as unknown as { parametres: { valeur: number } };
    expect(s.parametres.valeur).toBe(3);
    expect(reseau).toBe(0);
  });
  it("éteint (pas d'entrée bibliothèque) : même plan, aucune scène objet, remarque « objet non permis »", async () => {
    const r = await passage(false, {}, planAvec({ valeur: 3, unite: "heures" }));
    expect(pieces(r).some((p) => p.startsWith("objet-"))).toBe(false);
    expect(r.constat.remarques).toContain("OBJET_NON_PERMIS");
  });
  it("permis mais paramètres invalides : scène retirée, jamais l'exemple", async () => {
    const r = await passage(false, { bibliothequeVideo: ENTREE_OBJET_CHIFFRE }, planAvec({ valeur: "beaucoup" }));
    expect(pieces(r).some((p) => p.startsWith("objet-"))).toBe(false);
    expect(r.constat.remarques).toContain("SCENE_RETIREE");
  });
});
