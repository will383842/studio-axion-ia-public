import { AbsoluteFill } from "remotion";
import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { couperPhrase, varianteT21, type VarianteT21 } from "../../../../src/briques/visuels/variante-t21";
import { BORD_DROIT_TEXTE, COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, PAGE, POLICE_CORPS, TAILLES } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";
import { Swipe } from "../commun/Swipe";
import { Titre } from "../commun/Titre";
import { LUCIDE } from "../icones/lucide";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  index: number;
  total: number;
  /** Titre de la couverture : choisit la variante (`varianteT21`), pour que la page change d'un carrousel à l'autre. */
  titreCouverture: string;
}

/** Conversation : une grande bulle orange (trois points DEDANS : quelqu'un écrit) et une réponse plus petite à droite, sans texte. */
function Bulles() {
  return (
    <svg width={700} height={670} viewBox="0 0 460 440" role="img" aria-hidden>
      <path d="M60 12 H400 A48 48 0 0 1 448 60 V230 A48 48 0 0 1 400 278 H190 L96 348 L110 278 H60 A48 48 0 0 1 12 230 V60 A48 48 0 0 1 60 12 Z" fill={COULEURS.orange} stroke={COULEURS.creme} strokeWidth="8" strokeLinejoin="round" />
      {[150, 230, 310].map((x) => (
        <circle key={x} cx={x} cy={145} r="22" fill={COULEURS.creme} />
      ))}
      <path d="M270 300 H388 A40 40 0 0 1 428 340 V362 A40 40 0 0 1 388 402 H370 L400 428 L338 402 H270 A40 40 0 0 1 230 362 V340 A40 40 0 0 1 270 300 Z" fill={COULEURS.creme} stroke={COULEURS.creme} strokeWidth="8" strokeLinejoin="round" />
      <path d="M270 351 H388" stroke={COULEURS.encre} strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}

/** Bulle de message de la banque Lucide (« bulle », message-square) en grand, trois points DEDANS : « écrivez-nous ». Sans texte. */
function BulleMessage() {
  const [, attributs] = LUCIDE.bulle[0]!;
  return (
    <svg width={560} height={560} viewBox="0 0 24 24" role="img" aria-hidden>
      <path d={attributs.d as string} fill={COULEURS.orange} stroke={COULEURS.creme} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" stroke={COULEURS.creme} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Composition typographique pleine : la phrase d'invitation en grand, sans dessin ; la fin de phrase en orange (`couperPhrase`, avec ou sans « : »). */
function PhraseEnGrand() {
  const { debut, fin } = couperPhrase(TEXTES_FIXES.t21Ligne);
  return (
    // Bornée au bord du compteur de Meta : la phrase descend sous y = 1080.
    <div style={{ maxWidth: BORD_DROIT_TEXTE_BAS - MARGE, fontFamily: POLICE_CORPS, fontWeight: 800, fontSize: TAILLES.phrase * 2.65, lineHeight: 1.35, letterSpacing: -1.5, textWrap: "balance", color: COULEURS.creme }}>
      {debut && `${debut} `}
      <span style={{ color: COULEURS.orange }}>{fin}</span>
    </div>
  );
}

/** Ce qui occupe le milieu de la page, selon la variante. */
function Milieu({ variante }: { variante: VarianteT21 }) {
  if (variante === "typographie") return <PhraseEnGrand />;
  return <div style={{ alignSelf: "center" }}>{variante === "conversation" ? <Bulles /> : <BulleMessage />}</div>;
}

/**
 * T21 — DERNIÈRE page, seule page sombre (fond encre) : invitation générique à écrire en message privé.
 * Tout le texte est posé par le code (`textes-fixes.ts`) : aucun lien, aucun nom, aucun mot-clé d'appel.
 * La variante (conversation, bulle de message, phrase en grand) vient du titre de couverture : elle change d'un carrousel à l'autre.
 */
export function T21({ index, total, titreCouverture }: Proprietes) {
  chargerPoliceInter();
  const variante = varianteT21(titreCouverture);
  return (
    <AbsoluteFill style={{ background: COULEURS.encre, padding: MARGE, boxSizing: "border-box" }}>
      <Zone libelle="T21 : corps" style={{ flex: 1, minHeight: 0, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: PAGE.ecart }}>
        <Titre texte={TEXTES_FIXES.t21Titre} maxLignes={3} hauteurMax={520} couleur={COULEURS.creme} largeur={LARGEUR_TITRE_BORNE} accent />
        <Milieu variante={variante} />
        {/* Phrase en grand : elle descend jusqu'au pied (lignes équilibrées, interligne large), sans autre ligne en dessous. */}
        {variante === "typographie" ? null : (
          <div style={{ maxWidth: BORD_DROIT_TEXTE - MARGE, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLES.phrase, lineHeight: 1.3, color: COULEURS.creme }}>{TEXTES_FIXES.t21Ligne}</div>
        )}
      </Zone>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} sombre />
      </div>
    </AbsoluteFill>
  );
}
