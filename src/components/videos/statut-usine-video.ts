import type { StatutUsine } from "@/components/ui/statuts-usine";
import type { EtapeEditoriale, StatutVideo } from "@/domaine/types";

/** Étape éditoriale d'une vidéo prête vers l'un des 9 statuts de l'usine (maquette M0). Présentation seule. */
export function statutUsineDeEtape(etape: EtapeEditoriale): StatutUsine {
  switch (etape) {
    case "a_relire":
      return "valider";
    case "validee":
      return "accepte";
    case "programmee":
      return "programme";
    case "publiee":
      return "publie";
  }
}

/** Statut technique d'une vidéo vers l'un des 9 statuts ; « archivée » n'en fait pas partie (null). */
export function statutUsineDeVideo(statut: StatutVideo): StatutUsine | null {
  switch (statut) {
    case "brouillon":
    case "maquette":
      return "brouillon";
    case "en_file":
    case "en_fabrication":
      return "fabrication";
    case "prete":
      return "valider";
    case "echec":
      return "corriger";
    case "annulee":
      return "refuse";
    case "archivee":
      return null;
  }
}
