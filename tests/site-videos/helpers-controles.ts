/** Entrée de contrôles « tout est en règle » pour les tests S2 : chaque test en dérive UN défaut. */
import type { EntreeControlesSite } from "@/domaine/site-videos/controles";
import type { PasseportWeb } from "@/domaine/site-videos/types";

export function passeportOk(surcharge: Partial<PasseportWeb> = {}): PasseportWeb {
  return {
    version: 2,
    titreWeb: "Automatiser ses devis en dix minutes",
    resume: "Un devis prend trop de temps : voici la méthode en trois gestes pour le faire en dix minutes, avec un modèle réutilisable.",
    transcription: "Vos devis vous prennent trop de temps. Voici comment les faire en dix minutes. Premier geste : un modèle.",
    chapitres: [
      { debutSec: 0, finSec: 12, libelle: "Accroche", blocRecette: "accroche" },
      { debutSec: 12, finSec: 40, libelle: "Cœur", blocRecette: "coeur" },
    ],
    aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun outil à payer."],
    questions: [
      { question: "Faut-il un logiciel ?", reponse: "Non, un modèle suffit." },
      { question: "Combien de temps ?", reponse: "Dix minutes." },
    ],
    rubrique: "Automatisation",
    motsCles: ["devis", "automatisation"],
    credits: [],
    ratio: "16:9",
    contenuGenere: false,
    origines: {},
    modifieLe: "2026-10-18T10:00:00.000Z",
    ...surcharge,
  };
}

export function entreeOk(surcharge: Partial<EntreeControlesSite> = {}): EntreeControlesSite {
  return {
    formatId: "avocat",
    ecrivain: "ecrire",
    passeport: passeportOk(),
    generateurAllume: true,
    videoPrete: true,
    typeDerive: undefined,
    autreVersionEnLigne: false,
    dureeSec: 40,
    sousTitres: true,
    vignette: { largeur: 1280, hauteur: 720 },
    entreeLogoClient: false,
    licencesABloquer: 0,
    avantDePublier: { image: true, son: true, sousTitres: true, mentionIA: true, droits: true },
    mentionIAActive: true,
    caseAucunClient: true,
    reglagesSite: { certifexempleCertificationObtenue: false, avisPublies: false },
    ...surcharge,
  };
}
