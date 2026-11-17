/**
 * N-03t — filet : le plan de scènes de la démo facecam et la consigne envoyée au LLM du plan sont figés AVANT le
 * branchement des objets permis (N-03b). Entrée figée du profil `demo-facecam` (aucun objet permis) = plan identique.
 * Aucun réseau, aucun appel payant : transcription, calage et LLM sont des doubles recopiés de
 * `src/moteurs/montage-demo-facecam/demo-facecam.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement } from "@/fournisseurs/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { EntreeBibliotheque } from "@/briques/bibliotheque-video/types";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo, EtatDemo } from "@/moteurs/montage-demo-facecam/chaine";
import type { RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";
const PHRASE_CHIFFRES = DIX_SCRIPTS[0];

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

let reseau = 0;
beforeEach(() => {
  reseau = 0;
  vi.stubGlobal("fetch", () => {
    reseau++;
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Un passage complet de la chaîne (écran partagé, 4:5) ; l'horloge est remise à la même valeur avant chaque passage. */
async function passage(phrase: string, avecLlm: boolean, autres: Record<string, unknown> = {}) {
  horloge = HORLOGE_DEPART;
  const mots = motsDe(phrase, 0, 0.4);
  const facecam = transcripteur({ "https://r2.exemple/lire/rush/seule.mp4": mots });
  const llm = avecLlm ? llmPlan() : undefined;
  const { d } = deps({ facecam, alignement: aligneur(), ...(llm ? { appelerPlan: llm } : {}) });
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  const c = commande({ facecam: { cle: "rush/seule.mp4" }, ecranPartage: { ecran: "gauche" } }, ["4:5"], autres);
  const lance = await moteur.lancer(c, { ...ctx, maintenant: HORLOGE_DEPART });
  const { travail } = await jusquAuBout(moteur, c, lance);
  expect(travail.statut).toBe("termine");
  const etat = travail.parametres?.demo as EtatDemo;
  const consigne = llm ? { systeme: llm.requetes[0].systeme.map((s) => s.texte), message: llm.requetes[0].messages[0].contenu } : null;
  return {
    constat: { plan: etat.plan, sourcePlan: etat.sourcePlan, remarques: etat.remarques.map((r) => r.code) },
    consigne,
    appelsLlm: llm?.appels ?? 0,
  };
}

const SCENARIOS: [string, string][] = [
  ["la phrase du test existant", PHRASE],
  ["une phrase à chiffres et énumération", PHRASE_CHIFFRES],
];

for (const [nom, phrase] of SCENARIOS) {
  for (const avecLlm of [true, false]) {
    describe(`${nom} — ${avecLlm ? "avec" : "sans"} LLM du plan`, () => {
      it("plan, source, remarques et consigne figés (instantané)", async () => {
        const r = await passage(phrase, avecLlm);
        expect(r.constat).toMatchSnapshot("constat");
        if (avecLlm) expect(r.consigne).toMatchSnapshot("consigne");
        else expect(r.consigne).toBeNull();
        expect(r.appelsLlm).toBe(avecLlm ? 1 : 0);
        expect(reseau).toBe(0);
      });

      it("deux passages successifs : égalité profonde (déterminisme)", async () => {
        const a = await passage(phrase, avecLlm);
        const b = await passage(phrase, avecLlm);
        expect(b).toEqual(a);
      });

      it("entrée figée du profil demo-facecam (aucun objet permis) : plan, remarques et consigne identiques à sans entrée", async () => {
        const sans = await passage(phrase, avecLlm);
        const avec = await passage(phrase, avecLlm, { bibliothequeVideo: ENTREE_PROFIL_DEMO });
        expect(avec.constat).toEqual(sans.constat);
        expect(avec.consigne).toEqual(sans.consigne);
        expect(avec.appelsLlm).toBe(sans.appelsLlm);
        expect(reseau).toBe(0);
      });
    });
  }
}
