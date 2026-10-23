import React from "react";
/**
 * AXE 4 · CAMÉRA (image C, chatbot). CAM-A = la vraie scène (SceneGalerieImageVideo) ; CAM-B à CAM-E = maquettes.
 * v2 (§ 2 bis) : chaque écran occupe la hauteur utile (y 230 → 1140), la suite du schéma descend dans la zone
 * d'appoint (y 1300 → 1536), rien ne traverse la bande des sous-titres (1152 → 1286).
 */
import { C, Carte, Coche, Ecran, Fil, Jeton, Part, Svg, Texte, enS, teinte, ANTON } from "./kit";

/* ------------------------------------------------------------------ */
/* CAM-B · Vue d'ensemble d'abord (nuit) : schéma en silhouette, puis plongée sur « Chatbot IA ». */
/* ------------------------------------------------------------------ */

/** Centre de la carte « Chatbot IA » dans la vue d'ensemble (CAM-B-1). */
const CB = { x: 540, y: 590 };
/**
 * v3 : colonnes des deux branches (centres g, d ; largeur l) et rangs des étapes. Les étapes sont des SILHOUETTES
 * PLEINES (gris de la charte, opaques) avec une barre de texte illisible de loin : la vue d'ensemble se lit comme un
 * vrai schéma vu de loin, plus comme des contours sombres invisibles. Colonnes choisies pour qu'au zoom ×1,4 de
 * CAM-B-2 chaque carte reste entière (x 60 → 1020).
 */
const SIL = { g: 347, d: 733, l: 300, h: 100, rangs: [800, 920, 1040, 1312, 1428] };
/** Rangs vus par la caméra de CAM-B-2 (en pixels du schéma) : 880, 1040, 1316, 1478 à l'écran une fois zoomé. */
const RANGS_ZOOM = [761, 876, 1073, 1189];

/** Une étape vue de loin : silhouette pleine, une barre à la place du texte (illisible à cette distance). */
function EtapeLoin({ x, y, l, h }: { x: number; y: number; l: number; h: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, borderRadius: 30, background: C.gris }}>
      <div style={{ position: "absolute", left: 40, top: h / 2 - 11, width: l * 0.56, height: 22, borderRadius: 11, background: teinte(C.nuit, 0.32) }} />
    </div>
  );
}

/** Le schéma entier, en silhouettes pleines, posé autour de la carte « Chatbot IA » (seule allumée). */
function SchemaSilhouette({ libelle = true, rangs = SIL.rangs }: { libelle?: boolean; rangs?: number[] }) {
  const fil = teinte(C.grisClair, 0.45);
  const { g, d, l, h } = SIL;
  const yb = CB.y + 100;
  return (
    <>
      <Svg>
        <path d={`M 540 420 L 540 ${CB.y - 100}`} stroke={fil} strokeWidth={9} strokeLinecap="round" />
        <path d={enS(540, yb, g, rangs[0])} stroke={fil} strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d={enS(540, yb, d, rangs[0])} stroke={fil} strokeWidth={9} fill="none" strokeLinecap="round" />
        {rangs.slice(0, -1).map((y, i) => {
          // Aucun fil ne traverse la bande des sous-titres : il s'arrête avant, reprend dessous.
          const saute = y + h < 1152 && rangs[i + 1] > 1286;
          const seg = (x: number) =>
            saute ? `M ${x} ${y + h} L ${x} ${Math.min(1144, y + h + 4)} M ${x} 1296 L ${x} ${rangs[i + 1]}` : `M ${x} ${y + h} L ${x} ${rangs[i + 1]}`;
          return (
            <React.Fragment key={y}>
              <path d={seg(g)} stroke={fil} strokeWidth={9} strokeLinecap="round" />
              <path d={seg(d)} stroke={fil} strokeWidth={9} strokeLinecap="round" />
            </React.Fragment>
          );
        })}
      </Svg>
      <EtapeLoin x={380} y={300} l={320} h={120} />
      {rangs.map((y) => (
        <React.Fragment key={y}>
          <EtapeLoin x={g - l / 2} y={y} l={l} h={h} />
          <EtapeLoin x={d - l / 2} y={y} l={l} h={h} />
        </React.Fragment>
      ))}
      {/* La seule carte allumée : là où la caméra va plonger. */}
      <Carte x={CB.x - 260} y={CB.y - 100} l={520} h={200} libelle={libelle ? "Chatbot IA" : undefined} taille={100} icone="robot" couleur="orange" etat="actif" ombre={`0 0 120px 30px ${teinte(C.nuitLueur, 0.9)}, 0 20px 50px ${teinte(C.nuit, 0.5)}`} />
    </>
  );
}

/** Viseur : 4 coins en L autour d'un cadre (x, y, l, h). */
function Viseur({ x, y, l, h, couleur, k = 64, e = 8 }: { x: number; y: number; l: number; h: number; couleur: string; k?: number; e?: number }) {
  const coins = [
    `M ${x} ${y + k} L ${x} ${y} L ${x + k} ${y}`,
    `M ${x + l - k} ${y} L ${x + l} ${y} L ${x + l} ${y + k}`,
    `M ${x + l} ${y + h - k} L ${x + l} ${y + h} L ${x + l - k} ${y + h}`,
    `M ${x + k} ${y + h} L ${x} ${y + h} L ${x} ${y + h - k}`,
  ];
  return (
    <Svg>
      {coins.map((d) => (
        <path key={d} d={d} stroke={couleur} strokeWidth={e} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

export function CamB1() {
  const v = { x: 220, y: CB.y - 150, l: 640, h: 300 };
  return (
    <Ecran fond="sombre" sousTitre="Une situation type.">
      <SchemaSilhouette />
      <Viseur x={v.x} y={v.y} l={v.l} h={v.h} couleur={C.ivoire} />
      {/* Flèches fantômes : le viseur va s'ouvrir (la caméra plonge). */}
      <Svg>
        {[
          [v.x, v.y, -1, -1],
          [v.x + v.l, v.y, 1, -1],
          [v.x + v.l, v.y + v.h, 1, 1],
          [v.x, v.y + v.h, -1, 1],
        ].map(([x, y, sx, sy]) => (
          <path key={`${x}-${y}`} d={`M ${x + sx * 26} ${y + sy * 26} L ${x + sx * 70} ${y + sy * 70} M ${x + sx * 70} ${y + sy * 40} L ${x + sx * 70} ${y + sy * 70} L ${x + sx * 40} ${y + sy * 70}`} stroke={teinte(C.ivoire, 0.45)} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    </Ecran>
  );
}

/** Le décor zoomé s'efface avant la bande des sous-titres, reprend dessous (zone d'appoint), s'arrête à y = 1536. */
const MASQUE = "linear-gradient(to bottom, #000 0, #000 1128px, transparent 1146px, transparent 1292px, #000 1304px, #000 1500px, transparent 1536px)";

export function CamB2() {
  // Même schéma, caméra à ×1,4 sur la carte « Chatbot IA » (540, 570) ramenée en (540, 640) : la carte ET sa pastille
  // restent entières (pastille à x ≈ 89), les silhouettes des branches aussi (x 64 → 1016).
  const z = 1.4;
  const cy = 640;
  const dx = 540 - CB.x * z;
  const dy = cy - CB.y * z;
  return (
    <Ecran fond="sombre" sousTitre="Il lit la *question.*">
      <div style={{ position: "absolute", inset: 0, maskImage: MASQUE, WebkitMaskImage: MASQUE }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `translate(${dx}px, ${dy}px) scale(${z})`, transformOrigin: "0 0" }}>
          <SchemaSilhouette libelle={false} rangs={RANGS_ZOOM} />
        </div>
      </div>
      {/* Le libellé est posé à sa taille d'écran (net, jamais agrandi en flou), décalé de la pastille. */}
      <Texte x={562} y={cy - 68} taille={126} centre largeur={700}>
        Chatbot IA
      </Texte>
      <Viseur x={76} y={cy - 202} l={928} h={404} couleur={C.ivoire} k={90} />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* CAM-C · Le voyage du message (ivoire) : un point lumineux sur le fil, la caméra le suit. */
/* ------------------------------------------------------------------ */

/** Le message : point orange qui brille (lueur orangée de la charte), cœur blanc. */
export function PointMessage({ x, y, r = 42 }: { x: number; y: number; r?: number }) {
  const k = r / 42;
  return (
    <>
      <div style={{ position: "absolute", left: x - 190 * k, top: y - 190 * k, width: 380 * k, height: 380 * k, borderRadius: "50%", background: `radial-gradient(circle, ${teinte(C.orangeVif, 0.55)} 0%, ${teinte(C.orangeVif, 0.18)} 38%, ${teinte(C.orangeVif, 0)} 70%)` }} />
      <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.orangeVif, boxShadow: `0 0 0 ${10 * k}px ${teinte(C.blanc, 0.9)}, 0 8px 24px ${teinte(C.encre, 0.12)}` }} />
      <div style={{ position: "absolute", left: x - 16 * k, top: y - 16 * k, width: 32 * k, height: 32 * k, borderRadius: "50%", background: C.blanc }} />
    </>
  );
}

/** Positions précédentes du point (pelures d'oignon) le long d'un chemin vertical. */
export function Traces({ pts, r = 22 }: { pts: [number, number, number][]; r?: number }) {
  return (
    <>
      {pts.map(([x, y, o], i) => (
        <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: teinte(C.orangeVif, o) }} />
      ))}
    </>
  );
}

/** Fil d'appoint : reprend sous la bande des sous-titres en s'allumant (fondu depuis y0). */
function FilAppoint({ x, y0, y1, couleur, id }: { x: number; y0: number; y1: number; couleur: string; id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={couleur} stopOpacity={0} />
          <stop offset="1" stopColor={couleur} stopOpacity={1} />
        </linearGradient>
      </defs>
      <rect x={x - 4.5} y={y0} width={9} height={y1 - y0} rx={4.5} fill={`url(#${id})`} />
    </>
  );
}

export function CamC1() {
  const fx = 540;
  const fy = 650;
  const g = 270;
  const d = 760;
  const bout = 975;
  return (
    <Ecran fond="ivoire" sousTitre="Il trie chaque demande.">
      <Svg>
        {/* Tronc : gris, puis la traînée orange juste derrière le point. */}
        <Fil d={`M ${fx} 480 L ${fx} ${fy}`} couleur={C.grisClair} pointe={false} />
        <defs>
          <linearGradient id="trainee" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.orangeVif} stopOpacity={0} />
            <stop offset="1" stopColor={C.orangeVif} stopOpacity={1} />
          </linearGradient>
        </defs>
        <rect x={fx - 4.5} y={fy - 170} width={9} height={170} fill="url(#trainee)" />
        {/* Les deux branches devant le point : 80 % à gauche (orange), 20 % à droite (encre). */}
        <Fil d={`M ${fx} ${fy} C ${fx} ${fy + 170}, ${g} ${fy + 150}, ${g} ${bout}`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M ${fx} ${fy} C ${fx} ${fy + 170}, ${d} ${fy + 150}, ${d} ${bout}`} couleur={C.encre} pointe={false} />
        {/* Zone d'appoint : chaque branche continue vers sa prochaine étape. */}
        <Fil d={`M ${g} 1296 L ${g} 1322`} couleur={C.orangeVif} pointe={false} />
        <Fil d={`M ${d} 1296 L ${d} 1322`} couleur={C.encre} pointe={false} />
      </Svg>
      <Carte x={230} y={290} l={620} h={190} libelle="Chatbot IA" taille={100} icone="robot" couleur="orange" etat="pose" />
      <Traces pts={[[fx, fy - 136, 0.26], [fx, fy - 100, 0.36], [fx, fy - 66, 0.48]]} r={24} />
      <PointMessage x={fx} y={fy} r={48} />
      {/* v3 : parts remontées de 20 px (le trou sous le point passe sous 15 %). */}
      <Part x={g} y={1022} texte="80 %" couleur="orange" taille={110} />
      <Part x={d} y={1022} texte="20 %" couleur="noir" taille={96} />
      {/* v3 : zone d'appoint en vraies cartes pleines (les étapes suivantes de chaque branche, sans texte). */}
      <Carte x={g - 120} y={1322} l={370} h={186} icone="etincelles" couleur="orange" etat="pose" />
      <Carte x={d - 170} y={1322} l={370} h={186} icone="mail" etat="pose" />
    </Ecran>
  );
}

export function CamC2() {
  // La caméra a suivi le point dans la branche 80 % : il file vers « Envoyée en 4 s ».
  const d = enS(300, 480, 640, 720);
  return (
    <Ecran fond="ivoire" sousTitre="Le client est déjà *servi.*">
      <Svg>
        <Fil d={d} couleur={C.orangeVif} pointe={false} />
        
        <FilAppoint x={500} y0={1296} y1={1346} couleur={C.grisClair} id="appointC2" />
      </Svg>
      <Carte x={130} y={270} l={720} h={210} libelle="Réponse générée" taille={88} icone="etincelles" couleur="orange" etat="pose" />
      {/* Trace de trajectoire : les positions d'avant du message, de plus en plus nettes. */}
      <Traces pts={[[309, 513, 0.24], [335, 540, 0.32], [373, 562, 0.4], [420, 582, 0.5]]} r={26} />
      <PointMessage x={470} y={600} r={50} />
      <Carte x={130} y={720} l={760} h={390} libelle={"Envoyée\nen 4 s"} taille={130} icone="eclair" couleur="orange" etat="actif" />
      {/* Zone d'appoint : l'étape suivante attend, pâle (sans texte). */}
      <Carte x={200} y={1346} l={600} h={150} icone="document" etat="attente" />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* CAM-D · Plan fixe qui se construit (ivoire) : tout le schéma dans le cadre, à moitié construit. */
/* ------------------------------------------------------------------ */

/** Place réservée : contour en tirets (l'étape à venir), sans texte. */
function Place({ x, y, l, h, icone }: { x: number; y: number; l: number; h: number; icone?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 34, border: `4px dashed ${C.grisClair}`, boxSizing: "border-box" }} />
      {icone ? <Jeton x={0} y={h / 2} r={34} icone={icone} etat="pale" /> : null}
    </div>
  );
}

/** Repères de cadre fixe (trépied) : petits coins gris aux bords du plan. */
function ReperesFixes() {
  const k = 40;
  const pts: [number, number, number, number][] = [
    [24, 284, 1, 1],
    [1056, 284, -1, 1],
    [24, 1112, 1, -1],
    [1056, 1112, -1, -1],
  ];
  return (
    <Svg>
      {pts.map(([x, y, sx, sy]) => (
        <path key={`${x}${y}`} d={`M ${x} ${y + sy * k} L ${x} ${y} L ${x + sx * k} ${y}`} stroke={C.gris} strokeWidth={4} fill="none" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

const D = { gx: 130, gl: 590, dx: 770, dl: 250, rangs: [650, 762, 874, 986], h: 96 };

function PlanFixe({ etape, zoom80 = false }: { etape: 1 | 2; zoom80?: boolean }) {
  const cg = D.gx + D.gl / 2;
  const cd = D.dx + D.dl / 2;
  const gauche = [
    { libelle: "Réponse générée", icone: "etincelles" },
    { libelle: "Envoyée en 4 s", icone: "eclair" },
    { libelle: "Ticket clôturé", icone: "document" },
    { libelle: "Résolu sans humain", icone: "coche" },
  ];
  const faits = etape === 1 ? 3 : 4;
  const xc = 500 + 386 / 2;
  return (
    <>
      <Svg>
        <Fil d="M 430 360 L 486 360" couleur={C.orangeVif} bout={[486, 360]} angle={0} />
        <Fil d={enS(xc, 420, cg, D.rangs[0])} couleur={C.orangeVif} pointe={false} />
        <Fil d={enS(xc, 420, cd, D.rangs[0])} couleur={C.grisClair} pointe={false} tirets="2 22" />
        {D.rangs.slice(0, -1).map((y, i) => (
          <React.Fragment key={y}>
            {i < faits - 1 ? <Fil d={`M ${cg} ${y + D.h} L ${cg} ${y + 112}`} couleur={C.orangeVif} pointe={false} /> : null}
            <Fil d={`M ${cd} ${y + D.h} L ${cd} ${y + 112}`} couleur={C.grisClair} pointe={false} tirets="2 18" />
          </React.Fragment>
        ))}
      </Svg>
      <Carte x={130} y={300} l={300} h={120} libelle="23h14" icone="message" taille={72} etat="pose" />
      <Carte x={500} y={300} l={386} h={120} libelle="Chatbot IA" icone="robot" taille={62} couleur="orange" etat="pose" />
      {gauche.map((g, i) =>
        i < faits ? (
          <Carte
            key={g.libelle}
            x={D.gx}
            y={D.rangs[i]}
            l={D.gl}
            h={D.h}
            libelle={g.libelle}
            icone={g.icone}
            taille={58}
            couleur={i === 3 ? "vert" : "orange"}
            etat={i === faits - 1 && !zoom80 ? "actif" : "pose"}
            coche={i === 3 ? 1 : 0}
          />
        ) : (
          <Place key={g.libelle} x={D.gx} y={D.rangs[i]} l={D.gl} h={D.h} icone={g.icone} />
        ),
      )}
      {["mail", "utilisateurs", "cloche", "utilisateur"].map((ic, i) => (
        <Place key={ic} x={D.dx} y={D.rangs[i]} l={D.dl} h={D.h} icone={ic} />
      ))}
      <Part x={zoom80 ? cg - 10 : cg - 20} y={540} texte="80 %" couleur="orange" taille={zoom80 ? 150 : 96} />
      <Part x={770} y={540} texte="20 %" couleur="noir" taille={96} />
      <ReperesFixes />
    </>
  );
}

export function CamD1() {
  return (
    <Ecran fond="ivoire" sousTitre="Le ticket se ferme tout seul.">
      <PlanFixe etape={1} />
    </Ecran>
  );
}

export function CamD2() {
  return (
    <Ecran fond="ivoire" sousTitre="Personne n'a bougé.">
      <PlanFixe etape={2} zoom80 />
    </Ecran>
  );
}

/* ------------------------------------------------------------------ */
/* CAM-E · Côte à côte : la branche 80 % à gauche, la 20 % à droite, qui avancent ensemble. */
/* ------------------------------------------------------------------ */

function Panneaux({ etape }: { etape: 1 | 4 }) {
  const haut = 290;
  const bas = 1140;
  const icG = ["etincelles", "eclair", "document", "coche"];
  const icD = ["mail", "utilisateurs", "cloche", "utilisateur"];
  // v3 : la colonne gauche est centrée dans la partie VISIBLE du panneau orange (x 0 → 467) : « 80 % » à 75 px de
  // chaque bord, carte à 65 px ; « 20 % » à la même taille (140 px) pour garder un seul niveau de chiffre.
  const cG = 233.5;
  const cD = 698;
  const lG = 336;
  const yCarte = 580;
  const hCarte = 460;
  // Socles sous la bande des sous-titres : les deux pistes d'étapes (zone d'appoint).
  const sHaut = 1300;
  const sBas = 1530;
  const yPiste = (sHaut + sBas) / 2;
  const pas = 88;
  const x0G = cG - 1.5 * pas;
  const x0D = cD - 1.5 * pas;
  return (
    <>
      <div style={{ position: "absolute", left: -40, top: haut, width: 507, height: bas - haut, borderRadius: 34, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 483, top: haut, width: 640, height: bas - haut, borderRadius: 34, background: C.encre }} />
      <div style={{ position: "absolute", left: -40, top: sHaut, width: 507, height: sBas - sHaut, borderRadius: 34, background: C.orangeVif }} />
      <div style={{ position: "absolute", left: 483, top: sHaut, width: 640, height: sBas - sHaut, borderRadius: 34, background: C.encre }} />
      <Texte x={cG} y={363} taille={140} centre largeur={440} couleur={C.encre}>
        80 %
      </Texte>
      <Texte x={cD} y={363} taille={140} centre largeur={440} couleur={C.ivoire}>
        20 %
      </Texte>
      {etape === 1 ? (
        <>
          <Carte x={cG - lG / 2} y={yCarte} l={lG} h={hCarte} libelle="Réponse générée" taille={76} couleur="orange" etat="pose" />
          <Carte x={cD - 165} y={yCarte} l={350} h={hCarte} libelle="Email structuré" taille={76} etat="pose" />
        </>
      ) : (
        <>
          <Carte x={cG - lG / 2} y={yCarte} l={lG} h={hCarte} libelle="Résolu sans humain" taille={76} couleur="vert" etat="pose" coche={1} />
          <Carte x={cD - 165} y={yCarte} l={350} h={hCarte} libelle="Client informé" taille={76} etat="pose" />
        </>
      )}
      {/* Les 4 étapes de chaque branche : la même étape s'allume des deux côtés, en même temps. */}
      <Svg>
        <path d={`M ${x0G} ${yPiste} L ${x0G + 3 * pas} ${yPiste}`} stroke={teinte(C.encre, 0.25)} strokeWidth={7} strokeLinecap="round" />
        <path d={`M ${x0D} ${yPiste} L ${x0D + 3 * pas} ${yPiste}`} stroke={teinte(C.ivoire, 0.2)} strokeWidth={7} strokeLinecap="round" />
        <path d={`M ${x0G} ${yPiste} L ${x0G + pas * (etape - 1)} ${yPiste}`} stroke={C.encre} strokeWidth={7} strokeLinecap="round" />
        <path d={`M ${x0D} ${yPiste} L ${x0D + pas * (etape - 1)} ${yPiste}`} stroke={C.ivoire} strokeWidth={7} strokeLinecap="round" />
      </Svg>
      {icG.map((ic, i) => (
        <Jeton key={ic} x={x0G + i * pas} y={yPiste} r={36} icone={ic} couleur={i === 3 && i < etape ? "vert" : "noir"} etat={i < etape ? "plein" : "pale"} />
      ))}
      {icD.map((ic, i) => (
        <Jeton key={ic} x={x0D + i * pas} y={yPiste} r={36} icone={ic} etat={i < etape ? "plein" : "sombre"} couleur="noir" />
      ))}
    </>
  );
}

export function CamE1() {
  return (
    <Ecran fond="ivoire" sousTitre="Chaque cas, sa *voie.*">
      <Panneaux etape={1} />
    </Ecran>
  );
}

export function CamE2() {
  return (
    <Ecran fond="ivoire" sousTitre="Fini des deux *côtés.*">
      <Panneaux etape={4} />
    </Ecran>
  );
}

void Coche;
void ANTON;
void Part;
