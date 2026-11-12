/**
 * Charte de voix d'un texte de post (L3-05, PUB-10). PUR. Vouvoiement et liste unique des interdits (portée « post »).
 */
import { formesAdresse } from "@/domaine/controles-script/style";
import { normaliser } from "@/domaine/controles-script/texte";
import { interditsPost } from "@/domaine/qualite-script/regles/interdits";

export interface AnalyseCharte {
  /** Le texte tutoie (la charte vouvoie). */
  tutoiement: boolean;
  /** Libellés des interdits trouvés (liste unique, portée « post »). */
  interdits: string[];
}

export function analyserCharte(texte: string): AnalyseCharte {
  return { tutoiement: formesAdresse(normaliser(texte)).tu, interdits: interditsPost(texte) };
}
