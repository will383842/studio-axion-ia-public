/**
 * EXEMPLES DE DÉMONSTRATION pour l'écran « Ce qui marche » (lot G7b) : 24 vidéos marquées `exemple`, numéros ≥ 9000
 * (réservés à la démonstration, B.2.4). Servis UNIQUEMENT si `exemplesActifs()` (poste de développement ET
 * `STUDIO_APERCU_MESURES=1`) ; jamais écrits en base, jamais mêlés aux vraies vidéos en ligne. Pour les captures.
 */
import type { TraitsVideo, VideoMesuree } from "@/domaine/mesures-rangs";
import type { ReseauDeclinaison } from "@/domaine/types";

const RESEAUX: ReseauDeclinaison[] = ["tiktok", "instagram", "linkedin", "youtube-shorts"];
const CODES: Record<ReseauDeclinaison, string> = { tiktok: "TT", instagram: "IG", linkedin: "LI", "youtube-shorts": "YS", facebook: "FB" };
const STRUCTURES = ["AV.S1", "AV.S2", "AV.S3", "AV.S6"];
const OUVERTURES = ["situation-spectateur", "chiffre-choc", "contre-intuitif", "question-client"];
const FORMATS = ["avocat", "avocat", "ecran-partage", "motion"];
const TITRES = [
  "Vos factures lues par ChatGPT ?",
  "Le fichier Excel que tout le monde recopie",
  "Ne confiez pas vos contrats à une IA gratuite",
  "Combien d'heures perdues chaque lundi",
  "La réunion qui pouvait être un tableau",
  "Ce que la loi dit de vos données clients",
];

/** Suite pseudo-aléatoire stable (mêmes exemples à chaque affichage). */
function suite(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

export function videosExemplesMesurees(): VideoMesuree[] {
  const alea = suite(42);
  const r: VideoMesuree[] = [];
  for (let i = 0; i < 24; i++) {
    const reseau = RESEAUX[i % RESEAUX.length];
    // Cycles décalés du réseau : chaque réseau voit toutes les structures et toutes les ouvertures.
    const tour = Math.floor(i / RESEAUX.length);
    const s = tour % STRUCTURES.length;
    const o = (tour + i) % OUVERTURES.length;
    // La structure S2 (« chiffre d'abord ») et l'ouverture « situation » tiennent mieux dans ces exemples.
    const bonus = (s === 1 ? 12 : 0) + (o === 0 ? 8 : 0);
    const numero = 9001 + Math.floor(i / 2);
    r.push({
      publicationId: `exemple-${i}`,
      varianteId: `exemple-v-${i}`,
      code: `${numero}-AV-${CODES[reseau]}`,
      titre: TITRES[i % TITRES.length],
      reseau,
      formatId: FORMATS[i % FORMATS.length],
      structure: STRUCTURES[s],
      ouverture: OUVERTURES[o],
      objectifSujet: i % 4 === 0 ? "rendez-vous" : "notoriete",
      typeAncrage: i % 2 ? "cas-client" : "observation",
      pointDeVue: i % 3 ? "nous-clients" : "je",
      emotion: i % 2 ? "surprise" : "agacement",
      contrePied: o === 2,
      dureeSec: 35 + Math.round(alea() * 30),
      date: new Date(Date.UTC(2026, 7, 20 + i, 7)).toISOString(),
      resultats: {
        tauxAbandon3s: Math.round(55 - bonus - alea() * 20),
        dureeMoyenneVueSec: Math.round((9 + bonus / 3 + alea() * 8) * 10) / 10,
        partagesParPortee: Math.round((0.3 + bonus / 25 + alea() * 0.8) * 100) / 100,
        vues: Math.round(400 + bonus * 60 + alea() * 1500),
        visites: Math.round(alea() * 20 + bonus / 2),
        rendezVous: alea() > 0.75 ? 1 : 0,
      },
      exemple: true,
    });
  }
  return r;
}

/** Version d'exemple « prête à partir », pour montrer l'avis « les 5 plus proches » sur les captures. */
export function versionsExemplesAvantPublication(): { varianteId: string; code: string; titre: string; traits: TraitsVideo }[] {
  return [
    {
      varianteId: "exemple-pret-1",
      code: "9013-AV-TT",
      titre: "Vos devis relus par une IA : ce qu'elle rate",
      traits: { reseau: "tiktok", formatId: "avocat", structure: "AV.S2", ouverture: "situation-spectateur", objectifSujet: "notoriete", typeAncrage: "cas-client", dureeSec: 45 },
    },
    {
      varianteId: "exemple-pret-2",
      code: "9013-AV-LI",
      titre: "Vos devis relus par une IA : ce qu'elle rate",
      traits: { reseau: "linkedin", formatId: "avocat", structure: "AV.S2", ouverture: "chiffre-choc", objectifSujet: "rendez-vous", typeAncrage: "cas-client", dureeSec: 55 },
    },
  ];
}
