import React from "react";
/**
 * VERSION 4:5 (1080 × 1350, fil LinkedIn / Facebook). Mêmes tailles en pixels que le 9:16. Texte entre x = 60 et 1020,
 * y = 54 et 1188 ; sous-titres finis au-dessus de y = 1188.
 */
import { PointMessage, Traces } from "./camera";
import { C, Carte, Ecran, Fil, Jeton, Part, Svg, Texte, enS } from "./kit";

const H = 1350;

/** CAM-C recadré pour le 4:5 (v2 : schéma plus grand, de y = 150 jusqu'au ras de la bande des sous-titres). */
export function R45CamC1() {
  const fx = 540;
  const fy = 500;
  const g = 270;
  const d = 800;
  const bout = 730;
  return (
    <Ecran fond="ivoire" hauteur={H} sousTitre="Il trie chaque demande.">
      <Svg hauteur={H}>
        <Fil d={`M ${fx} 330 L ${fx} ${fy}`} couleur={C.grisClair} pointe={false} />
        <defs>
          <linearGradient id="trainee45" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.orangeVif} stopOpacity={0} />
            <stop offset="1" stopColor={C.orangeVif} stopOpacity={1} />
          </linearGradient>
        </defs>
        <rect x={fx - 4.5} y={fy - 150} width={9} height={150} fill="url(#trainee45)" />
        <Fil d={`M ${fx} ${fy} C ${fx} ${fy + 150}, ${g} ${fy + 120}, ${g} ${bout}`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M ${fx} ${fy} C ${fx} ${fy + 150}, ${d} ${fy + 120}, ${d} ${bout}`} couleur={C.encre} pointe={false} />
        <Fil d={`M ${g} 846 L ${g} 878`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M ${d} 846 L ${d} 878`} couleur={C.encre} pointe={false} />
      </Svg>
      {/* v3 : carte descendue à y = 172 (≥ 48 px sous la marque), bas inchangé à 330. */}
      <Carte x={230} y={172} l={620} h={158} libelle="Chatbot IA" taille={100} icone="robot" couleur="orange" etat="pose" />
      <Traces pts={[[fx, fy - 140, 0.26], [fx, fy - 104, 0.36], [fx, fy - 68, 0.48]]} r={22} />
      <PointMessage x={fx} y={fy} r={48} />
      <Part x={g} y={780} texte="80 %" couleur="orange" taille={110} />
      <Part x={d} y={780} texte="20 %" couleur="noir" taille={96} />
      {/* v3 : les étapes suivantes en vraies cartes pleines (sans texte), comme CAM-C-1 ; le haut est inchangé. */}
      {/* v3 : remontées (y 878 → 978) pour laisser ≥ 60 px d'air au-dessus du sous-titre et ne plus toucher les pastilles. */}
      <Carte x={g - 120} y={878} l={370} h={100} icone="etincelles" couleur="orange" etat="pose" />
      <Carte x={d - 180} y={878} l={370} h={100} icone="mail" etat="pose" />
    </Ecran>
  );
}

/**
 * Vue d'ensemble du schéma en 4:5. v3 : 6 libellés exactement (exception « vue d'ensemble » du § 1) : le message et la
 * fin de la branche 20 % passent en icônes ; plus de coche sur la carte « Résolu sans humain » (elle mordait « SANS »),
 * et aucun fil ne traverse une icône à côté d'une autre.
 */
export function R45Ens1() {
  const g = 315;
  const d = 795;
  return (
    <Ecran fond="ivoire" hauteur={H} sousTitre="Voilà tout le circuit.">
      <Svg hauteur={H}>
        <Fil d="M 156 215 L 224 215" couleur={C.encre} bout={[224, 215]} angle={0} />
        <Fil d={`M 560 270 L 560 300 L ${g + 30} 300 Q ${g} 300 ${g} 330`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M 560 300 L ${d - 30} 300 Q ${d} 300 ${d} 330`} couleur={C.encre} pointe={false} />
        <Fil d={`M ${g} 530 L ${g} 856`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M ${d} 530 L ${d} 990`} couleur={C.encre} pointe={false} />
      </Svg>
      <Jeton x={110} y={215} r={46} icone="message" />
      <Carte x={330} y={160} l={460} h={110} libelle="Chatbot IA" icone="robot" taille={68} couleur="orange" etat="pose" />
      <Texte x={g} y={330} taille={180} centre largeur={480} couleur={C.orange}>
        80 %
      </Texte>
      <Texte x={d} y={352} taille={136} centre largeur={360} couleur={C.encre}>
        20 %
      </Texte>
      <Jeton x={g} y={574} r={32} icone="etincelles" couleur="orange" />
      <Jeton x={d} y={574} r={32} icone="mail" />
      <Carte x={g - 205} y={618} l={410} h={170} libelle={"Envoyée\nen 4 s"} icone="eclair" taille={60} couleur="orange" etat="pose" />
      <Carte x={630} y={618} l={385} h={170} libelle={"Alerte\nTelegram"} icone="cloche" taille={60} etat="pose" />
      <Jeton x={g} y={823} r={26} icone="document" couleur="orange" />
      <Carte x={g - 205} y={858} l={410} h={170} libelle={"Résolu\nsans humain"} icone="coche" taille={60} couleur="vert" etat="pose" />
      {/* Fin de la branche 20 % : l'équipe, puis le client (icônes, déjà dites par la voix). */}
      <Jeton x={d} y={862} r={46} icone="utilisateurs" />
      <Jeton x={d} y={978} r={46} icone="utilisateur" />
    </Ecran>
  );
}
