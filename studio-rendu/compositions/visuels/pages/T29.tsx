import { TEXTES_FIXES_L11 } from "../../../../src/briques/visuels/textes-fixes";
import { COULEURS, LARGEUR_TITRE_BORNE, MARGE, POLICE_CORPS, TITRE_MIN_MESSAGE } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { Etiquette, filetAuDessus } from "../commun/editorial";
import { DANS_LA_COLONNE, PageBase } from "../commun/PageBase";
import { Dessin } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { Titre } from "../commun/Titre";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";

interface Proprietes {
  relance: string;
  rappels: { texte: string }[];
  index: number;
  total: number;
}

/** Hauteur (px) gardée à la relance en capitales (4 lignes au plus). */
const HAUTEUR_RELANCE = 470;
/** Corps maximal de la relance : un grand texte du style C, sous le message clé de T10. */
const RELANCE_MAX = 150;
const REMPLISSAGE_BLOC = 40;
/** Coche d'un rappel (disque crème, coche encre) et écart avant le texte. */
const COCHE = 52;
const ECART = 24;
const X_TEXTE = MARGE + COCHE + ECART;

/** Coche d'un rappel : disque crème, coche encre ; sans texte. */
function CocheRappel() {
  return (
    <svg width={COCHE} height={COCHE} viewBox="0 0 52 52" role="img" aria-hidden style={{ display: "block" }}>
      <circle cx="26" cy="26" r="25" fill={COULEURS.creme} />
      <path d="M15 27 L23 35 L38 18" fill="none" stroke={COULEURS.encre} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * T29 — relance (L11), avant-dernière page en général, style TYPOGRAPHIQUE (C) sur crème (jamais sombre : la page sombre reste T21) : la
 * relance — une question directe au lecteur ou une phrase courte et forte — en capitales géantes, dernière ligne orange ; dessous, un bloc
 * orange à fond perdu porte l'étiquette posée par le code et 2 à 3 rappels de ce que le lecteur a vu, chacun derrière une coche, séparés par
 * des filets. Les rappels s'arrêtent à x = 860 (compteur de Meta) ; le groupe grandit pour remplir le bloc (`Remplir`).
 */
export function T29({ relance, rappels, index, total }: Proprietes) {
  chargerPoliceTitre();
  chargerPoliceInter();
  return (
    <PageBase index={index} total={total} type="T29" fondPerdu>
      <Zone libelle="T29 : relance" style={{ ...DANS_LA_COLONNE, flex: "none", maxHeight: HAUTEUR_RELANCE + 16 }}>
        <Titre texte={relance} maxLignes={4} hauteurMax={HAUTEUR_RELANCE} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_MESSAGE} max={RELANCE_MAX} grand accent />
      </Zone>
      <div style={{ ...DANS_LA_COLONNE, flex: "none", margin: "28px 0 36px" }}>
        <div style={{ width: 120, height: 6, background: COULEURS.orange }} />
      </div>
      <Remplir max={1.5} style={{ ...DANS_LA_COLONNE, paddingTop: REMPLISSAGE_BLOC, paddingBottom: REMPLISSAGE_BLOC, background: COULEURS.orange }}>
        <div style={{ paddingBottom: k(22) }}>
          <Etiquette texte={TEXTES_FIXES_L11.t29Rappel} taille={k(28)} />
        </div>
        {rappels.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: ECART, paddingBottom: i === rappels.length - 1 ? 0 : k(22), ...filetAuDessus(i === 0, 22) }}>
            <Dessin nom="coche-rappel" grandit={{ largeur: COCHE, hauteur: COCHE }}>
              <CocheRappel />
            </Dessin>
            <div style={{ maxWidth: moinsK(largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE_BAS), COCHE), paddingTop: k(4), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(34), lineHeight: 1.25, color: COULEURS.encre }}>{r.texte}</div>
          </div>
        ))}
      </Remplir>
    </PageBase>
  );
}
