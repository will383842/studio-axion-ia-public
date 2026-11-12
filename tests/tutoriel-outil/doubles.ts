/**
 * DOUBLES DU TUTORIEL D'OUTIL (lot I) : voix HeyGen, aligneur, stockage, service de rendu et Claude SIMULÉS. Aucun
 * appel réel, aucun `fetch`. Le rendu est simulé (FFmpeg et Chrome absents du cloud) : il note chaque demande et rend
 * « terminé » au tour suivant, avec la durée attendue.
 */
import { REGLES_NETTOYAGE_PAR_DEFAUT } from "../../src/briques/voix-maitre";
import { VOIX_MAITRE_HEYGEN_ID } from "../../src/briques/voix-maitre/voix-epinglee";
import type { CommandeFabrication, MotHorodate } from "../../src/domaine/types";
import type { RequeteClaude, ReponseClaude } from "../../src/fournisseurs/claude/client";
import type { DemandeRendu, EtatRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "../../src/fournisseurs/types";
import type { OutilsTutoriel } from "../../src/moteurs/montage-tutoriel-outil";

export const SCRIPT =
  "Créez votre premier tableau de bord en une minute. Ouvrez l'outil et cliquez sur Nouveau tableau. Tapez le nom de votre projet. Ajoutez la carte des ventes du mois. Le graphique se remplit tout seul. Glissez la liste des clients à droite. Votre tableau de bord est prêt, partagé avec votre équipe.";

export interface Journal {
  voix: string[];
  claude: RequeteClaude[];
  rendus: DemandeRendu[];
}

/** Mots lus par la voix : le texte, 0,4 s par mot. */
function motsLus(texte: string): MotHorodate[] {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(3), finSec: +(i * 0.4 + 0.35).toFixed(3) }));
}

/** Plan renvoyé par le faux Claude : une fenêtre d'app au niveau 1, puis une composition niveau 2 (curseur + zoom). */
function planLlm(requete: RequeteClaude): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const moitie = Math.floor(n / 2);
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "ivoire", accent: "terracotta" },
    scenes: [
      { id: "s1", version: 1, mots: { premier: 0, dernier: moitie - 1 }, debutMs: ms(0, 2), finMs: ms(moitie, 2), niveau: 1, position: "plein", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "fenetre-app", parametres: { titre: "Tableaux", onglets: ["Accueil", "Ventes"], ongletActif: 0, contenu: "formulaire" } },
      {
        id: "s2",
        version: 1,
        mots: { premier: moitie, dernier: n - 1 },
        debutMs: ms(moitie, 2),
        finMs: ms(n - 1, 3),
        niveau: 2,
        position: "plein",
        transition: { entree: "glisse-haut", sortie: "fondu", dureeMs: 400 },
        piece: "legende",
        parametres: { texte: "Tableau prêt", sousTexte: "", style: "titre" },
        calques: [
          { piece: "curseur", parametres: { trajet: [{ x: 20, y: 20 }, { x: 70, y: 60 }], clic: true, partDeplacement: 0.6 }, debutMs: 0, zone: "plein" },
          { piece: "zoom-camera", parametres: { cible: { x: 70, y: 60 }, facteur: 1.6, moment: 0.3, titreFenetre: "Tableaux" }, debutMs: 300, zone: "plein" },
        ],
      },
    ],
  });
}

export function outilsDoubles(journal: Journal, options: { idVoix?: string; claudeEnPanne?: boolean; scriptEcrit?: string; renduEchecs?: number } = {}): OutilsTutoriel {
  let echecs = options.renduEchecs ?? 0;
  const soumises = new Map<string, { demande: DemandeRendu; tours: number }>();
  const voix = {
    id: "heygen",
    type: "voix",
    nom: "HeyGen (double)",
    reelPrevu: "",
    mode: "simulation",
    capacites: { audioSeul: true, horodatageMots: true },
    async lire(d: { texte: string; idExterne: string }) {
      journal.voix.push(d.idExterne);
      const mots = motsLus(d.texte);
      return { fichierCle: "studio/test/audio-maitre/v-to/brut.mp3", dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.3, cout: { centimes: 12, devise: "EUR" }, mots };
    },
  } as unknown as FournisseurVoix;
  const stockage = {
    async urlLecture(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlLectureDuree(cle: string) {
      return `https://stockage.test/${cle}`;
    },
    async urlDepotDuree(cle: string) {
      return `https://depot.test/${cle}`;
    },
  } as unknown as StockageFichiers;
  const aligneur = { mode: "simulation" } as unknown as FournisseurAlignement;
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
      if (s.demande.operation === "composition" && echecs > 0) {
        echecs--;
        return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "conteneur occupé" } as never };
      }
      const p = s.demande.parametres.proprietes as { plan?: { dureeMs: number }; finMs?: number } | undefined;
      const mesures: Record<string, number> = p?.plan ? { dureeSec: (p.plan.dureeMs + (p.finMs ?? 0)) / 1000, taille: 1_000_000 } : {};
      return { statut: "termine", sortieCle: s.demande.sortie.cle, mesures };
    },
  };
  return {
    voix: {
      voix: () => voix,
      stockage: () => stockage,
      aligneur: () => aligneur,
      rendu: () => rendu,
      renduEstSimule: () => true,
      idVoix: options.idVoix ?? VOIX_MAITRE_HEYGEN_ID,
      fournisseurVoix: "heygen",
      caler: () => false,
      regles: REGLES_NETTOYAGE_PAR_DEFAUT,
      cle: (nom) => `studio/test/audio-maitre/v-to/${nom}`,
    },
    claude: async (requete): Promise<ReponseClaude> => {
      journal.claude.push(requete);
      if (options.claudeEnPanne) throw new Error("Claude indisponible (double)");
      const texte = requete.json ? planLlm(requete) : (options.scriptEcrit ?? SCRIPT);
      return { texte, modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
    },
    rendu: {
      service: () => rendu,
      signer: async (lectures, depot) => ({ lectures: Object.fromEntries(Object.entries(lectures).map(([n, c]) => [n, `https://stockage.test/${c}`])), urlDepot: `https://depot.test/${depot.cle}` }),
      cle: (nom) => `studio/test/videos/v-to/${nom}`,
    },
  };
}

export function commandeTutoriel(plus: Partial<CommandeFabrication> = {}): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-tutoriel-outil",
    videoId: "v-to",
    formatId: "tutoriel-outil",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 20,
    ratios: ["4:5", "9:16"],
    script: { blocs: [], texteComplet: SCRIPT },
    distribution: [{ role: "voix", source: "double", personnageId: "williams" }],
    styles: { sousTitres: null, decor: null, profilSon: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: false, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { tutorielOutil: { scriptColle: true } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-11-08T00:00:00.000Z",
    ...plus,
  } as CommandeFabrication;
}

/** Les mêmes outils à chaque tour (le service de rendu garde ses demandes, comme le vrai). */
export function une(o: OutilsTutoriel): () => Promise<OutilsTutoriel> {
  return async () => o;
}
