import React from "react";
/**
 * Axe 3 · Façon de montrer les chiffres (image C). CHI-B Jauge, CHI-C Duel de tailles, CHI-D Chiffre géant, CHI-E En
 * objets. Chiffres EXACTS de l'image C : 80 % / 20 %, 4 s, 24h/24, 0 demande perdue.
 */
import { BandeauChiffres, TemoinSousTitres } from "../socle";
import { a, ANTON, Affiche, Appoint, Bulle, C, CartePleine, Coche, Ecran, Etiquette, INTER, Points, UTILISATEURS } from "./outils";

/* ------------------------------------------------------------------ */
/* Géométrie d'arc (0° = midi, sens des aiguilles)                      */
/* ------------------------------------------------------------------ */
export function pt(cx: number, cy: number, r: number, ang: number): [number, number] {
  const t = ((ang - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
}
export function arc(cx: number, cy: number, r: number, de: number, vers: number) {
  const [x0, y0] = pt(cx, cy, r, de);
  const [x1, y1] = pt(cx, cy, r, vers);
  const grand = vers - de > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${grand} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/* ------------------------------------------------------------------ */
/* CHI-B · Jauge : anneau 80 % orange / 20 % encre                      */
/* ------------------------------------------------------------------ */
type OptJauge = { hauteur?: number; cx: number; cy: number; r: number; ep: number; remplissage: number; vingt: number; legende20: boolean; temoin?: string; etiquetteY: number; taille?: number; appoint?: React.ReactNode; devant?: React.ReactNode };

function Jauge(o: OptJauge) {
  // Le segment encre (20 %) est en bas (144° → 216°) ; l'orange part de 216° et tourne dans le sens horaire (288°).
  const ECART = 4;
  const DEBUT = 216 + ECART;
  const finOrange = DEBUT + (288 - 2 * ECART) * o.remplissage;
  const debut20 = 144 + ECART;
  const fin20 = debut20 + (72 - 2 * ECART) * o.vingt;
  const H = o.hauteur ?? 1920;
  const taille = o.taille ?? 280;
  return (
    <Ecran fond="ivoire" hauteur={H} temoin={o.temoin}>
      <Etiquette t="Résultat" fond="ivoire" y={o.etiquetteY} />
      <svg width={1080} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={o.cx} cy={o.cy} r={o.r} fill="none" stroke={a(C.encre, 0.14)} strokeWidth={o.ep} />
        {o.remplissage > 0 ? <path d={arc(o.cx, o.cy, o.r, DEBUT, finOrange)} fill="none" stroke={C.orange} strokeWidth={o.ep} style={{ filter: `drop-shadow(0 10px 24px ${a(C.orange, 0.12)})` }} /> : null}
        {o.remplissage < 1
          ? // Pointe de l'arc en mouvement : trois liserés de plus en plus pâles devant elle (sens de rotation).
            [0, 1, 2].map((k) => <path key={k} d={arc(o.cx, o.cy, o.r, finOrange + 2 + k * 5, finOrange + 5 + k * 5)} fill="none" stroke={a(C.orange, 0.3 - k * 0.09)} strokeWidth={o.ep} />)
          : null}
        {o.vingt > 0 ? <path d={arc(o.cx, o.cy, o.r, debut20, fin20)} fill="none" stroke={C.encre} strokeWidth={o.ep} /> : null}
      </svg>
      <div style={{ position: "absolute", left: o.cx - o.r, top: o.cy - taille * 0.62, width: 2 * o.r, textAlign: "center" }}>
        <Pourcent n={80} taille={taille} couleur={C.orange} />
        <div style={{ ...INTER, fontSize: 62, color: C.encre, marginTop: 14 }}>résolus</div>
      </div>
      {o.legende20 ? (
        <div style={{ position: "absolute", left: o.cx - 300, width: 600, top: o.cy + o.r + o.ep / 2 + 18, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 26 }}>
          <Pourcent n={20} taille={100} couleur={C.encre} />
          <div style={{ ...INTER, fontSize: 60, color: C.encre }}>l'équipe</div>
        </div>
      ) : null}
      {o.devant}
      {o.appoint ? <Appoint fondu={24}>{o.appoint}</Appoint> : null}
    </Ecran>
  );
}

/* v2 (9:16) : anneau agrandi et descendu vers le milieu (rayon 335, de y = 290 à 1030), 80 % de 300 px ; la voix ne
   répète plus le chiffre. Appoint : CHI-B-1, les demandes qui arrivent (bulles en file) ; CHI-B-2, le reste part
   vers l'équipe (bulle en vol vers la pastille « équipe »). */
const B916 = { cx: 540, cy: 640, r: 320, ep: 70, etiquetteY: 250, taille: 300 };

export const CHI_B_1 = () => (
  <Jauge
    {...B916}
    remplissage={0.62}
    vingt={0}
    legende20={false}
    temoin="Sans un seul humain."
    devant={
      // La demande suivante entre dans l'anneau par le bas (pointillé jusqu'à la piste).
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M540 1030V1000" stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
        </svg>
        <Bulle x={400} y={1036} l={280} h={92} contour={C.encre} ombre={false}>
          <Points taille={16} />
        </Bulle>
      </>
    }
    appoint={
      // v3 : la file des demandes qui arrivent, en bulles pleines et larges (≥ 60 % de la largeur), sans texte.
      <>
        <Bulle x={380} y={1312} l={320} h={124} contour={C.encre} ombre={false}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={60} y={1372} l={300} h={124} contour={C.encre} ombre={false} rotation={-5}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
        <Bulle x={720} y={1384} l={300} h={124} contour={C.encre} ombre={false} rotation={6}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
      </>
    }
  />
);
export const CHI_B_2 = () => (
  <Jauge
    {...B916}
    remplissage={1}
    vingt={1}
    legende20
    temoin="Un humain s'en charge."
    appoint={
      // v3 : les demandes restantes (bulles pleines) partent vers la pastille « équipe », agrandie.
      <>
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M560 1420 C 610 1430, 640 1426, 680 1416" fill="none" stroke={a(C.encre, 0.45)} strokeWidth={7} strokeDasharray="2 16" strokeLinecap="round" />
        </svg>
        <Bulle x={80} y={1318} l={300} h={120} contour={C.encre} ombre={false} rotation={-6}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={300} y={1392} l={260} h={110} contour={C.encre} ombre={false} rotation={5}>
          <Points taille={18} />
        </Bulle>
      </>
    }
    devant={
      // La pastille « équipe » est posée hors du fondu de la zone d'appoint (aplat net, ombre douce de 10 %).
      <Equipe x={700} y={1310} d={224} />
    }
  />
);
/** 4:5 (1080 × 1350) : même anneau, rythme posé ; v2 : anneau resserré pour que « 20 % l'équipe » finisse au-dessus de la bande des sous-titres (y = 1042). */
/* v3 : le témoin des sous-titres à sa vraie place 4:5 (bande 1042 → 1176, témoin réel décalé de −110 px) ; la voix
   dit ce que l'écran ne dit pas. Objet d'appoint : une demande part de l'arc encre vers la pastille « équipe ». */
export const R45_CHI_B_1 = () => (
  <Jauge
    hauteur={1350}
    cx={540}
    cy={540}
    r={320}
    ep={72}
    remplissage={1}
    vingt={1}
    legende20
    etiquetteY={128}
    taille={270}
    devant={
      <>
        <svg width={1080} height={1350} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M730 870 C 790 900, 830 900, 862 896" fill="none" stroke={a(C.encre, 0.3)} strokeWidth={6} strokeDasharray="2 16" strokeLinecap="round" />
        </svg>
        <Bulle x={770} y={812} l={130} h={54} contour={C.encre} ombre={false} rotation={-8}>
          <Points taille={10} />
        </Bulle>
        <Equipe x={858} y={880} d={140} />
        <div style={{ position: "absolute", left: 0, top: 1176 - 1286, width: 1080, height: 1920 }}>
          <TemoinSousTitres texte="Un humain s'en charge." fond="ivoire" />
        </div>
      </>
    }
  />
);

/* ------------------------------------------------------------------ */
/* CHI-C · Duel de tailles : « Le lendemain » rétrécit, « 4 s » grandit  */
/* ------------------------------------------------------------------ */
/** Coins de cadrage : resserrés (rétrécit) ou écartés avec un cran (grandit). */
function Coins({ x, y, l, h, couleur, longueur = 54, ep = 8 }: { x: number; y: number; l: number; h: number; couleur: string; longueur?: number; ep?: number }) {
  const coins: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + l, y, -1, 1],
    [x, y + h, 1, -1],
    [x + l, y + h, -1, -1],
  ];
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {coins.map(([cx, cy, sx, sy], i) => (
        <path key={i} d={`M${cx + sx * longueur} ${cy}H${cx}V${cy + sy * longueur}`} stroke={couleur} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </svg>
  );
}

/** « 4 s » : chiffre et unité Anton, espace fine (le standard compte « 4 s » pour un mot). */
/** Pourcentage : le nombre en grand, le signe « % » plus petit (le nombre reste le point focal). */
export function Pourcent({ n, taille, couleur }: { n: number; taille: number; couleur: string }) {
  return (
    <div style={{ ...ANTON, fontSize: taille, color: couleur, whiteSpace: "nowrap" }}>
      {n}
      <span style={{ fontSize: "0.58em", marginLeft: "0.08em" }}>%</span>
    </div>
  );
}

/** « 4 s » : l'unité suit le chiffre de près (Anton n'a pas d'espace fine). */
function QuatreS({ taille, style }: { taille: number; style?: React.CSSProperties }) {
  return (
    <div style={{ ...ANTON, fontSize: taille, color: C.orange, whiteSpace: "nowrap", textShadow: `0 ${taille / 40}px ${taille / 12}px ${a(C.encre, 0.1)}`, ...style }}>
      4<span style={{ marginLeft: "0.12em" }}>s</span>
    </div>
  );
}

/* v2 : « 4 s » agrandi et descendu (580 px puis 740 px), la voix ne répète plus le chiffre.
   CHI-C-1 appoint : la conversation qui en résulte (message, puis réponse cochée).
   CHI-C-2 appoint : l'attente d'avant, bulle muette barrée (aucun mot dans la zone d'appoint). */
/* v3 : « 4 s » de 640 px descend jusqu'à la bande des sous-titres ; appoint en bulles pleines et larges ; la voix ne
   répète plus « attendre » (déjà dans l'étiquette). */
export const CHI_C_1 = () => (
  <Ecran fond="ivoire" temoin="Maintenant, c'est immédiat.">
    <Etiquette t="Le client attend" fond="ivoire" y={250} />
    {/* « Le lendemain » rétrécit (coins resserrés) ; « 4 s » grandit (coins écartés, orange). */}
    <Affiche t="Le lendemain" taille={130} fond="ivoire" style={{ position: "absolute", left: 96, top: 320 }} />
    <Coins x={74} y={300} l={730} h={168} couleur={a(C.encre, 0.35)} />
    <QuatreS taille={640} style={{ position: "absolute", left: 230, top: 500 }} />
    <Coins x={196} y={516} l={720} h={596} couleur={C.orange} longueur={80} />
    {/* Appoint : la conversation qui en résulte (message du client, puis la réponse cochée), en bulles pleines. */}
    <Appoint fondu={24}>
      <Bulle x={90} y={1312} l={440} h={120} contour={C.encre} ombre={false}>
        <Points taille={20} />
      </Bulle>
      <Bulle x={470} y={1400} l={440} h={120} contour={C.vert} ombre={false}>
        <Points taille={20} couleur={C.gris} />
      </Bulle>
      <Coche x={900} y={1404} r={36} />
    </Appoint>
  </Ecran>
);

export const CHI_C_2 = () => (
  <Ecran fond="ivoire" temoin="Même en pleine nuit.">
    <Etiquette t="Délai de réponse" fond="ivoire" y={290} />
    <QuatreS taille={740} style={{ position: "absolute", left: 76, top: 380 }} />
    {/* Appoint : l'attente d'avant (bulle muette aux trois points), large et pleine, barrée d'un trait encre ; aucun mot. */}
    <Appoint fondu={24}>
      <Bulle x={150} y={1318} l={640} h={170} contour={C.encre} ombre={false} rotation={-3}>
        <Points taille={28} couleur={C.gris} />
      </Bulle>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M110 1470 L 840 1318" stroke={C.encre} strokeWidth={12} strokeLinecap="round" />
      </svg>
    </Appoint>
  </Ecran>
);

/* ------------------------------------------------------------------ */
/* CHI-D · Chiffre géant : « 24h/24 » plein écran, puis rangé            */
/* ------------------------------------------------------------------ */
const CHI_D_HAUT = 272;
/* v2 : « 24h/24 » de 520 px (de y = 263 à 1110), la voix dit ce que le chiffre ne dit pas.
   Appoint : le cadran de 24 heures, entièrement allumé, qui monte du bas (socle du chiffre). */
export const CHI_D_1 = () => (
  <Ecran fond="sombre" temoin="Le week-end aussi.">
    {/* v3 : 470 px, capitales de y ≈ 277 à 1113 (sous la zone cachée de 269 px). Les deux lignes sont posées en entier
        (aucun chiffre à moitié caché) ; le mouvement se lit sur le filet, encore en train de se tracer (point au bout). */}
    <div style={{ position: "absolute", left: 66, top: CHI_D_HAUT, ...ANTON, fontSize: 470, lineHeight: 0.9, color: C.orangeVif, textShadow: `0 0 90px ${a(C.orangeVif, 0.3)}` }}>24h</div>
    <div style={{ position: "absolute", left: 66, top: CHI_D_HAUT + 432, ...ANTON, fontSize: 470, lineHeight: 0.9, color: C.orangeVif }}>/24</div>
    <div style={{ position: "absolute", left: 66, top: 1128, width: 760, height: 6, background: a(C.orangeVif, 0.6), borderRadius: 3 }} />
    <div style={{ position: "absolute", left: 66 + 760 - 9, top: 1122, width: 18, height: 18, borderRadius: "50%", background: C.orangeVif }} />
    {/* v3 : seul l'appoint change : le cadran de 24 h est plus grand et son anneau épais (90 px, plein), il se lit
        comme le socle du chiffre et remplit la zone d'appoint sur toute sa hauteur. */}
    <Appoint fondu={24}>
      <Cadran24 cx={540} cy={1866} r={520} ep={90} />
    </Appoint>
  </Ecran>
);

/** Cadran de 24 heures : anneau orange complet (24h/24), 24 graduations (une plus longue toutes les 6 h). */
function Cadran24({ cx, cy, r, ep = 14 }: { cx: number; cy: number; r: number; ep?: number }) {
  const r0 = r - ep / 2 - 20;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.orangeVif} strokeWidth={ep} />
      {Array.from({ length: 24 }, (_, h) => {
        const [x0, y0] = pt(cx, cy, r0, h * 15);
        const [x1, y1] = pt(cx, cy, r0 - (h % 6 === 0 ? 70 : 36), h * 15);
        return <path key={h} d={`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`} stroke={a(C.ivoire, h % 6 === 0 ? 0.9 : 0.55)} strokeWidth={h % 6 === 0 ? 10 : 7} strokeLinecap="round" />;
      })}
    </svg>
  );
}

export const CHI_D_2 = () => {
  // Le vrai bandeau : la 1re rangée (orange) est réservée à « 24h/24 », qui rapetisse en y allant ; 80 % et 0 claquent dessous.
  const chiffres = [
    { texte: "24h/24", legende: "sans pause", t: 99 },
    { texte: "80 %", legende: "résolus", t: 0 },
    { texte: "0", legende: "demande perdue", t: 0.3 },
  ];
  return (
    <Ecran fond="sombre" temoin="Zéro demande perdue.">
      <BandeauChiffres chiffres={chiffres} t={4} />
      {/* Le chiffre géant finit de rapetisser vers sa rangée : coins de cadrage qui se resserrent sur sa place. */}
      <Coins x={84} y={318} l={760} h={290} couleur={a(C.orangeVif, 0.75)} longueur={58} ep={7} />
      <Affiche t="*24h/24*" taille={250} fond="sombre" style={{ position: "absolute", left: 128, top: 336, textShadow: `0 0 70px ${a(C.orangeVif, 0.35)}` }} />
    </Ecran>
  );
};

/* ------------------------------------------------------------------ */
/* CHI-E · En objets : 10 bulles, 8 se cochent, 2 partent vers l'équipe  */
/* ------------------------------------------------------------------ */
const NON_COCHEES = new Set([3, 8]);

export const CHI_E_1 = () => {
  const l = 310;
  const h = 112;
  const cols = [96, 476];
  return (
    <Ecran fond="ivoire" temoin="80 % résolus.">
      {Array.from({ length: 10 }, (_, i) => {
        const x = cols[i % 2];
        const y = 340 + Math.floor(i / 2) * 156;
        const coche = !NON_COCHEES.has(i) && i <= 6;
        const enCours = i === 6;
        return (
          <React.Fragment key={i}>
            <Bulle x={x} y={y} l={l} h={h} contour={coche ? C.vert : NON_COCHEES.has(i) && i < 6 ? C.encre : undefined}>
              <Points taille={22} couleur={coche ? C.gris : C.encre} />
            </Bulle>
            {coche ? <Coche x={x + l - 8} y={y + 8} r={34} echelle={enCours ? 1.22 : 1} /> : null}
          </React.Fragment>
        );
      })}
    </Ecran>
  );
};

/** Pastille « équipe » : disque encre, icône réelle « utilisateurs ». */
function Equipe({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 36px ${a(C.encre, 0.1)}` }}>
      <svg width={d * 0.55} height={d * 0.55} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {UTILISATEURS.map((p) => (
          <path key={p} d={p} />
        ))}
        <circle cx="9" cy="7" r="4" />
      </svg>
    </div>
  );
}

/* v3 : 80 % (320 px), grille 4 × 2 de bulles cochées agrandie, 20 % et les deux bulles « pour l'équipe » en vol jusqu'aux
   sous-titres ; la voix ne répète plus le chiffre. Appoint : la carte de l'équipe, pleine et large, où les deux
   bulles arrivent (aucun mot). */
export const CHI_E_2 = () => {
  const l = 206;
  const h = 96;
  const cochees = Array.from({ length: 8 }, (_, i) => ({ x: 74 + (i % 4) * 236, y: 624 + Math.floor(i / 4) * 150 }));
  return (
    <Ecran fond="ivoire" temoin="L'équipe garde la main.">
      <div style={{ position: "absolute", left: 72, top: 280 }}>
        <Pourcent n={80} taille={320} couleur={C.orange} />
      </div>
      {cochees.map((p, i) => (
        <React.Fragment key={i}>
          <Bulle x={p.x} y={p.y} l={l} h={h} contour={C.vert} ombre={false}>
            <Points taille={17} couleur={C.gris} />
          </Bulle>
          <Coche x={p.x + l - 6} y={p.y + 6} r={28} />
        </React.Fragment>
      ))}
      <div style={{ position: "absolute", left: 72, top: 930 }}>
        <Pourcent n={20} taille={160} couleur={C.encre} />
      </div>
      {/* Les deux bulles « pour l'équipe » quittent la grille, en vol vers la carte de l'équipe (en bas). */}
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M900 1060 C 930 1080, 950 1100, 960 1136" fill="none" stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 18" strokeLinecap="round" />
      </svg>
      <Bulle x={392} y={956} l={l + 20} h={h + 8} contour={C.encre} rotation={-6}>
        <Points taille={17} />
      </Bulle>
      <Bulle x={660} y={1002} l={l + 20} h={h + 8} contour={C.encre} rotation={8}>
        <Points taille={17} />
      </Bulle>
      <Appoint fondu={24}>
        <CartePleine x={130} y={1316} l={820} h={214} fond="ivoire" icone="utilisateurs">
          <div style={{ position: "relative", width: 520, height: 140 }}>
            <Bulle x={0} y={22} l={230} h={86} contour={C.encre} ombre={false} rotation={-3}>
              <Points taille={16} />
            </Bulle>
            <Bulle x={262} y={22} l={230} h={86} contour={C.encre} ombre={false} rotation={3}>
              <Points taille={16} />
            </Bulle>
          </div>
        </CartePleine>
      </Appoint>
    </Ecran>
  );
};

/** 4:5 (1080 × 1350) : le chiffre géant, posé, avec sa légende ; texte entre y = 54 et 1188. */
export const R45_CHI_D_1 = () => (
  <Ecran fond="sombre" hauteur={1350}>
    <div style={{ position: "absolute", left: 66, top: 150, ...ANTON, fontSize: 440, lineHeight: 0.9, color: C.orangeVif, textShadow: `0 0 90px ${a(C.orangeVif, 0.3)}` }}>24h</div>
    <div style={{ position: "absolute", left: 50, top: 548, width: 900, height: 380, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 16, top: 50, ...ANTON, fontSize: 440, lineHeight: 0.9, color: C.orangeVif }}>/24</div>
    </div>
    <div style={{ position: "absolute", left: 66, top: 934, width: 900, height: 6, background: a(C.orangeVif, 0.6), borderRadius: 3 }} />
    <div style={{ position: "absolute", left: 72, top: 990, ...INTER, fontSize: 72, color: C.ivoire }}>sans pause</div>
  </Ecran>
);
