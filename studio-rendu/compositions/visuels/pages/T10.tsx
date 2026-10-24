import { COULEURS, FILET, FORMAT, GRAISSE_TITRE, LARGEUR_TITRE_BORNE, MARGE, PAGE, POLICE_CORPS, POLICE_TITRE, TITRE_MIN_MESSAGE } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { DANS_LA_COLONNE, HAUTEUR_RUBRIQUE, PageBase } from "../commun/PageBase";
import { Titre } from "../commun/Titre";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";

interface Proprietes {
  message: string;
  legende?: string;
  index: number;
  total: number;
}

/** Hauteur (px) du corps de la page sans titre : page, moins les marges, la rubrique, l'écart et le pied. */
const HAUTEUR_CORPS = FORMAT.hauteur - 2 * MARGE - HAUTEUR_RUBRIQUE - PAGE.ecart - PAGE.hauteurPied;
/** Place (px) gardée sous le bloc pour la légende (filet, texte sur deux lignes au plus). */
const HAUTEUR_LEGENDE = 190;
const REMPLISSAGE_BLOC = 48;
const TAILLE_LEGENDE = 40;
/** Corps maximal du message : plus grand que les titres de page, c'est LE texte de la page. */
const MESSAGE_MAX = 190;
/** Interligne des guillemets : leur dessin (entre 0,1 et 0,6 em au-dessus de la ligne de base) tient dans 0,8 em, centré. */
const INTERLIGNE_GUILLEMET = 0.8;
/** Chasse moyenne d'une capitale d'Inter Display Black (em), prise large : sert à ESTIMER la place du message avant sa mesure réelle. */
const CHASSE_CAPITALE = 0.7;
const GUILLEMET = { min: 140, max: 340 } as const;

/**
 * Corps (px) des guillemets : ils prennent la place que le message laissera. Le corps du message est estimé (le plus long mot doit tenir sur
 * la largeur, `MESSAGE_MAX` au plus) ; un message court ou fait de mots longs (petit corps) laisse la place à de grands guillemets.
 */
export function tailleGuillemets(message: string, hauteurBloc: number): number {
  const lettres = message.toLocaleUpperCase("fr-FR");
  const motLong = Math.max(...lettres.split(/\s+/).map((m) => m.length));
  const corps = Math.min(MESSAGE_MAX, LARGEUR_TITRE_BORNE / (CHASSE_CAPITALE * motLong));
  const lignes = Math.ceil((lettres.length * CHASSE_CAPITALE * corps) / LARGEUR_TITRE_BORNE);
  const libre = hauteurBloc - 2 * REMPLISSAGE_BLOC - lignes * corps * 1.1 - 2 * ECART_GUILLEMET;
  return Math.round(Math.max(GUILLEMET.min, Math.min(GUILLEMET.max, libre / (2 * INTERLIGNE_GUILLEMET))));
}

/** Espace (px) entre un guillemet et le message. */
const ECART_GUILLEMET = 24;

/**
 * Guillemet français géant. Le fermant, en bas à droite, s'arrête avant le compteur de Meta (x = 860, il peut descendre sous y = 1080). Sa
 * boîte (0,8 em) contient tout son dessin ; `contain: paint` garde la zone de contenu de la police (1,21 em) hors de la hauteur défilable du bloc.
 */
function Guillemet({ signe, taille, droite = false }: { signe: string; taille: number; droite?: boolean }) {
  return <div style={{ flex: "none", contain: "paint", alignSelf: droite ? "flex-end" : "flex-start", marginRight: droite ? FORMAT.largeur - MARGE - BORD_DROIT_TEXTE_BAS : 0, fontFamily: POLICE_TITRE, fontWeight: GRAISSE_TITRE, fontSize: taille, lineHeight: INTERLIGNE_GUILLEMET, color: COULEURS.encre }}>{signe}</div>;
}

/**
 * T10 — citation / message clé, style TYPOGRAPHIQUE (C, ART-1) : un bloc orange à fond perdu porte le message en capitales géantes (encre sur
 * orange : 5,4:1), entre deux grands guillemets français posés par le code (« en haut à gauche, » en bas à droite) : ils disent « citation »,
 * ce ne sont pas des formes décoratives. La légende facultative vient sous le bloc, après un filet ; sans légende, le bloc prend toute la page.
 */
export function T10({ message, legende, index, total }: Proprietes) {
  chargerPoliceTitre();
  chargerPoliceInter();
  const hauteurBloc = HAUTEUR_CORPS - (legende ? HAUTEUR_LEGENDE : 0);
  const guillemet = tailleGuillemets(message, hauteurBloc);
  const hauteurMessage = hauteurBloc - 2 * REMPLISSAGE_BLOC - 2 * guillemet * INTERLIGNE_GUILLEMET - 2 * ECART_GUILLEMET;
  return (
    <PageBase index={index} total={total} type="T10" fondPerdu>
      <div style={{ ...DANS_LA_COLONNE, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `${REMPLISSAGE_BLOC}px ${MARGE}px`, background: COULEURS.orange }}>
        <Guillemet signe="«" taille={guillemet} />
        <Zone libelle="T10 : message" style={{ flex: "none", maxHeight: hauteurMessage + 16 }}>
          <Titre texte={message} maxLignes={6} hauteurMax={hauteurMessage} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_MESSAGE} max={MESSAGE_MAX} grand />
        </Zone>
        <Guillemet signe="»" taille={guillemet} droite />
      </div>
      {legende && (
        <div style={{ ...DANS_LA_COLONNE, flex: "none", height: HAUTEUR_LEGENDE, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 24 }}>
          <div style={{ width: 120, height: FILET * 3, background: COULEURS.encre }} />
          <div style={{ maxWidth: largeurTexteMax(MARGE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_LEGENDE, lineHeight: 1.2, color: COULEURS.encre }}>{legende}</div>
        </div>
      )}
    </PageBase>
  );
}
