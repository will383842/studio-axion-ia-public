/**
 * SOCLE QUALITÉ · VALEUR (VA). PUR. Observation seulement.
 *  VA-01 une valeur concrète : un gain avec son unité (« six lignes », « quinze minutes ») ou un chiffre.
 *  VA-02 une preuve ou un exemple (partie « preuve » ou « exemple », « par exemple », « avant / maintenant », « résultat »).
 *  VA-03 la promesse de l'accroche est tenue : ses mots pleins reviennent dans la seconde moitié du script.
 * Le « chiffre sans source » est dans les interdits (LG-04).
 */
import { lignesDe, part } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { GAIN, NOMBRE, norm, racinesCommunes, resultat } from "./outils";

const EXEMPLE = /(?:^|[^a-z])(par exemple|exemple|avant,|maintenant,|resultat|concretement|chez un client|chez une cliente|cas reel|prenons)(?=$|[^a-z])/;

export function reglesValeur(c: Contexte): ResultatRegle[] {
  const { script, lecture } = c;
  const tout = norm(script.lignes.map((l) => l.dit).join(" "));
  const out: ResultatRegle[] = [];

  const gain = GAIN.exec(tout);
  out.push(
    gain
      ? resultat(c, "VA-01", "valeur", "alerte", "ok", `Valeur concrète : « ${gain[0].trim()} ».`)
      : NOMBRE.test(tout)
        ? resultat(c, "VA-01", "valeur", "alerte", "ok", "Valeur concrète : un chiffre (son unité n'est pas dite).")
        : resultat(c, "VA-01", "valeur", "alerte", "ecart", "Aucun gain avec son unité ni chiffre : donnez une valeur concrète (heures, euros, lignes…)."),
  );

  const preuve = lignesDe(script, "preuve", "exemple")[0] ?? script.lignes.find((l) => EXEMPLE.test(norm(l.dit)));
  out.push(
    preuve
      ? resultat(c, "VA-02", "valeur", "alerte", "ok", "Une preuve ou un exemple concret.", { ligneId: preuve.id })
      : resultat(c, "VA-02", "valeur", "alerte", "ecart", "Ni preuve ni exemple concret : montrez un cas, un avant / maintenant."),
  );

  const accroche = lignesDe(script, "accroche").map((l) => l.dit).join(" ") || lecture.phrases[0]?.texte || "";
  const seconde = lecture.phrases.filter((p) => part(lecture, p.debutSec) >= 0.5).map((p) => p.texte).join(" ");
  const communes = racinesCommunes(accroche, seconde);
  out.push(
    !accroche.trim()
      ? resultat(c, "VA-03", "valeur", "alerte", "non-mesure", "Pas d'accroche à relire.")
      : communes.length
        ? resultat(c, "VA-03", "valeur", "alerte", "ok", "La promesse de l'accroche revient dans la seconde moitié.")
        : resultat(c, "VA-03", "valeur", "alerte", "ecart", "Les mots de l'accroche ne reviennent pas dans la seconde moitié : la promesse est-elle tenue ?"),
  );
  return out;
}
