/**
 * DOUBLES DE LA DÉMO FACECAM (lot J) : transcription (studio-aligneur), service d'alignement, Claude et rendu SIMULÉS.
 * Aucun appel réel, aucun `fetch`. Le rendu est simulé (FFmpeg et Chrome absents du cloud) : il note chaque demande et
 * rend « terminé » au tour suivant, avec la durée attendue.
 */
import type { CommandeFabrication, MotHorodate } from "../../src/domaine/types";
import type { RequeteClaude, ReponseClaude } from "../../src/fournisseurs/claude/client";
import type { DemandeFacecam, FournisseurFacecam } from "../../src/fournisseurs/facecam/client";
import type { DemandeAlignement, DemandeRendu, EtatRendu, FournisseurAlignement, ServiceRendu } from "../../src/fournisseurs/types";
import type { OutilsDemoFacecam } from "../../src/moteurs/montage-demo-facecam";

/** Ce que Williams dit en direct pendant sa démo (sa vraie voix, transcrite). */
export const PAROLE =
  "Je vous montre comment relancer un client en deux clics. J'ouvre la fiche du client. Je clique sur Relancer. Le message est déjà prêt, je le relis. J'envoie, et c'est fini.";

export interface Journal {
  transcriptions: DemandeFacecam[];
  alignements: DemandeAlignement[];
  claude: RequeteClaude[];
  rendus: DemandeRendu[];
}

export const journalVide = (): Journal => ({ transcriptions: [], alignements: [], claude: [], rendus: [] });

/** 0,4 s par mot (pas de 1 s si la démo doit être longue). */
export function motsDe(texte: string, pas = 0.4): MotHorodate[] {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .map((mot, i) => ({ mot, debutSec: +(i * pas).toFixed(3), finSec: +(i * pas + pas * 0.85).toFixed(3) }));
}

/** Plan du faux Claude : fausse fenêtre (niveau 1), composition curseur + zoom (niveau 2), code libre (niveau 3). */
function planLlm(requete: RequeteClaude): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const a = Math.floor(n / 3);
  const b = Math.floor((2 * n) / 3);
  const transition = { entree: "fondu", sortie: "fondu", dureeMs: 400 };
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "noir", accent: "orange" },
    scenes: [
      { id: "s1", version: 1, mots: { premier: 0, dernier: a - 1 }, debutMs: ms(0, 2), finMs: ms(a, 2), niveau: 1, texte: "Relancer un client", position: "plein", transition, piece: "fenetre-app", parametres: { titre: "CRM", onglets: ["Clients"], ongletActif: 0, contenu: "liste" } },
      {
        id: "s2",
        version: 1,
        mots: { premier: a, dernier: b - 1 },
        debutMs: ms(a, 2),
        finMs: ms(b, 2),
        niveau: 2,
        position: "bas",
        transition,
        piece: "legende",
        parametres: { texte: "Cliquez sur Relancer", sousTexte: "", style: "bandeau" },
        calques: [
          { piece: "curseur", parametres: { trajet: [{ x: 20, y: 20 }, { x: 70, y: 60 }], clic: true, partDeplacement: 0.5 }, debutMs: 0, zone: "plein" },
          { piece: "zoom-camera", parametres: { cible: { x: 70, y: 60 }, facteur: 2.2, moment: 0.3, titreFenetre: "CRM" }, debutMs: 200, zone: "plein" },
          { piece: "legende", parametres: { texte: "Relancer", sousTexte: "", style: "etiquette" }, debutMs: 100, zone: "haut" },
        ],
      },
      { id: "s3", version: 1, mots: { premier: b, dernier: n - 1 }, debutMs: ms(b, 2), finMs: ms(n - 1, 3), niveau: 3, position: "bas", transition, piece: "legende", parametres: { texte: "C'est fini", sousTexte: "", style: "bandeau" }, code: "export default () => null;" },
    ],
  });
}

export interface OptionsDoubles {
  parole?: string;
  pasSec?: number;
  transcriptionEnPanne?: boolean;
  sansAlignement?: boolean;
  claudeEnPanne?: boolean;
}

export function outilsDoubles(journal: Journal, options: OptionsDoubles = {}): OutilsDemoFacecam {
  const parole = options.parole ?? PAROLE;
  const transcriptions = new Map<string, DemandeFacecam>();
  const transcription: FournisseurFacecam = {
    id: "simulation",
    mode: "simulation",
    async soumettre(_route, demande) {
      journal.transcriptions.push(demande);
      transcriptions.set(demande.idTravail, demande);
      return { statut: "en_file" };
    },
    async suivre(_route, id) {
      if (!transcriptions.has(id)) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "inconnu", travailInconnu: true } };
      if (options.transcriptionEnPanne) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "panne (double)" } };
      const mots = motsDe(parole, options.pasSec);
      return { statut: "termine", resultat: { transcriptionCle: "test/transcription.json.gz", dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.6, mots } } as never;
    },
  };
  const alignements = new Map<string, DemandeAlignement>();
  const alignement = {
    id: "studio-aligneur",
    type: "alignement",
    mode: "reel",
    nom: "Calage (double)",
    reelPrevu: "",
    capacites: { asynchrone: true, accordExige: false },
    async soumettre(d: DemandeAlignement) {
      journal.alignements.push(d);
      alignements.set(d.idAlignement, d);
    },
    async suivre(id: string) {
      const d = alignements.get(id)!;
      // Le calage décale chaque mot de 30 ms : la preuve que les mots calés sont ceux retenus.
      const mots = (d.reference ?? []).map((m) => ({ mot: m.mot, debutSec: +(m.debutSec + 0.03).toFixed(3), finSec: +(m.finSec + 0.03).toFixed(3) }));
      return { statut: "termine", resultat: { mots, motsNonAlignes: 0, modele: "double", dureeCalculSec: 0, ecartMoyenMs: 30, ecartMaxMs: 30 } };
    },
  } as unknown as FournisseurAlignement;
  const soumises = new Map<string, { demande: DemandeRendu; tours: number }>();
  const rendu: ServiceRendu = {
    async soumettre(d) {
      journal.rendus.push(d);
      soumises.set(d.idRendu, { demande: d, tours: 0 });
      return { idRendu: d.idRendu };
    },
    async etat(id): Promise<EtatRendu> {
      const s = soumises.get(id);
      if (!s) return { statut: "inconnu" };
      if (s.tours++ === 0) return { statut: "en_cours", progression: 50 };
      const p = s.demande.parametres.proprietes as { dureeMs: number; finMs: number };
      return { statut: "termine", sortieCle: s.demande.sortie.cle, mesures: { dureeSec: (p.dureeMs + p.finMs) / 1000, taille: 2_000_000 } };
    },
  };
  return {
    transcription,
    ...(options.sansAlignement ? {} : { alignement }),
    claude: async (requete): Promise<ReponseClaude> => {
      journal.claude.push(requete);
      if (options.claudeEnPanne) throw new Error("Claude indisponible (double)");
      return { texte: planLlm(requete), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
    },
    lire: async (cle) => `https://stockage.test/${cle}`,
    rendu: {
      service: () => rendu,
      signer: async (lectures, depot) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://stockage.test/${c}`])), urlDepot: `https://depot.test/${depot.cle}` }),
      cle: (nom) => `studio/test/videos/v-df/${nom}`,
    },
  };
}

export function commandeDemo(plus: Partial<CommandeFabrication> = {}): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-demo-facecam",
    videoId: "v-df",
    formatId: "demo-facecam",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 60,
    ratios: ["4:5", "9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "rush", personnageId: "williams" }],
    styles: { sousTitres: null, decor: null, profilSon: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: false, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { demoFacecam: { facecamCle: "studio/test/prises/facecam.mp4", ecranCle: "studio/test/prises/ecran.mp4" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-11-08T00:00:00.000Z",
    ...plus,
  } as CommandeFabrication;
}

export function une(o: OutilsDemoFacecam): () => Promise<OutilsDemoFacecam> {
  return async () => o;
}
