import React from "react";
/**
 * CHI-C · Duel de tailles (maquettes CHI-C-1, CHI-C-2) : l'ANCIENNE valeur d'un avant / après (paraît sur son mot,
 * ou déjà là si elle a été dite avant) rétrécit et se raye quand la nouvelle est dite ; la nouvelle grandit jusqu'à
 * envahir l'écran, cadrée de coins orange. Seule l'ancienne valeur du même indicateur est barrée (le moteur ne
 * fabrique un duel que pour elle). Appoint : le message, puis la réponse cochée.
 */
import type { DonneesEcranChiffresRendu } from "./donnees";
import { a, ANTON, Appoint, Bulle, C, c01, chasseAnton, Coche, doux, encre, INTER, Points, progres, tailleAnton, type CadreChiffres } from "./outils";

function Coins({ x, y, l, h, couleur, longueur = 54, ep = 8, hauteur }: { x: number; y: number; l: number; h: number; couleur: string; longueur?: number; ep?: number; hauteur: number }) {
  const coins: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + l, y, -1, 1],
    [x, y + h, 1, -1],
    [x + l, y + h, -1, -1],
  ];
  return (
    <svg width={1080} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {coins.map(([cx, cy, sx, sy], i) => (
        <path key={i} d={`M${cx + sx * longueur} ${cy}H${cx}V${cy + sy * longueur}`} stroke={couleur} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </svg>
  );
}

const largeurAnton = (texte: string, taille: number) => chasseAnton(texte) * taille;

/** Zone et taille finale du chiffre qui grandit (≤ 640 px, tient dans 860 px de large). */
export function planDuel(d: DonneesEcranChiffresRendu, cadre: CadreChiffres) {
  const focal = d.chiffres[d.focal];
  const avecLegende = !!focal.legende;
  const zoneHaut = 520 + cadre.haut - 300;
  const zoneBas = cadre.bas - (avecLegende ? 110 : 0);
  return { zoneHaut, zoneBas, avecLegende, finale: Math.min(tailleAnton(focal.texte, 860, 640), (zoneBas - zoneHaut) * 0.95) };
}

/** « 23 min » → « 23 » / « min » (le nombre en grand, l'unité dessous) ; un seul mot reste sur une ligne. */
const enPave = (texte: string) => {
  const m = /^(\S+)\s+(.+)$/.exec(texte.trim());
  return m ? [m[1], m[2]] : [texte.trim()];
};

/** Un chiffre en pavé (nombre, puis unité), centré, dans la boîte (largeur 860) ; tailles proportionnées à `hauteur`. */
function Pave({ texte, y, hauteur, couleur, ombre }: { texte: string; y: number; hauteur: number; couleur: string; ombre?: boolean }) {
  const lignes = enPave(texte);
  // Le nombre prend ~60 % de la hauteur, l'unité le reste ; chacun tient dans 860 px.
  const tailles = lignes.length === 2 ? [tailleAnton(lignes[0], 860, hauteur * 0.6), tailleAnton(lignes[1], 860, hauteur * 0.4)] : [tailleAnton(lignes[0], 860, hauteur)];
  const total = tailles.reduce((x, u) => x + u, 0);
  // Haut de chaque ligne : les lignes s'empilent, le bloc est centré dans la boîte.
  const hauts = tailles.map((_, i) => y + (hauteur - total) / 2 + tailles.slice(0, i).reduce((x, u) => x + u, 0));
  return (
    <>
      {lignes.map((l, i) => {
        const top = hauts[i];
        return (
          <div key={i} style={{ position: "absolute", left: 0, width: 1080, top, height: tailles[i], display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ ...ANTON, fontSize: tailles[i], lineHeight: 1, color: couleur, whiteSpace: "nowrap", textShadow: ombre ? `0 ${tailles[i] / 40}px ${tailles[i] / 12}px ${a(C.encre, 0.1)}` : undefined }}>{l}</div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Duel d'un écran avant / après (l'ancienne valeur a son mot dans l'écran) : l'ancienne paraît sur son mot en pavé qui
 * remplit l'écran ; quand la nouvelle est dite, l'ancienne remonte en petit et se barre, la nouvelle prend sa place en
 * orange, sur une carte blanche cadrée de coins.
 */
function DuelAvantApres({ d, t, t0, cadre }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres }) {
  const ancien = d.duel!.ancien;
  const focal = d.chiffres[d.focal];
  const h = cadre.bas - cadre.haut;
  const apparait = c01(progres(t, ancien.t ?? d.debut, 0.25) * 2);
  // 0 → 1 quand la nouvelle est dite : l'ancienne passe de pavé à ligne barrée en haut.
  const k = doux(progres(t, t0 - 0.05, 0.3));
  const raye = doux(progres(t, t0 + 0.12, 0.25));
  const tailleHaut = Math.min(150, 880 / chasseAnton(ancien.texte));
  const lHaut = largeurAnton(ancien.texte, tailleHaut);
  const legendeA = ancien.legende && 1 - k > 0;
  const hPave = h - (ancien.legende ? 110 : 0);
  // La nouvelle : sous la ligne barrée, au-dessus de sa légende.
  const yN = cadre.haut + tailleHaut + 80;
  const hN = cadre.bas - yN - (focal.legende ? 110 : 20);
  const g = 0.6 + 0.4 * (1 - Math.pow(1 - progres(t, t0, 0.45), 3));
  const encreF = encre(d.fond);
  return (
    <>
      <div style={{ opacity: apparait * (1 - k) }}>
        <Pave texte={ancien.texte} y={cadre.haut} hauteur={hPave} couleur={encreF} />
        {legendeA ? <div style={{ position: "absolute", left: 60, width: 960, top: cadre.haut + hPave + 24, textAlign: "center", ...INTER, fontSize: 62, color: encreF }}>{ancien.legende}</div> : null}
      </div>
      <div style={{ opacity: k }}>
        <div style={{ position: "absolute", left: 96, top: cadre.haut + 10, ...ANTON, fontSize: tailleHaut, lineHeight: 1, color: encreF, whiteSpace: "nowrap" }}>{ancien.texte}</div>
        <Coins x={74} y={cadre.haut - 10} l={lHaut + 44} h={tailleHaut + 40} couleur={a(encreF, 0.35)} hauteur={cadre.hauteur} />
        {raye > 0 ? <div style={{ position: "absolute", left: 86, top: cadre.haut + 10 + tailleHaut * 0.5, width: (lHaut + 20) * raye, height: 12, borderRadius: 6, background: encreF }} /> : null}
      </div>
      {t >= t0 - 0.05 ? (
        <div style={{ transform: `scale(${g})`, transformOrigin: `540px ${yN + hN / 2}px`, opacity: k }}>
          {/* La nouvelle valeur sur une carte blanche de la charte (toute la largeur utile), sa légende dedans. */}
          <div style={{ position: "absolute", left: 90, width: 900, top: yN - 16, height: cadre.bas - yN + 16, borderRadius: 44, background: C.blanc, boxShadow: `0 18px 50px ${a(C.encre, 0.12)}` }} />
          <Pave texte={focal.texte} y={yN} hauteur={hN} couleur={C.orange} ombre />
        </div>
      ) : null}
      <Coins x={66} y={yN - 40} l={948} h={cadre.bas - yN + 64} couleur={a(C.orange, doux(progres(t, t0 + 0.2, 0.3)))} longueur={80} hauteur={cadre.hauteur} />
      {focal.legende ? <div style={{ position: "absolute", left: 60, width: 960, top: cadre.bas - 96, textAlign: "center", ...INTER, fontSize: 62, color: encreF, opacity: doux(progres(t, t0 + 0.15, 0.3)) }}>{focal.legende}</div> : null}
    </>
  );
}

export function Duel({ d, t, t0, cadre, discret = 0, echelle = 1 }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres; discret?: number; echelle?: number }) {
  if (d.duel?.ancien.t !== undefined) return <DuelAvantApres d={d} t={t} t0={t0} cadre={cadre} />;
  const autre = d.duel?.ancien;
  const focal = d.chiffres[d.focal];
  const dy = cadre.haut - 300;
  // L'ancienne : paraît sur son mot (200 px), rétrécit à 130 px quand la nouvelle est dite, puis un trait la raye.
  const r = doux(progres(t, t0, 0.4));
  // Variante rangée (`echelle` < 1) : l'autre garde sa taille à l'écran (130 px, chiffre-clé ≥ 96).
  const tailleAutre = Math.min((200 - 70 * r) / echelle, autre ? 880 / chasseAnton(autre.texte) : 200);
  // Barrée dès que la nouvelle est dite (l'écran avant / après peut ne durer que 0,7 s après elle).
  const raye = doux(progres(t, t0 + 0.12, 0.25));
  const lAutre = autre ? Math.min(900, largeurAnton(autre.texte, tailleAutre)) : 0;
  // Le focal : grandit jusqu'à sa taille finale (≤ 640 px, tient dans 860 px de large).
  const { zoneHaut, zoneBas, finale, avecLegende } = planDuel(d, cadre);
  const g = 0.35 + 0.65 * (1 - Math.pow(1 - progres(t, t0, 0.55), 3));
  const taille = finale * g;
  const lFocal = Math.min(940, largeurAnton(focal.texte, finale));
  const yFocal = zoneHaut + (zoneBas - zoneHaut - finale) / 2;
  const x0 = (1080 - lFocal) / 2;
  return (
    <>
      {autre ? (
        <div style={{ opacity: autre.t === undefined ? 1 : c01(progres(t, autre.t, 0.25) * 2) }}>
          <div style={{ position: "absolute", left: 96, top: 320 + dy, ...ANTON, fontSize: tailleAutre, color: encre(d.fond), whiteSpace: "nowrap" }}>{autre.texte}</div>
          <Coins x={74} y={300 + dy} l={lAutre + 44} h={tailleAutre + 38} couleur={a(encre(d.fond), 0.35)} hauteur={cadre.hauteur} />
          {raye > 0 ? <div style={{ position: "absolute", left: 86, top: 320 + dy + tailleAutre * 0.52, width: (lAutre + 20) * raye, height: 12, borderRadius: 6, background: encre(d.fond) }} /> : null}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 0, width: 1080, top: yFocal + (finale - taille) / 2, display: "flex", justifyContent: "center", opacity: t >= t0 - 0.05 ? 1 : 0 }}>
        <div style={{ ...ANTON, fontSize: taille, color: C.orange, whiteSpace: "nowrap", textShadow: `0 ${taille / 40}px ${taille / 12}px ${a(C.encre, 0.1)}` }}>{focal.texte}</div>
      </div>
      <Coins x={x0 - 34} y={yFocal - 16} l={lFocal + 68} h={finale + 32} couleur={a(C.orange, doux(progres(t, t0 + 0.3, 0.3)))} longueur={80} hauteur={cadre.hauteur} />
      {avecLegende ? <div style={{ position: "absolute", left: 60, width: 960, top: zoneBas + 24, textAlign: "center", ...INTER, fontSize: 62, color: encre(d.fond), opacity: doux(progres(t, t0 + 0.15, 0.3)) * (1 - discret) }}>{focal.legende}</div> : null}
    </>
  );
}

/** Appoint du duel : le message du client, puis la réponse cochée. */
export function AppointDuel({ cadre }: { cadre: CadreChiffres }) {
  return (
    <Appoint cadre={cadre}>
      <Bulle x={90} y={1312} l={440} h={120} contour={C.encre} ombre={false}>
        <Points taille={20} />
      </Bulle>
      <Bulle x={470} y={1400} l={440} h={120} contour={C.vert} ombre={false}>
        <Points taille={20} couleur={C.gris} />
      </Bulle>
      <Coche x={900} y={1404} r={36} />
    </Appoint>
  );
}
