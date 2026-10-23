/**
 * SOCLE QUALITÉ · FORME ET DURÉE (DF). PUR. Observation seulement.
 *  DF-01 la durée estimée (débit de la recette) tombe dans la classe de durée, et sous le plafond du réseau.
 *  DF-02 les textes écrits à l'écran restent courts (8 mots au plus, sauf écart de recette).
 */
import { classeDuree, PLAFOND_RESEAU_SEC } from "../seuils";
import { nbMots } from "../script";
import type { Contexte, ResultatRegle } from "../types";
import { resultat } from "./outils";

export function reglesForme(c: Contexte): ResultatRegle[] {
  const { lecture, script, recette, seuils } = c;
  const d = lecture.dureeSec;
  const classe = classeDuree(d, script.dureeViseeSec);
  const [min, max] = classe.bornesSec;
  const reseaux = script.reseau ? [script.reseau] : recette.reseaux;
  const plafond = Math.min(...reseaux.map((r) => PLAFOND_RESEAU_SEC[r]));
  const sec = Math.round(d);
  const out: ResultatRegle[] = [
    d > plafond
      ? resultat(c, "DF-01", "forme", "alerte", "ecart", `Environ ${sec} s : au-delà du plafond du réseau (${plafond} s).`)
      : d < min || d > max
        ? resultat(c, "DF-01", "forme", "alerte", "ecart", `Environ ${sec} s pour une vidéo de ${classe.viseeSec} s : entre ${min} et ${max} s.`)
        : resultat(c, "DF-01", "forme", "alerte", "ok", `Environ ${sec} s (vidéo de ${classe.viseeSec} s).`),
  ];

  const long = script.lignes.flatMap((l) => (l.ecrits ?? []).map((e) => ({ l, n: nbMots(e.texte.replace(/\*/g, "")) }))).find((x) => x.n > seuils.motsEcritsMax);
  out.push(
    long
      ? resultat(c, "DF-02", "forme", "alerte", "ecart", `Un texte à l'écran fait ${long.n} mots : ${seuils.motsEcritsMax} au plus.`, { ligneId: long.l.id })
      : resultat(c, "DF-02", "forme", "alerte", "ok", "Textes à l'écran courts."),
  );
  return out;
}
