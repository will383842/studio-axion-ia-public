import { COULEURS, LARGEUR_TITRE_BORNE, TITRE_MIN_MESSAGE } from "../commun/constantes";
import { Badge } from "../commun/Badge";
import { PageBase } from "../commun/PageBase";
import { Zone } from "../commun/controle-debordement";
import { Titre } from "../commun/Titre";
import { COMPOSANTS_DECOR } from "../decor/formes";
import type { TypeDecor } from "../../../../src/briques/visuels/registre-decor";

interface Proprietes {
  message: string;
  legende?: string;
  deco?: TypeDecor;
  index: number;
  total: number;
}

/**
 * Hauteur minimale du bandeau. La place laissée par un message court va pour deux tiers au bandeau, pour un tiers à la zone du message (qui le
 * centre) : un message de deux mots ne laisse plus de grand vide crème au-dessus et au-dessous de lui.
 */
const HAUTEUR_BANDEAU = 400;
const HAUTEUR_MESSAGE = 460;

/** Guillemets : deux virgules géométriques orange (grand élément, sans texte). */
function Guillemets() {
  return (
    <svg width={225} height={175} viewBox="0 0 180 140" role="img" aria-hidden>
      {[0, 96].map((x) => (
        <path key={x} d={`M${x + 8} 128 L${x + 8} 62 A52 52 0 0 1 ${x + 70} 8 L${x + 70} 40 A22 22 0 0 0 ${x + 40} 66 H${x + 74} V128 Z`} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth="6" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** T10 — citation / message clé : guillemets, message en grand (corps ajusté), bandeau orange décoré avec la légende facultative (le bandeau prend la place laissée par le message). */
export function T10({ message, legende, deco = "E13", index, total }: Proprietes) {
  const Deco = COMPOSANTS_DECOR[deco];
  return (
    <PageBase index={index} total={total} type="T10">
      <div style={{ flex: "none", paddingTop: 8, display: "flex", alignItems: "center", gap: 36 }}>
        <Guillemets />
        <div style={{ flex: 1, height: 14, borderRadius: 7, background: COULEURS.orange }} />
      </div>
      <Zone libelle="T10 : message" style={{ flex: "1 0 auto", display: "flex", flexDirection: "column", justifyContent: "center", margin: "30px 0" }}>
        <Titre texte={message} maxLignes={6} hauteurMax={HAUTEUR_MESSAGE} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_MESSAGE} />
      </Zone>
      <div
        style={{
          flex: `2 0 ${HAUTEUR_BANDEAU}px`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 36,
          borderRadius: 40,
          background: COULEURS.orange,
          border: `4px solid ${COULEURS.encre}`,
        }}
      >
        <div style={{ maxWidth: 560 }}>{legende && <Badge texte={legende} />}</div>
        <div style={{ height: "70%", maxHeight: 340, aspectRatio: "1" }}>
          <Deco taille="100%" sur="orange" />
        </div>
      </div>
    </PageBase>
  );
}
