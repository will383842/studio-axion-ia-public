import React from "react";
/**
 * CHI-B · Anneau (maquettes CHI-B-1, CHI-B-2, R45-CHI-B-1) : l'anneau se remplit jusqu'au pourcentage, en orange ; le
 * complément déjà dit (« 20 % ») prend sa part en encre, avec sa légende. Appoint : la file des demandes (bulles), puis
 * la pastille de la sortie où part le reste.
 */
import type { DonneesEcranChiffresRendu } from "./donnees";
import { a, arc, Appoint, Bulle, C, ChiffreAnton, doux, INTER, Pastille, Points, progres, type CadreChiffres } from "./outils";

const ECART = 4;

/** Géométrie de l'anneau : 9:16, rayon 340 (le « 80 % » de 330 px tient dedans, le reste finit au-dessus des
 *  sous-titres) ; 4:5, cy 540, rayon 330 (R45-CHI-B-1 : 320). */
export function geometrieAnneau(cadre: CadreChiffres) {
  return cadre.appoint ? { cx: 540, cy: 655, r: 340, ep: 70, taille: 330 } : { cx: 540, cy: 540, r: 330, ep: 72, taille: 330 };
}

export function Anneau({ d, t, t0, cadre, discret = 0 }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres; discret?: number }) {
  const g = geometrieAnneau(cadre);
  const valeur = d.anneau?.valeur ?? 0;
  const reste = d.anneau?.reste;
  const focal = d.chiffres[d.focal];
  // Le segment du reste est en bas, centré à 180° ; l'orange part de sa fin et tourne dans le sens horaire.
  const partReste = 360 * (1 - valeur / 100);
  const debutReste = 180 - partReste / 2 + ECART;
  const finReste = 180 + partReste / 2 - ECART;
  const debut = 180 + partReste / 2 + ECART;
  const remplissage = doux(progres(t, t0, 1));
  const finOrange = debut + (360 * (valeur / 100) - 2 * ECART) * remplissage;
  const vingt = reste ? doux(progres(t, t0 + 1, 0.45)) : 0;
  return (
    <>
      <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={a(C.encre, 0.14)} strokeWidth={g.ep} />
        {remplissage > 0 ? <path d={arc(g.cx, g.cy, g.r, debut, finOrange)} fill="none" stroke={C.orange} strokeWidth={g.ep} style={{ filter: `drop-shadow(0 10px 24px ${a(C.orange, 0.12)})` }} /> : null}
        {remplissage < 1 ? [0, 1, 2].map((k) => <path key={k} d={arc(g.cx, g.cy, g.r, finOrange + 2 + k * 5, finOrange + 5 + k * 5)} fill="none" stroke={a(C.orange, 0.3 - k * 0.09)} strokeWidth={g.ep} />) : null}
        {vingt > 0 ? <path d={arc(g.cx, g.cy, g.r, debutReste, debutReste + (finReste - debutReste) * vingt)} fill="none" stroke={C.encre} strokeWidth={g.ep} /> : null}
      </svg>
      <div style={{ position: "absolute", opacity: t >= t0 - 0.05 ? 1 : 0, left: g.cx - g.r + g.ep / 2, top: g.cy - g.taille * 0.7, width: 2 * g.r - g.ep, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ChiffreAnton texte={focal.texte} taille={g.taille} couleur={C.orange} />
        {focal.legende ? <div style={{ ...INTER, fontSize: 62, color: C.encre, marginTop: 14, opacity: doux(progres(t, t0 + 0.2, 0.4)) * (1 - discret) }}>{focal.legende}</div> : null}
      </div>
      {/* La demande suivante entre dans l'anneau par le bas, puis le reste (déjà dit) prend sa place. */}
      {vingt < 1 ? (
        <div style={{ opacity: (1 - vingt) * (1 - discret) }}>
          <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d={`M540 ${g.cy + g.r + 40}V${g.cy + g.r + 10}`} stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
          </svg>
          <Bulle x={400} y={g.cy + g.r + 46} l={280} h={92} contour={C.encre} ombre={false}>
            <Points taille={16} />
          </Bulle>
        </div>
      ) : null}
      {reste ? (
        <div style={{ position: "absolute", left: 60, width: 960, top: g.cy + g.r + g.ep / 2 + 18, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 26, opacity: vingt * (1 - discret) }}>
          <ChiffreAnton texte={reste.texte} taille={100} couleur={C.encre} />
          {reste.legende ? <div style={{ ...INTER, fontSize: 60, color: C.encre, whiteSpace: "nowrap" }}>{reste.legende}</div> : null}
        </div>
      ) : null}
      {!cadre.appoint && reste ? <Pastille x={858} y={g.cy + 340} d={140} icone={d.icones.sortie} /> : null}
    </>
  );
}

/** Appoint de l'anneau : la file des demandes ; une fois le reste posé, les demandes partent vers la sortie. */
export function AppointAnneau({ d, t, t0, cadre }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres }) {
  const parti = d.anneau?.reste ? progres(t, t0 + 1, 0.45) >= 0.5 : false;
  if (!parti)
    return (
      <Appoint cadre={cadre}>
        <Bulle x={380} y={1312} l={320} h={124} contour={C.encre} ombre={false}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={60} y={1372} l={300} h={124} contour={C.encre} ombre={false} rotation={-5}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
        <Bulle x={720} y={1384} l={300} h={124} contour={C.encre} ombre={false} rotation={6}>
          <Points taille={20} couleur={C.gris} />
        </Bulle>
      </Appoint>
    );
  return (
    <>
      <Appoint cadre={cadre}>
        <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M560 1420 C 610 1430, 640 1426, 680 1416" fill="none" stroke={a(C.encre, 0.45)} strokeWidth={7} strokeDasharray="2 16" strokeLinecap="round" />
        </svg>
        <Bulle x={80} y={1318} l={300} h={120} contour={C.encre} ombre={false} rotation={-6}>
          <Points taille={20} />
        </Bulle>
        <Bulle x={300} y={1392} l={260} h={110} contour={C.encre} ombre={false} rotation={5}>
          <Points taille={18} />
        </Bulle>
      </Appoint>
      {cadre.appoint ? <Pastille x={700} y={1310} d={224} icone={d.icones.sortie} /> : null}
    </>
  );
}
