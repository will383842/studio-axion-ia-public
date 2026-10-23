import { AbsoluteFill } from "remotion";
import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE, MARGE, PAGE, POLICE_CORPS, TAILLES } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { Swipe } from "../commun/Swipe";
import { Titre } from "../commun/Titre";
import { chargerPoliceJetBrainsMono } from "../polices";

interface Proprietes {
  index: number;
  total: number;
}

/** Conversation : une grande bulle orange (trois points) et une réponse plus petite à droite, sans texte. */
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

/**
 * T21 — DERNIÈRE page, seule page sombre (fond encre) : invitation générique à écrire en message privé.
 * Tout le texte est posé par le code (`textes-fixes.ts`) : aucun lien, aucun nom, aucun mot-clé d'appel.
 */
export function T21({ index, total }: Proprietes) {
  chargerPoliceJetBrainsMono();
  return (
    <AbsoluteFill style={{ background: COULEURS.encre, padding: MARGE, boxSizing: "border-box" }}>
      <Zone libelle="T21 : corps" style={{ flex: 1, minHeight: 0, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: PAGE.ecart }}>
        <Titre texte={TEXTES_FIXES.t21Titre} maxLignes={3} hauteurMax={520} couleur={COULEURS.creme} largeur={LARGEUR_TITRE} accent />
        <div style={{ alignSelf: "center" }}>
          <Bulles />
        </div>
        <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: TAILLES.phrase, lineHeight: 1.3, color: COULEURS.creme }}>{TEXTES_FIXES.t21Ligne}</div>
      </Zone>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} sombre />
      </div>
    </AbsoluteFill>
  );
}
