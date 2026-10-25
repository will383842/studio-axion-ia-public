import "server-only";
import { textesDe } from "@/domaine/controles-visuel/textes-de";
import { ToileSpec, type ToileSpecType } from "@/domaine/visuels/continu/schema-toile";
import type { ControlePorte, DemandeTexteCarrousel, FournisseurTexteCarrousel, RapportPorte } from "@/domaine/visuels/contrats";
import { obtenirServiceRendu } from "@/fournisseurs/rendu/client";
import { depots, ecrireParametre, fournisseur, lireParametre, maintenant, sousVerrou } from "@/services/_commun";
import { generateurAllume } from "@/visuels/interrupteur";
import { dependancesCarrousels } from "@/visuels/services/production";
import { PaquetSessionToile, type DependancesContinus } from "./carrousels-continus";
import { rendreToile, type RegistreToiles, type ResultatRenduToile } from "./rendu-toile";

/**
 * SEUL fichier du continu qui importe `production.ts` (décision 4.10 de la note d'architecture) : on part de `dependancesCarrousels()` SANS la
 * modifier, et on en reprend le dépôt, la porte des interdits, les adresses, le verrou, l'horloge et les paramètres. Le reste est propre
 * au continu : interrupteur `carrousels-continus`, stockage, registre `visuels.toile.<empreinte>`, service de rendu.
 * BOUCHONS en attendant P4 / P4b : texte de simulation (3 pages d'essai), porte (schéma + interdits) et note fixe à 100. Ils se remplacent ici,
 * à ces trois lignes seulement, par `porte-continu`, `note-continu` et le fournisseur de texte du générateur de plan.
 */

const VALIDITE_SEC = 3600;
const PREFIXE_REGISTRE = "visuels.toile.";
const TITRE_PAGE_MAX = 40;

const stockage = {
  async urlDepot(cle: string) {
    const s = await fournisseur("stockage");
    if (!s.urlDepotDuree) throw new Error("Le stockage des fichiers n'est pas relié");
    return s.urlDepotDuree(cle, VALIDITE_SEC, "image/jpeg");
  },
  async urlLecture(cle: string) {
    const s = await fournisseur("stockage");
    return s.urlLectureDuree ? s.urlLectureDuree(cle, VALIDITE_SEC) : s.urlLecture(cle);
  },
};

const registre: RegistreToiles = {
  lire: (empreinte) => lireParametre<ResultatRenduToile | null>(PREFIXE_REGISTRE + empreinte, null),
  ecrire: (empreinte, resultat) => ecrireParametre(PREFIXE_REGISTRE + empreinte, resultat),
};

const page = (type: string, titre: string, texte: string) => ({ type, alt: titre, titre, texte });

/** Bouchon P4b : une couverture, un contenu et un appel d'essai ; le titre reprend le sujet quand il tient. */
function texteProvisoire(demande: DemandeTexteCarrousel): FournisseurTexteCarrousel {
  if (demande.type === "paquet-session") {
    return {
      mode: "session",
      async ecrire(d) {
        // Un paquet mal formé lève ici : la fiche passe en « bloque » avec la phrase de lecture.
        const paquet = PaquetSessionToile.parse(JSON.parse(d.type === "paquet-session" ? d.contenu : "{}"));
        return { titre: paquet.titre, spec: paquet.toile, pourquoi: paquet.pourquoi, mode: "session" };
      },
    };
  }
  return {
    mode: "simulation",
    async ecrire(d) {
      const sujet = d.type === "sujet" ? d.sujet : "";
      const titre = sujet.length <= TITRE_PAGE_MAX ? sujet : "Votre carrousel continu";
      const toile = { version: "toile/1", format: "4:5", pages: [page("X00", titre, "Un point de départ simple."), page("X01", "On avance par étapes", "Chaque étape se vérifie."), page("X02", "Commencez par là", "Dites-nous ce qui vous freine.")], raccords: [] };
      return { titre, spec: toile, pourquoi: ["Couverture.", "Contenu.", "Invitation."], mode: "simulation", note: "Texte d'essai : le générateur de plan n'est pas encore branché." };
    },
  };
}

/** Bouchon P4 : schéma de la toile + liste d'interdits partagée. Pas de contrôle de chiffre ni de répétition. */
function porteProvisoire(toile: unknown, ctx: { interditsDans: (t: string) => string[] }): { rapport: RapportPorte; toileCorrigee?: ToileSpecType } {
  const lue = ToileSpec.safeParse(toile);
  const controles: ControlePorte[] = [];
  if (!lue.success) for (const i of lue.error.issues) controles.push({ code: "SCHEMA", niveau: "rouge", phrase: i.message });
  else for (const t of textesDe(lue.data)) for (const interdit of ctx.interditsDans(t.texte)) controles.push({ code: "INTERDIT", niveau: "rouge", phrase: `${interdit} : à retirer`, chemin: t.chemin, ...(t.page ? { page: t.page } : {}) });
  return { rapport: { version: "porte-carrousel/1", verdict: controles.length ? "rouge" : "vert", controles, corrections: [] } };
}

export function dependancesContinus(): DependancesContinus {
  const base = dependancesCarrousels();
  const allume = () => generateurAllume("carrousels-continus");
  return {
    depot: depots().visuels,
    texte: texteProvisoire,
    porte: porteProvisoire,
    contextePorte: base.contextePorte,
    allume,
    rendre: (toile) => rendreToile(toile, { rendu: () => obtenirServiceRendu(), stockage, registre, allume }),
    noter: () => 100,
    urlLecture: base.urlLecture,
    urlTelechargement: base.urlTelechargement,
    verrou: sousVerrou,
    maintenant,
    lireParametre,
    ecrireParametre,
  };
}
