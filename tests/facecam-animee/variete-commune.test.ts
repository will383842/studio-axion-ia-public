/**
 * X2-14a · `blocHistoriqueV4` : paramètre facultatif `voisinesCommunes` (ouvertures récentes d'autres formats du même réseau).
 * Sans lui (absent ou vide) : texte identique octet pour octet à master (instantanés recopiés avant la modification). Aucun appel réseau.
 */
import { describe, expect, it } from "vitest";
import { blocHistoriqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import type { HistoriqueVideo } from "@/moteurs/montage-facecam-animee/realisateur/regles";

const v = (p: string[], o?: string): HistoriqueVideo => ({ types: [], entrees: [], plaquettesV4: p, ouvertureV4: o });
const HISTORIQUES: HistoriqueVideo[][] = [
  [],
  [v(["Chrono", "BadgeCompteur"], "Chrono")],
  [v(["Chrono", "EclatChiffre", "Chrono"], "Chrono"), v(["JaugePourcentage"], "JaugePourcentage"), v(["BadgeCompteur", "Chrono"])],
];
// Sortie de master (a959e3a ou plus récent) avant modification, recopiée telle quelle.
const INSTANTANES: string[] = [
  "",
  "Plaquettes déjà prises dans les 5 dernières vidéos : Chrono (1), BadgeCompteur (1).\nJamais prises : EtiquetteTete, Interjection, BadgeProfil, RangeePastilles, MotSaute, element-barre, CarteChecklist, CarteCommande, CarteCommentaire, CarteStatuts, GraphiqueBarres, CarteCalendrier, CarteComparaison, JaugePourcentage, PileNotifications, FenetreTelephone, FenetreDouble, AvantApres, CarrouselFeuillete, MosaiqueVideos, dalle-claquee, rafale-trois-mots, duel-video, EclatChiffre. Partez d'elles avant de reprendre une plaquette déjà très vue, seulement si elle montre littéralement ce que Will dit (un nombre DIT pour Chrono, JaugePourcentage, BadgeCompteur, EclatChiffre).\nN'ouvrez pas par Chrono (ouverture de la vidéo précédente).\nRÈGLE VÉRIFIÉE, plan refusé et à refaire si : il ouvre par l'une de ces plaquettes (ouvertures des 3 dernières vidéos) : Chrono ; ou si plus de 60 % de ses plaquettes différentes ont déjà été prises dans les 2 dernières vidéos. L'erreur exacte vous est renvoyée à l'essai suivant.",
  "Plaquettes déjà prises dans les 5 dernières vidéos : Chrono (3), EclatChiffre (1), JaugePourcentage (1), BadgeCompteur (1).\nJamais prises : EtiquetteTete, Interjection, BadgeProfil, RangeePastilles, MotSaute, element-barre, CarteChecklist, CarteCommande, CarteCommentaire, CarteStatuts, GraphiqueBarres, CarteCalendrier, CarteComparaison, PileNotifications, FenetreTelephone, FenetreDouble, AvantApres, CarrouselFeuillete, MosaiqueVideos, dalle-claquee, rafale-trois-mots, duel-video. Partez d'elles avant de reprendre une plaquette déjà très vue, seulement si elle montre littéralement ce que Will dit (un nombre DIT pour Chrono, JaugePourcentage, BadgeCompteur, EclatChiffre).\nN'ouvrez pas par Chrono (ouverture de la vidéo précédente).\nRÈGLE VÉRIFIÉE, plan refusé et à refaire si : il ouvre par l'une de ces plaquettes (ouvertures des 3 dernières vidéos) : Chrono, JaugePourcentage ; ou si plus de 60 % de ses plaquettes différentes ont déjà été prises dans les 2 dernières vidéos. L'erreur exacte vous est renvoyée à l'essai suivant."
];
const LIGNE = (liste: string) => `Sur ce réseau, les dernières vidéos (autres formats compris) ont ouvert par : ${liste} ; ouvrez autrement.`;

describe("X2-14a · blocHistoriqueV4 voisinesCommunes", () => {
  it.each(HISTORIQUES.map((h, i) => [i, h] as const))("sans le paramètre, historique %i : identique à master", (i, h) => {
    expect(blocHistoriqueV4(h)).toBe(INSTANTANES[i]);
  });
  it.each(HISTORIQUES.map((h, i) => [i, h] as const))("avec [] ou undefined, historique %i : identique", (i, h) => {
    expect(blocHistoriqueV4(h, [], [])).toBe(INSTANTANES[i]);
    expect(blocHistoriqueV4(h, [], undefined)).toBe(INSTANTANES[i]);
  });
  it("avec des voisines : une seule ligne de plus, en fin de bloc, dédoublonnée dans l'ordre d'arrivée", () => {
    const sortie = blocHistoriqueV4(HISTORIQUES[1], [], ["question", "chiffre", "question"]);
    expect(sortie).toBe(`${INSTANTANES[1]}\n${LIGNE("question, chiffre")}`);
    expect(sortie.split("ont ouvert par").length - 1).toBe(1);
  });
  it("sans historique v4 mais avec voisines : le bloc rend cette seule ligne", () => {
    expect(blocHistoriqueV4([], [], ["question", "chiffre", "question"])).toBe(LIGNE("question, chiffre"));
  });
});
