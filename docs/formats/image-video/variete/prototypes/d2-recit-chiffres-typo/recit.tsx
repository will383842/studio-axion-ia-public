import React from "react";
/**
 * Axe 2 · Déroulé du récit (image C). REC-B Résultat puis « comment », REC-C Le parcours d'un cas (le message suivi
 * comme un personnage), REC-D En 3 étapes annoncées (vraie scène + vrai repère « 1/3 → 2/3 »).
 */
import { useCurrentFrame } from "remotion";
import { RepereChapitre } from "../socle";
import { Noeud } from "../../../../../../studio-rendu/compositions/image-video/Noeud";
import { a, ANTON, Affiche, Appoint, Bulle, C, CartePleine, Coche, Ecran, Etiquette, Icone, INTER, Points } from "./outils";
import { Pourcent } from "./chiffres";

/** Une carte réelle du schéma (`Noeud`), posée à la main : libellé Anton, détail Inter, icône, état. */
function Carte({ x, y, l, h, libelle, detail, icone, couleur, etat = "actif" as "actif" | "vu", entree = 1, coche = 0, tl = 0.034, td = 0.031 }: { x: number; y: number; l: number; h: number; libelle: string; detail?: string; icone: string; couleur: "orange" | "noir" | "vert"; etat?: "actif" | "vu"; entree?: number; coche?: number; tl?: number; td?: number }) {
  const textes = [{ texte: libelle, role: "libelle" as const, taille: tl, lignes: 1 }, ...(detail ? [{ texte: detail, role: "detail" as const, taille: td, lignes: 1 }] : [])];
  return <Noeud boite={{ id: libelle, x, y, largeur: l, hauteur: h, couche: 0, colonne: null, couleur, textes }} icone={icone} etat={{ etat, entree, coche }} />;
}

/** Flèche verticale de la charte : trait plein orange, dessinée jusqu'à `part` (0 à 1), pointe au bout. */
function Fleche({ x, y0, y1, part, couleur = C.orangeVif }: { x: number; y0: number; y1: number; part: number; couleur?: string }) {
  const y = y0 + (y1 - y0) * part;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={`M${x} ${y0}V${y}`} stroke={couleur} strokeWidth={8} strokeLinecap="round" />
      <path d={`M${x - 18} ${y - 18}L${x} ${y}L${x + 18} ${y - 18}`} stroke={couleur} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** v3 · Le téléphone du client, vu de face, qui monte du bas (seul le haut est visible dans la zone d'appoint) :
 *  cadre plein, écran blanc, encoche ; `children` est posé dans l'écran (repère = coin haut gauche de l'écran). */
function TelephoneClient({ x, y, l, fond, children }: { x: number; y: number; l: number; fond: "sombre" | "ivoire"; children?: React.ReactNode }) {
  // Sur nuit, cadre gris (l'ivoire se confondait avec l'écran blanc).
  const cadre = fond === "sombre" ? C.gris : C.encre;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: 700, boxSizing: "border-box", borderRadius: 72, background: C.blanc, border: `14px solid ${cadre}`, boxShadow: `0 16px 40px ${a(C.encre, 0.12)}` }}>
      <div style={{ position: "absolute", left: (l - 28 - 150) / 2, top: 14, width: 150, height: 22, borderRadius: 11, background: cadre }} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* REC-B · Résultat puis « comment »                                     */
/* ------------------------------------------------------------------ */
/* v2 : le chiffre descend vers le milieu (80 % de 500 px, « RÉSOLUS » de 170 px), la voix ne répète plus le chiffre.
   Appoint : les deux premières cartes du « comment » montent déjà du bas, en fantôme (sans texte). */
export const REC_B_1 = () => (
  <Ecran fond="sombre" temoin="Le chatbot s'en charge.">
    <Etiquette t="Situation type" fond="sombre" y={300} />
    {/* v3 : 80 % de 500 px (glyphes y 379 → 815, x 72 → 877 : il ne peut pas grandir), « RÉSOLUS » porté à 240 px
        (accent à ~45 px sous le 80 %, pied à y ≈ 1090), trait dessous : le bloc descend jusqu'aux sous-titres. Lueur
        retirée (elle faussait la mesure de masse et n'ajoutait rien). */}
    <div style={{ position: "absolute", left: 60, top: 352 }}>
      <Pourcent n={80} taille={500} couleur={C.orangeVif} />
    </div>
    <Affiche t="Résolus" taille={240} fond="sombre" style={{ position: "absolute", left: 68, top: 876 }} />
    {/* Le trait sous « résolus » se trace encore : le chiffre vient de claquer. */}
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d="M76 1124H640" stroke={C.ivoire} strokeWidth={10} strokeLinecap="round" />
      <circle cx={640} cy={1124} r={13} fill={C.ivoire} />
    </svg>
    {/* v3 · Appoint : le « comment » monte déjà du bas, en vraies cartes pleines (sans texte) : la demande du client,
        flèche, le chatbot qui répond (coche). */}
    <Appoint fondu={24}>
      <Bulle x={72} y={1318} l={330} h={150} ombre={false}>
        <Points taille={20} />
      </Bulle>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M424 1393H468" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" />
        <path d="M452 1375L470 1393L452 1411" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <CartePleine x={500} y={1310} l={440} h={200} fond="sombre" icone="robot" pastille={C.orangeVif} iconeCouleur={C.encre}>
        <Points taille={20} />
      </CartePleine>
      <Coche x={926} y={1342} r={34} />
    </Appoint>
  </Ecran>
);

export const REC_B_2 = () => (
  <Ecran fond="ivoire" temoin="Il prend le relais.">
    <Affiche t="Voici *comment.*" taille={124} fond="ivoire" style={{ position: "absolute", left: 72, top: 262 }} />
    {/* Le résultat a quitté le centre : rangé à droite (pastille encre), traînée pointillée jusqu'à la carte. */}
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d="M560 590 C 600 540, 640 510, 690 492" fill="none" stroke={a(C.encre, 0.3)} strokeWidth={6} strokeDasharray="2 16" strokeLinecap="round" />
    </svg>
    <div style={{ position: "absolute", left: 660, top: 420, height: 140, padding: "0 34px", borderRadius: 70, background: C.encre, display: "flex", alignItems: "center", boxShadow: `0 14px 34px ${a(C.encre, 0.12)}` }}>
      <Pourcent n={80} taille={104} couleur={C.blanc} />
    </div>
    {/* Le « comment » : les vraies cartes, en grand ; la deuxième est en train d'arriver. */}
    <Carte x={150} y={600} l={700} h={270} libelle="Message client" detail="23h14" icone="message" couleur="noir" tl={0.05} td={0.042} />
    <Fleche x={500} y0={886} y1={944} part={1} />
    <Carte x={210} y={960} l={580} h={170} libelle="Chatbot IA" icone="robot" couleur="orange" entree={0.42} tl={0.046} />
    {/* v3 · Appoint : la suite du schéma en vraies cartes pleines (sans texte) : à gauche, résolu (coche) ; à droite,
        l'équipe. Les deux branches partent de la carte du chatbot. */}
    <Appoint fondu={24}>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={C.encre} strokeWidth={7} strokeLinecap="round">
        <path d="M500 1296 C 500 1316, 300 1306, 300 1330" />
        <path d="M500 1296 C 500 1316, 760 1306, 760 1330" />
      </svg>
      <CartePleine x={90} y={1326} l={420} h={190} fond="ivoire" icone="robot" pastille={C.orange}>
        <Points taille={20} couleur={C.gris} />
      </CartePleine>
      <Coche x={490} y={1346} r={34} />
      <CartePleine x={570} y={1326} l={420} h={190} fond="ivoire" icone="utilisateurs">
        <Points taille={20} />
      </CartePleine>
    </Appoint>
  </Ecran>
);

/* ------------------------------------------------------------------ */
/* REC-C · Le parcours d'un cas : UN message suivi comme un personnage   */
/* ------------------------------------------------------------------ */
/* v2 : titre et bulle agrandis vers le milieu ; la voix dit le contexte (« tard le soir »), pas le titre.
   Appoint : le téléphone du client, d'où part le message (sillage pointillé). */
export const REC_C_1 = () => (
  <Ecran fond="sombre" temoin="Un client, tard le soir.">
    <Etiquette t="Situation type" fond="sombre" y={290} />
    <Affiche t="Suivons ce" taille={150} fond="sombre" style={{ position: "absolute", left: 72, top: 336 }} />
    <Affiche t="*message.*" taille={150} fond="sombre" style={{ position: "absolute", left: 72, top: 500 }} />
    <Bulle x={210} y={700} l={720} h={320} rotation={-4}>
      <div style={{ ...ANTON, fontSize: 250, color: C.encre }}>23h14</div>
    </Bulle>
    {/* v3 · Appoint : le téléphone du client, d'où part le message (sa bulle orange vient d'être envoyée). */}
    <Appoint fondu={24}>
      <TelephoneClient x={230} y={1312} l={620} fond="sombre">
        <div style={{ position: "absolute", right: 34, top: 66, width: 300, height: 104, borderRadius: 36, borderBottomRightRadius: 10, background: C.orangeVif, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Points taille={18} />
        </div>
        <div style={{ position: "absolute", left: 34, top: 66, width: 200, height: 104, borderRadius: 36, borderBottomLeftRadius: 10, background: a(C.encre, 0.08) }} />
      </TelephoneClient>
    </Appoint>
  </Ecran>
);

export const REC_C_2 = () => {
  // Chemin du message : de « Chatbot IA » (en haut à gauche) à « Ticket clôturé » (en bas à droite).
  // v3 : carte décalée de 24 px à droite (pastille d'icône à x ≥ 65, hors de la zone cachée de gauche).
  const chemin = "M324 410 C 324 560, 690 540, 690 720 S 640 860, 640 948";
  return (
    <Ecran fond="ivoire" temoin="Le client a sa réponse.">
      <Carte x={134} y={270} l={440} h={140} libelle="Chatbot IA" icone="robot" couleur="noir" tl={0.038} />
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* Déjà parcouru : trait plein ; reste à faire : pointillé. Le découpage suit la longueur du tracé. */}
        <path d={chemin} fill="none" stroke={C.orangeVif} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray="0.5 1" />
        <path d={chemin} fill="none" stroke={a(C.orangeVif, 0.55)} strokeWidth={9} strokeLinecap="round" pathLength={100} strokeDasharray="0.1 3.2" strokeDashoffset={-50} />
      </svg>
      <Bulle x={520} y={580} l={360} h={160} rotation={7}>
        <div style={{ ...ANTON, fontSize: 108, color: C.encre }}>23h14</div>
      </Bulle>
      <div style={{ position: "absolute", left: 72, top: 520, ...ANTON, fontSize: 380, color: C.orange }}>
        4<span style={{ marginLeft: "0.12em" }}>s</span>
      </div>
      <Carte x={300} y={950} l={580} h={160} libelle="Ticket clôturé" icone="document" couleur="orange" coche={0.45} tl={0.04} />
      {/* v3 · Appoint : la réponse arrive sur le téléphone du client (sa bulle, puis la réponse cochée). */}
      <Appoint fondu={24}>
        <TelephoneClient x={150} y={1312} l={700} fond="ivoire">
          <div style={{ position: "absolute", right: 34, top: 60, width: 250, height: 92, borderRadius: 34, borderBottomRightRadius: 10, background: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Points taille={16} couleur={C.blanc} />
          </div>
          <div style={{ position: "absolute", left: 34, top: 120, width: 330, height: 92, borderRadius: 34, borderBottomLeftRadius: 10, background: C.blanc, border: `6px solid ${C.vert}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Points taille={16} couleur={C.gris} />
          </div>
          <Coche x={364} y={126} r={30} />
        </TelephoneClient>
      </Appoint>
    </Ecran>
  );
};

/* ------------------------------------------------------------------ */
/* REC-D · En 3 étapes annoncées : le vrai repère, les vraies cartes    */
/* ------------------------------------------------------------------ */
/* v2 : les vraies cartes (`Noeud`) posées en grand au milieu, titre d'étape de 130 px juste au-dessus des sous-titres ;
   la voix dit ce que le titre ne dit pas. Appoint : l'étape suivante en fantôme (1/3 → le chatbot ; 2/3 → les deux
   branches). */
const REPERE = [
  { t: 0, numero: 1 },
  { t: 2.0, numero: 2 },
];

function RecD({ titre, temoin, children, appoint }: { titre: string; temoin: string; children?: React.ReactNode; appoint?: React.ReactNode }) {
  const t = useCurrentFrame() / 25;
  // Le repère réel (pastille + 3 segments), agrandi 2,2 × et posé sous la zone protégée du haut, à gauche.
  const L = 339;
  const ox = (1080 - L) / 2;
  return (
    <Ecran fond="sombre" temoin={temoin}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: `${ox}px 154px`, transform: `translate(${72 - ox}px, ${290 - 154}px) scale(2.2)` }}>
        <RepereChapitre changements={REPERE} total={3} t={t} fond="sombre" />
      </div>
      {children}
      <Affiche t={titre} taille={124} fond="sombre" style={{ position: "absolute", left: 72, top: 1004 }} />
      <Appoint fondu={24}>{appoint}</Appoint>
    </Ecran>
  );
}


/** Carte « déjà vue » (v3), dessinée au style du `Noeud` : le texte reste en ENCRE (pas de gris pâle) ; c'est la carte
 *  qui recule (fond ivoire au lieu du blanc, sans contour ni halo, opacité 0,85 : encre sur ivoire voilé ≈ 11:1). */
function CarteVue({ x, y, l, h, libelle, icone }: { x: number; y: number; l: number; h: number; libelle: string; icone: string }) {
  const d = Math.round(h * 0.7);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: 0.85 }}>
      <div style={{ position: "absolute", left: x, top: y, width: l, height: h, borderRadius: 36, background: C.ivoire, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: d * 0.4, boxSizing: "border-box" }}>
        <div style={{ ...ANTON, textTransform: "none", fontSize: 66, color: C.encre, whiteSpace: "nowrap" }}>{libelle}</div>
      </div>
      <div style={{ position: "absolute", left: x - d / 2 + 4, top: y + (h - d) / 2, width: d, height: d, borderRadius: "50%", background: C.grisClair, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={d * 0.5} couleur={C.encre} epaisseur={2.4} />
      </div>
    </div>
  );
}

/* v3 : les cartes agrandies descendent jusqu'au titre ; l'appoint montre l'étape suivante en VRAIES cartes pleines,
   sans texte (1/3 → le chatbot ; 2/3 → les deux branches : résolu, l'équipe). */
export const REC_D_1 = () => (
  <RecD
    titre="Un client *écrit.*"
    temoin="Personne au bureau."
    appoint={
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M540 1300V1318" />
        </svg>
        <CartePleine x={150} y={1316} l={780} h={214} fond="sombre" icone="robot" pastille={C.orangeVif} iconeCouleur={C.encre}>
          <Points taille={22} />
        </CartePleine>
      </>
    }
  >
    <Bulle x={540} y={468} l={350} h={112} ombre={false} rotation={3}>
      <Points taille={20} />
    </Bulle>
    <Carte x={150} y={612} l={750} h={346} libelle="Message client" detail="23h14" icone="message" couleur="noir" tl={0.054} td={0.046} />
  </RecD>
);

export const REC_D_2 = () => (
  <RecD
    titre="Le chatbot *trie.*"
    temoin="Il lit chaque demande."
    appoint={
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }} fill="none" stroke={C.ivoire} strokeWidth={7} strokeLinecap="round">
          <path d="M540 1294 C 540 1312, 300 1302, 300 1326" />
          <path d="M540 1294 C 540 1312, 770 1302, 770 1326" />
        </svg>
        <CartePleine x={90} y={1322} l={420} h={208} fond="sombre" icone="robot" pastille={C.orangeVif} iconeCouleur={C.encre}>
          <Points taille={20} couleur={C.gris} />
        </CartePleine>
        <Coche x={490} y={1346} r={34} />
        <CartePleine x={570} y={1322} l={420} h={208} fond="sombre" icone="utilisateurs">
          <Points taille={20} />
        </CartePleine>
      </>
    }
  >
    {/* L'étape 1, déjà vue (grisée), et le chatbot qui s'allume ; flèche orange de l'une à l'autre. */}
    <CarteVue x={250} y={468} l={620} h={160} libelle="Message client" icone="message" />
    <Fleche x={540} y0={642} y1={704} part={1} />
    <Carte x={160} y={718} l={760} h={270} libelle="Chatbot IA" icone="robot" couleur="orange" tl={0.064} />
  </RecD>
);

export { INTER };
