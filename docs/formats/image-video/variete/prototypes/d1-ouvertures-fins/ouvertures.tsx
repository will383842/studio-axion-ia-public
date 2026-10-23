import React from "react";
/** Axe 1 · Ouvertures (OUV-A à OUV-E), 2 images chacune (≈ 0,3 s et ≈ 2 s), image C du chatbot. */
import { a, ANTON, Bulle, C, Carte, CarteIcone, Coche, Ecran, Etiquette, Horloge, Icone, INTER, Lueur, Points, SousTitre, SousTitrePastille, T, Telephone, TelephoneCouche, Vibration } from "./objets";

const SITUATION = "Situation type · support client";

/* ───────── OUV-A · Résultat d'abord ───────── */

/** Dix messages de la nuit, en appoint : 8 réglés (coche), 2 laissés à l'équipe (contour). */
function DixMessages({ y, fond }: { y: number; fond: "sombre" | "ivoire" }) {
  const l = 128, h = 90, pas = 160;
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const x = 72 + (i % 5) * pas;
        const yy = y + Math.floor(i / 5) * 118;
        const regle = i !== 6 && i !== 9;
        return (
          <div key={i}>
            <Bulle x={x} y={yy} l={l} h={h} fond={regle ? (fond === "sombre" ? C.ivoire : C.blanc) : "transparent"} contour={regle ? undefined : C.grisClair} epaisseur={5} pointille={!regle} />
            {regle ? <Coche x={x + l - 6} y={yy + 6} r={22} /> : null}
          </div>
        );
      })}
    </>
  );
}

/** 0,3 s : « 80 % » claque en géant (léger dépassement d'échelle), le trait d'impact est à mi-course ; en appoint, les dix
 * messages de la nuit (8 cochés). */
export function OuvA1() {
  return (
    <Ecran fond="sombre">
      <Lueur x={420} y={700} r={640} o={0.75} />
      <Etiquette texte={SITUATION} y={270} fond="sombre" />
      <div style={{ position: "absolute", left: 60, top: 322, transform: "scale(1.03)", transformOrigin: "0% 100%", display: "flex", alignItems: "flex-start" }}>
        <span style={{ ...ANTON, fontSize: 580, color: C.orangeVif, letterSpacing: "-0.01em" }}>80</span>
        <span style={{ ...ANTON, fontSize: 220, color: C.orangeVif, marginLeft: 12, marginTop: 48 }}>%</span>
      </div>
      {/* trait d'impact qui se dessine (mi-course) */}
      <div style={{ position: "absolute", left: 72, top: 924, width: 560, height: 14, borderRadius: 7, background: C.ivoire }} />
      <div style={{ position: "absolute", left: 632, top: 924, width: 70, height: 14, borderRadius: 7, background: `linear-gradient(90deg, ${C.ivoire}, ${a(C.ivoire, 0)})` }} />
      <T x={72} y={972} taille={96} couleur={C.ivoire}>Résolus sans humain</T>
      <DixMessages y={1312} fond="sombre" />
      <SousTitre texte="Pendant votre sommeil." fond="sombre" />
    </Ecran>
  );
}

/** 2 s : le chiffre s'est rangé en pastille, la vidéo « rembobine » vers le début du schéma : le message de 23h14 ;
 * en appoint, les étapes suivantes remontent dans la carte (silhouettes vides). */
export function OuvA2() {
  return (
    <Ecran fond="sombre">
      <Lueur x={520} y={780} r={620} o={0.6} />
      <Etiquette texte={SITUATION} y={270} fond="sombre" />
      {/* traces du rétrécissement du chiffre */}
      <div style={{ position: "absolute", left: 60, top: 320, width: 440, height: 196, borderRadius: 999, border: `4px dashed ${a(C.grisClair, 0.25)}` }} />
      <div style={{ position: "absolute", left: 66, top: 326, width: 350, height: 156, borderRadius: 999, border: `4px dashed ${a(C.grisClair, 0.45)}` }} />
      <div style={{ position: "absolute", left: 72, top: 332, ...ANTON, fontSize: 110, color: C.ivoire, padding: "14px 40px 10px", borderRadius: 999, border: `6px solid ${C.grisClair}` }}>80 %</div>
      {/* rembobinage : deux triangles vers la gauche + chemin en pointillés jusqu'au message */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <g transform="translate(640 358)" fill={C.orangeVif}>
          <path d="M70 0 L0 58 L70 116 Z" />
          <path d="M150 0 L80 58 L150 116 Z" />
        </g>
        <path d="M430 516 C 480 540, 540 530, 540 572" fill="none" stroke={C.orangeVif} strokeWidth={8} strokeDasharray="4 22" strokeLinecap="round" />
      </svg>
      <Carte x={150} y={590} l={740} h={470} icone="message" contour={C.orangeVif} pastille={C.ivoire} couleurIcone={C.orange} />
      <T x={150} y={640} largeur={740} align="center" taille={100} couleur={C.encre} style={{ textTransform: "none" }}>Message client</T>
      <T x={150} y={782} largeur={740} align="center" taille={220} couleur={C.orange}>23h14</T>
      {/* v3 · appoint : la suite du schéma, en vraies cartes pleines (chatbot, puis les deux branches) que le rembobinage
          va ramener dans la carte ; icônes seules, rien qu'on ne lise pas déjà au-dessus. */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <path d="M540 1300 L540 1314" stroke={C.orangeVif} strokeWidth={7} strokeLinecap="round" />
        <path d="M540 1410 C 540 1428, 300 1416, 300 1440" fill="none" stroke={C.orangeVif} strokeWidth={7} />
        <path d="M540 1410 C 540 1428, 780 1416, 780 1440" fill="none" stroke={C.ivoire} strokeWidth={7} />
      </svg>
      <CarteIcone cx={540} cy={1362} l={620} h={96} icone="robot" contour={C.orangeVif} ombre={0} />
      <CarteIcone cx={300} cy={1484} l={400} h={88} icone="etincelles" contour={C.orangeVif} ombre={0} />
      <CarteIcone cx={780} cy={1484} l={400} h={88} icone="mail" couleurIcone={C.blanc} ombre={0} />
      <SousTitre texte="Revenons au tout début." fond="sombre" />
    </Ecran>
  );
}

/* ───────── OUV-B · Avant / après d'un coup ───────── */

function Lune({ x, y, r, couleur, fond }: { x: number; y: number; r: number; couleur: string; fond: string }) {
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <circle cx={x} cy={y} r={r} fill={couleur} />
      <circle cx={x + r * 0.45} cy={y - r * 0.3} r={r * 0.85} fill={fond} />
    </svg>
  );
}

/** Moitié nuit (v3, la même dans les deux images) : 23h14, le message reste sans réponse ; en appoint, les messages
 * suivants s'empilent sur la même colonne (série régulière : même largeur, même pas). */
function MoitieNuit() {
  return (
    <>
      <Etiquette texte="Situation type" y={270} fond="sombre" />
      <Lune x={430} y={372} r={52} couleur={C.ivoire} fond={C.nuit} />
      <T x={72} y={440} taille={180} couleur={C.ivoire}>23h14</T>
      <Bulle x={72} y={690} l={400} h={170}><Points taille={34} /></Bulle>
      <T x={72} y={892} taille={58} police="inter" couleur={C.grisClair}>Sans réponse</T>
      <Bulle x={72} y={1000} l={400} h={120} fond={a(C.blanc, 0.9)}><Points taille={26} /></Bulle>
      <Bulle x={72} y={1318} l={400} h={100} fond={a(C.blanc, 0.9)}><Points taille={24} /></Bulle>
      <Bulle x={72} y={1432} l={400} h={100} fond={a(C.blanc, 0.9)}><Points taille={24} /></Bulle>
    </>
  );
}

/** Moitié ivoire : le chatbot répond en 4 s. `pop` : échelle du « 4 s » (> 1 = il vient de claquer). En appoint, les
 * réponses partent, alignées sur les messages de gauche (mêmes rangées, même taille). */
function MoitieIvoire({ pop, coche }: { pop: number; coche: boolean }) {
  return (
    <>
      <div style={{ position: "absolute", left: 713 - 60, top: 410, width: 120, height: 120, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom="robot" taille={70} couleur={C.orangeVif} epaisseur={2.6} />
      </div>
      <T x={543} y={556} largeur={340} align="center" taille={76} couleur={C.encre} style={{ textTransform: "none" }}>Chatbot IA</T>
      <div style={{ position: "absolute", left: 568, top: 688, width: 300, transform: `scale(${pop})`, transformOrigin: "35% 55%" }}>
        <T x={0} y={0} largeur={300} align="center" taille={250} couleur={C.orange} style={{ textTransform: "none", position: "relative" }}>4 s</T>
      </div>
      {coche ? <Coche x={713} y={1050} r={56} /> : null}
      {[1318, 1432].map((y) => (
        <Bulle key={y} x={588} y={y} l={400} h={100} queue="droite" contour={C.encre} epaisseur={5}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 210, height: 14, borderRadius: 7, background: C.encre }} />
            <div style={{ width: 140, height: 14, borderRadius: 7, background: a(C.encre, 0.45) }} />
          </div>
          <div style={{ position: "relative", width: 56, height: 56 }}><Coche x={28} y={28} r={26} /></div>
        </Bulle>
      ))}
    </>
  );
}

/** 0,3 s (v3) : l'écran est déjà coupé en deux ; la moitié ivoire se dévoile de haut en bas, le front orange est aux
 * trois quarts (y 1410) : « 4 s » vient de claquer (léger dépassement d'échelle), la coche n'est pas encore là, la
 * première réponse sort du front. */
export function OuvB1() {
  const front = 1410;
  return (
    <Ecran fond="sombre">
      <Lueur x={270} y={820} r={460} o={0.7} />
      <MoitieNuit />
      <div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, clipPath: `inset(190px 0 ${1920 - front}px 0)` }}>
        <div style={{ position: "absolute", left: -540, top: 0, width: 1080, height: 1920, background: `radial-gradient(700px 900px at 85% 40%, ${C.ivoireHaut}, ${C.ivoire})` }} />
        <div style={{ position: "absolute", left: -540, top: 0, width: 1080, height: 1920 }}>
          <MoitieIvoire pop={1.05} coche={false} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 536, top: 186, width: 544, height: 8, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 540, top: front - 70, width: 540, height: 70, background: `linear-gradient(180deg, ${a(C.orangeVif, 0)}, ${a(C.orangeVif, 0.28)})` }} />
      <div style={{ position: "absolute", left: 540, top: front - 5, width: 540, height: 10, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 536, top: 190, width: 8, height: front - 190, background: C.orangeVif }} />
      <SousTitrePastille texte="Avant, puis après." y={1166} centre={526} />
    </Ecran>
  );
}

/** 2 s : les deux moitiés sont posées, la coche verte valide ; sous la bande des sous-titres, la conversation continue
 * en grille régulière 2 × 2 : à gauche les messages s'empilent sans réponse, à droite les réponses partent. Sous-titre
 * en pastille sur la couture, dans la bande 1152 → 1286. */
export function OuvB2() {
  return (
    <Ecran fond="sombre">
      <Lueur x={270} y={820} r={460} o={0.7} />
      <div style={{ position: "absolute", left: 540, top: 190, width: 540, height: 1730, background: `radial-gradient(700px 900px at 35% 40%, ${C.ivoireHaut}, ${C.ivoire})` }} />
      <MoitieNuit />
      <MoitieIvoire pop={1} coche />
      <div style={{ position: "absolute", left: 536, top: 190, width: 8, height: 1730, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 536, top: 186, width: 544, height: 8, background: C.orangeVif }} />
      <SousTitrePastille texte="Le client n'attend plus." y={1166} centre={526} />
    </Ecran>
  );
}

/* ───────── OUV-C · Situation précise ───────── */

/** Le téléphone posé sur la table de nuit (appoint, y 1300 → 1536) : `repondu` = la réponse est partie (coche). */
export function TableDeNuit({ repondu, vibre }: { repondu?: boolean; vibre?: boolean }) {
  return (
    <>
      {/* v3 : téléphone agrandi (840 × 206, 78 % de la largeur), posé sur le plateau de la table de nuit */}
      <div style={{ position: "absolute", left: 72, top: 1522, width: 936, height: 8, borderRadius: 4, background: a(C.grisClair, 0.6) }} />
      <TelephoneCouche x={120} y={1312} l={840} h={206}>
        <div style={{ position: "absolute", left: 96, top: 30, width: 640, height: 122, borderRadius: 36, background: repondu ? a(C.blanc, 0.94) : C.blanc, display: "flex", alignItems: "center", gap: 24, padding: "0 26px", boxSizing: "border-box" }}>
          <div style={{ width: 78, height: 78, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom={repondu ? "robot" : "message"} taille={44} couleur={C.orangeVif} epaisseur={2.6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ width: "88%", height: 16, borderRadius: 8, background: C.encre }} />
            <div style={{ width: "58%", height: 16, borderRadius: 8, background: a(C.encre, 0.4) }} />
          </div>
          {repondu ? <div style={{ position: "relative", width: 66, height: 66, flex: "none" }}><Coche x={33} y={33} r={30} /></div> : null}
        </div>
      </TelephoneCouche>
      {vibre ? (
        <>
          <Vibration x={104} y={1415} cote={-1} />
          <Vibration x={976} y={1415} cote={1} />
        </>
      ) : null}
    </>
  );
}

/** 0,3 s : gros plan sur l'horloge, 23h14 ; l'aiguille des minutes vient d'avancer (trace). En appoint, le téléphone
 * posé sur la table de nuit vibre : le message arrive. */
export function OuvC1() {
  return (
    <Ecran fond="sombre">
      <Lueur x={540} y={640} r={600} o={0.7} />
      <Etiquette texte={SITUATION} y={262} fond="sombre" />
      <Horloge cx={540} cy={640} r={296} h={23} m={14} trace={40} />
      <T x={130} y={974} largeur={820} align="center" taille={170} couleur={C.ivoire}>23h14</T>
      <TableDeNuit vibre />
      <SousTitre texte="La boutique est fermée." fond="sombre" />
    </Ecran>
  );
}

/** 2 s : l'heure est devenue l'écran verrouillé d'un téléphone ; le message du client tombe, le téléphone vibre. En
 * appoint, le message file vers le chatbot qui s'éveille (carte en silhouette). */
export function OuvC2() {
  return (
    <Ecran fond="sombre">
      <Lueur x={480} y={760} r={600} o={0.7} />
      <Etiquette texte={SITUATION} y={262} fond="sombre" />
      <Telephone x={150} y={318} l={700} h={812} inclinaison={-2} cadre={C.grisClair}>
        <T x={0} y={92} largeur={672} align="center" taille={190} couleur={C.ivoire}>23h14</T>
        {/* trace de chute de la notification (objet, pas de texte) */}
        <div style={{ position: "absolute", left: 36, top: 340, width: 600, height: 40, borderRadius: 30, background: a(C.ivoire, 0.1) }} />
        <div style={{ position: "absolute", left: 36, top: 362, width: 600, height: 40, borderRadius: 30, background: a(C.ivoire, 0.18) }} />
        <div style={{ position: "absolute", left: 30, top: 390, width: 612, height: 200, borderRadius: 44, background: C.blanc, display: "flex", alignItems: "center", gap: 22, padding: "0 26px", boxSizing: "border-box", boxShadow: `0 20px 50px ${a(C.nuit, 0.12)}` }}>
          <div style={{ width: 108, height: 108, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="message" taille={60} couleur={C.orangeVif} epaisseur={2.6} />
          </div>
          <div style={{ ...ANTON, textTransform: "none", fontSize: 66, color: C.encre, whiteSpace: "nowrap" }}>Message client</div>
        </div>
        {/* v3 : le message du client, ouvert sous la notification, sans réponse (bulle pleine) */}
        <Bulle x={30} y={616} l={470} h={110} fond={C.ivoire}><Points couleur={C.gris} taille={26} /></Bulle>
      </Telephone>
      <Vibration x={130} y={720} cote={-1} />
      <Vibration x={872} y={700} cote={1} />
      {/* v3 · appoint : le message file vers le chatbot, qui s'éveille (vraie carte, pleine) */}
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <path d="M540 1300 L540 1328" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: 540 - 13, top: 1290, width: 26, height: 26, borderRadius: "50%", background: C.orangeVif }} />
      <CarteIcone cx={540} cy={1420} l={780} h={176} icone="robot" contour={C.orangeVif} epaisseur={6} pastille={C.encre} couleurIcone={C.orangeVif} ombre={0} />
      <SousTitre texte="Personne ne *répond.*" fond="sombre" />
    </Ecran>
  );
}

/* ───────── OUV-D · Question à l'écran ───────── */

function Curseur({ x, y, h }: { x: number; y: number; h: number }) {
  return <div style={{ position: "absolute", left: x, top: y, width: 22, height: h, background: C.orange }} />;
}

/** Horizon (fil fin) et lune en encre, posés dans la zone d'appoint. `monte` : 0 = sous l'horizon, 1 = entièrement levée. */
function Horizon({ cx, monte, r = 104, debut = 72 }: { cx: number; monte: number; r?: number; debut?: number }) {
  const sol = 1508;
  const cy = sol + r + 8 - monte * (2 * r + 40);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <defs>
        <clipPath id={`ciel${cx}`}><rect x={0} y={0} width={1080} height={sol} /></clipPath>
        <mask id={`croissant${cx}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <rect x={0} y={0} width={1080} height={1920} fill="white" />
          <circle cx={cx + r * 0.45} cy={cy - r * 0.32} r={r * 0.86} fill="black" />
        </mask>
      </defs>
      <g clipPath={`url(#ciel${cx})`}>
        {monte < 0.9 ? <path d={`M${cx - r - 30} ${cy + 30} A${r + 40} ${r + 40} 0 0 1 ${cx - 20} ${cy - r - 34}`} fill="none" stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 18" strokeLinecap="round" /> : null}
        <circle cx={cx} cy={cy} r={r} fill={C.encre} mask={`url(#croissant${cx})`} />
      </g>
      <line x1={debut} y1={sol} x2={1008} y2={sol} stroke={a(C.encre, 0.55)} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/** 0,3 s : « QUI » géant, « RÉPOND » vient d'arriver, le curseur bat ; en bas, la lune commence à se lever. */
export function OuvD1() {
  return (
    <Ecran fond="ivoire">
      <Etiquette texte={SITUATION} y={262} fond="ivoire" />
      {/* la queue du Q finit vers y = 880 ; l'accent de RÉPOND commence vers y = 905 (écart ≥ 20 px) */}
      <T x={62} y={316} taille={548} couleur={C.encre}>Qui</T>
      <T x={68} y={928} taille={216} couleur={C.encre}>Répond</T>
      <Curseur x={712} y={950} h={186} />
      {/* v3 · appoint : les messages du client attendent sous la question (bulles pleines), la lune se lève à droite */}
      <Bulle x={72} y={1316} l={470} h={124} contour={C.encre} epaisseur={6}><Points taille={28} /></Bulle>
      <Bulle x={72} y={1452} l={360} h={76} fond={C.blanc} contour={C.encre} epaisseur={5}><Points taille={18} /></Bulle>
      <Horizon cx={800} monte={0.62} r={140} debut={600} />
    </Ecran>
  );
}

/** 2 s : la question entière, trois tailles, « NUIT » en orange ; en bas, la lune levée et les messages qui attendent. */
export function OuvD2() {
  return (
    <Ecran fond="ivoire">
      <Etiquette texte="Situation type" y={262} fond="ivoire" />
      {/* v3 : la question étalée sur toute la hauteur (bas de « NUIT » vers y = 1110) */}
      <div style={{ position: "absolute", left: 66, top: 330, ...ANTON, color: C.encre, whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 190, lineHeight: 1 }}>Qui répond</div>
        {/* écart franc entre la queue du Q et l'accent de « À » (≥ 30 px) */}
        <div style={{ fontSize: 154, lineHeight: 1, marginTop: 104 }}>à vos clients</div>
        <div style={{ fontSize: 236, lineHeight: 1, marginTop: 96 }}>
          la <span style={{ color: C.orange }}>nuit</span> ?
        </div>
      </div>
      {/* v3 · appoint : trois messages pleins empilés (la série régulière des clients qui attendent), lune levée */}
      <Bulle x={72} y={1312} l={500} h={64} contour={C.encre} epaisseur={5}><Points taille={18} /></Bulle>
      <Bulle x={72} y={1384} l={500} h={64} contour={C.encre} epaisseur={5}><Points taille={18} /></Bulle>
      <Bulle x={72} y={1456} l={500} h={64} contour={C.encre} epaisseur={5}><Points taille={18} /></Bulle>
      <Horizon cx={810} monte={0.95} r={110} debut={620} />
    </Ecran>
  );
}

/* ───────── OUV-E · Détail puis recul ───────── */

function Cloche({ cx, cy, r, angle }: { cx: number; cy: number; r: number; angle: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50% 15%", display: "flex" }}>
          <Icone nom="cloche" taille={r * 1.15} couleur={C.orangeVif} epaisseur={2.4} />
        </div>
      </div>
      <Vibration x={cx - r - 6} y={cy} cote={-1} />
      <Vibration x={cx + r + 6} y={cy} cote={1} />
    </>
  );
}

/** 0,3 s : collé sur l'alerte Telegram, la carte déborde de l'écran, la cloche s'agite ; sous la bande, le fil mène déjà
 * à la carte suivante (l'humain), qui entre dans le champ. */
export function OuvE1() {
  return (
    <Ecran fond="ivoire">
      <Etiquette texte={SITUATION} y={262} fond="ivoire" />
      <div style={{ position: "absolute", left: 40, top: 344, width: 1200, height: 780, boxSizing: "border-box", borderRadius: 80, background: C.blanc, border: `16px solid ${C.encre}`, boxShadow: `0 40px 100px ${a(C.encre, 0.12)}` }} />
      <Cloche cx={262} cy={548} r={124} angle={-16} />
      <T x={110} y={744} taille={116} couleur={C.encre}>Alerte Telegram</T>
      <T x={112} y={906} taille={66} police="inter" couleur={C.encre}>Intervention requise</T>
      {/* fil fin vers la carte suivante (il passe à gauche du sous-titre) */}
      <div style={{ position: "absolute", left: 147, top: 1124, width: 6, height: 216, background: C.encre }} />
      {/* v3 : la carte suivante (l'humain) entre pleine dans le champ, au même style que l'alerte */}
      <div style={{ position: "absolute", left: 40, top: 1330, width: 1200, height: 206, boxSizing: "border-box", borderRadius: 80, background: C.blanc, border: `16px solid ${C.encre}` }} />
      <div style={{ position: "absolute", left: 262 - 70, top: 1363, width: 140, height: 140, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom="utilisateur" taille={76} couleur={C.blanc} epaisseur={2.6} />
      </div>
      <div style={{ position: "absolute", left: 384, top: 1396, width: 420, height: 26, borderRadius: 13, background: C.encre }} />
      <div style={{ position: "absolute", left: 384, top: 1444, width: 280, height: 26, borderRadius: 13, background: a(C.encre, 0.45) }} />
      <SousTitre texte="Un cas trop *complexe.*" fond="ivoire" />
    </Ecran>
  );
}

/** Schéma réel de l'image C en grand (v2) : deux colonnes écartées (x 180 et 900) pour laisser la bande des
 * sous-titres libre au centre ; la 4e rangée est sous la bande (zone d'appoint), reliée par un fil fin. */
function SchemaRecul() {
  const xL = 180, xR = 900;
  const rangs = [662, 842, 1022, 1416];
  const fil = (x: number, y0: number, y1: number, c: string, fin = false) => <line x1={x} y1={y0} x2={x} y2={y1} stroke={c} strokeWidth={fin ? 5 : 7} strokeDasharray={fin ? "3 14" : undefined} strokeLinecap="round" />;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <line x1={540} y1={378} x2={540} y2={448} stroke={C.orangeVif} strokeWidth={7} />
        <path d={`M540 552 C 540 590, ${xL} 560, ${xL} ${rangs[0] - 52}`} fill="none" stroke={C.orangeVif} strokeWidth={7} />
        <path d={`M540 552 C 540 590, ${xR} 560, ${xR} ${rangs[0] - 52}`} fill="none" stroke={C.encre} strokeWidth={7} />
        {fil(xL, rangs[0] + 52, rangs[1] - 52, C.orangeVif)}
        {fil(xL, rangs[1] + 52, rangs[2] - 52, C.orangeVif)}
        {fil(xL, rangs[2] + 52, rangs[3] - 92, C.orangeVif, true)}
        {fil(xR, rangs[0] + 52, rangs[1] - 52, C.encre)}
        {fil(xR, rangs[1] + 52, rangs[2] - 70, C.encre)}
        {fil(xR, rangs[2] + 70, rangs[3] - 92, C.encre, true)}
      </svg>
      <CarteIcone cx={540} cy={326} l={240} h={104} icone="message" />
      <CarteIcone cx={540} cy={500} l={280} h={104} icone="robot" contour={C.orangeVif} />
      {["etincelles", "eclair", "document"].map((ic, i) => (
        <CarteIcone key={ic} cx={xL} cy={rangs[i]} icone={ic} contour={C.orangeVif} />
      ))}
      {/* v3 · appoint : les deux issues du schéma (ticket clôturé, humain) en grandes cartes pleines */}
      <CarteIcone cx={xL + 70} cy={rangs[3]} l={360} h={180} icone="coche" contour={C.orangeVif} pastille={C.vert} epaisseur={6} />
      <CarteIcone cx={xR} cy={rangs[0]} icone="mail" couleurIcone={C.blanc} />
      <CarteIcone cx={xR} cy={rangs[1]} icone="utilisateurs" couleurIcone={C.blanc} />
      <CarteIcone cx={xR - 70} cy={rangs[3]} l={360} h={180} icone="utilisateur" couleurIcone={C.blanc} epaisseur={6} />
    </>
  );
}

/** 2 s : la caméra a reculé ; l'alerte n'est plus qu'une carte du circuit, le cadre se resserre sur elle. */
export function OuvE2() {
  return (
    <Ecran fond="ivoire">
      <SchemaRecul />
      {/* carte de l'alerte, encore un peu plus grande que les autres (fin du recul) */}
      <Carte x={420} y={952} l={530} h={140} contour={C.encre} actif epaisseurContour={6} rayon={30} style={{ boxShadow: "none" }} />
      <T x={470} y={952} largeur={410} align="center" taille={64} couleur={C.encre} style={{ textTransform: "none", lineHeight: "140px" }}>Alerte Telegram</T>
      <div style={{ position: "absolute", left: 378, top: 982, width: 80, height: 80, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-12deg)" }}>
        <Icone nom="cloche" taille={46} couleur={C.orangeVif} epaisseur={2.6} />
      </div>
      {/* cadre de la caméra : l'ancien cadre (pointillés) et le nouveau (coins orange) */}
      <div style={{ position: "absolute", left: 318, top: 880, width: 742, height: 260, borderRadius: 40, border: `4px dashed ${a(C.encre, 0.25)}` }} />
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1} fill="none" stroke={C.orangeVif} strokeWidth={10} strokeLinecap="round">
        {[
          [350, 920, 1, 1],
          [978, 920, -1, 1],
          [350, 1124, 1, -1],
          [978, 1124, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y + sy * 46} L${x} ${y} L${x + sx * 46} ${y}`} />
        ))}
      </svg>
      <SousTitre texte="*L'équipe* s'en charge." fond="ivoire" />
    </Ecran>
  );
}

const ICONES_A = ["etincelles", "eclair", "document", "coche"];
const ICONES_B = ["mail", "utilisateurs", "cloche", "utilisateur"];

/** Le schéma réel de l'image C en miniature (icônes réelles des nœuds), l'alerte en clair. */
export function MiniSchema({ alerteGrande = true, opacite = 1 }: { alerteGrande?: boolean; opacite?: number }) {
  const ligne = (y: number) => y;
  const rangs = [640, 770, 900, 1030].map(ligne);
  const pastille = (icone: string, cx: number, cy: number, fondP: string, couleur: string) => (
    <div style={{ position: "absolute", left: cx - 36, top: cy - 36, width: 72, height: 72, borderRadius: "50%", background: fondP, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone nom={icone} taille={40} couleur={couleur} epaisseur={2.6} />
    </div>
  );
  const carte = (x: number, y: number, l: number, h: number, contour: string, icone: string, fondP: string, couleur: string, cle: string) => (
    <div key={cle}>
      <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 28, background: C.blanc, border: `5px solid ${contour}`, boxShadow: `0 14px 36px ${a(C.encre, 0.08)}` }} />
      {pastille(icone, x + l / 2, y + h / 2, fondP, couleur)}
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: opacite }}>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <line x1={475} y1={410} x2={475} y2={470} stroke={C.orangeVif} strokeWidth={7} />
        <path d={`M475 560 C 475 600, 250 580, 250 ${rangs[0] - 45}`} fill="none" stroke={C.orangeVif} strokeWidth={7} />
        <path d={`M475 560 C 475 600, 700 580, 700 ${rangs[0] - 45}`} fill="none" stroke={C.encre} strokeWidth={7} />
        {rangs.slice(0, 3).map((y, i) => (
          <g key={i}>
            <line x1={250} y1={y + 45} x2={250} y2={rangs[i + 1] - 45} stroke={C.orangeVif} strokeWidth={7} />
            <line x1={700} y1={y + 45} x2={700} y2={rangs[i + 1] - 45} stroke={C.encre} strokeWidth={7} />
          </g>
        ))}
      </svg>
      {carte(375, 320, 200, 90, C.encre, "message", C.encre, C.orangeVif, "m")}
      {carte(355, 470, 240, 90, C.orangeVif, "robot", C.encre, C.orangeVif, "r")}
      {ICONES_A.map((ic, i) => carte(150, rangs[i] - 45, 200, 90, C.orangeVif, ic, ic === "coche" ? C.vert : C.encre, ic === "coche" ? C.blanc : C.orangeVif, `a${i}`))}
      {ICONES_B.map((ic, i) => (i === 2 && alerteGrande ? null : carte(600, rangs[i] - 45, 200, 90, C.encre, ic, C.encre, C.blanc, `b${i}`)))}
    </div>
  );
}
