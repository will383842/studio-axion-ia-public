import React from "react";
/**
 * OUV-C · Situation précise (maquettes OUV-C-1/2, FIN-C-1) : un objet du quotidien en gros plan. Avec une heure :
 * l'horloge (l'aiguille vient d'avancer) et le téléphone posé qui vibre, puis l'écran verrouillé où tombe le message.
 * Sans heure : le téléphone, où tombe la notification du déclencheur. En appoint : la table de nuit, puis le moteur qui
 * s'éveille. `boucle` (FIN-C) : la même place, l'horloge à l'heure de la phrase-choc, la réponse partie.
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { a, ANTON, avance, Bulle, C, CarteIcone, Coche, Ecran, Etiquette, Horloge, Icone, Lueur, Points, T, TableDeNuit, tailleQuiTient, Telephone, Vibration } from "../objets-ouverture";
import type { ChiffreOuverture, DonneesOuverture } from "./donnees";
import { PhraseChoc, zonePhrase, type PhraseBoucle } from "./phrase-choc";

type D = Extract<DonneesOuverture, { code: "OUV-C" }>;

/** Ce qui remplace l'heure et le texte dans la boucle (FIN-C) : l'heure de la phrase-choc, un chiffre déjà dit. */
export type BoucleC = { heure: { h: number; m: number } | null; deja: ChiffreOuverture | null; phrase?: PhraseBoucle };

/** 1re image avec une heure : l'horloge en gros plan et le téléphone posé (il vibre, ou il a répondu en boucle). */
function HorlogeEtTable({ d, t, boucle, appoint }: { d: D; t: number; boucle?: BoucleC; appoint: boolean }) {
  const h = d.heure!;
  const montre = boucle?.heure ?? h;
  // L'aiguille des minutes vient d'avancer (3 minutes en 0,4 s).
  const recul = boucle ? 0 : 3 * (1 - avance(t, 0, 0.4));
  const minutes = montre.h * 60 + montre.m - recul;
  const texte = boucle ? (boucle.deja?.texte ?? h.texte) : h.texte;
  return (
    <>
      <Lueur x={540} y={640} r={600} o={0.7} />
      {d.situation && !boucle ? <Etiquette texte="Situation type" y={262} fond="sombre" /> : null}
      <Horloge cx={540} cy={640} r={296} h={Math.floor(minutes / 60)} m={minutes % 60} trace={boucle ? 0 : 40} traceHeure={boucle ? 150 : 0} />
      {/* Boucle avec la phrase-choc : elle prend la place du chiffre déjà dit (la bande des sous-titres, 1152 → 1286 px, reste
          libre dans les deux formats). */}
      {boucle?.phrase ? <PhraseChoc p={boucle.phrase} t={t} zone={zonePhrase("OUV-C-horloge", appoint ? "9:16" : "4:5")} couleur={C.ivoire} orange={C.orangeVif} /> : (
        <T x={130} y={974} largeur={820} align="center" taille={tailleQuiTient(texte, 170, 820, 96)} couleur={C.ivoire}>
          {texte}
        </T>
      )}
      {appoint ? <TableDeNuit icone={d.objet.icone} iconeReponse={d.moteur} vibre={!boucle} repondu={!!boucle} /> : null}
    </>
  );
}

/** Le téléphone debout : l'heure (ou le chiffre du déclencheur) sur l'écran verrouillé, la notification qui tombe. */
function TelephoneMessage({ d, t, repondu, appoint, phrase, tPhrase = 0 }: { d: D; t: number; repondu?: boolean; appoint: boolean; phrase?: PhraseBoucle; tPhrase?: number }) {
  const chute = avance(t, 0, 0.45);
  const ecran = d.heure?.texte ?? d.objet.chiffre?.texte ?? null;
  const libelle = d.objet.libelle;
  const tailleLibelle = tailleQuiTient(libelle, 66, 420, 58);
  return (
    <>
      <Lueur x={480} y={760} r={600} o={0.7} />
      {d.situation ? <Etiquette texte="Situation type" y={262} fond="sombre" /> : null}
      <Telephone x={150} y={318} l={700} h={812} inclinaison={-2} cadre={C.grisClair}>
        {ecran ? (
          <T x={0} y={92} largeur={672} align="center" taille={tailleQuiTient(ecran, 190, 600, 96)} couleur={C.ivoire}>
            {ecran}
          </T>
        ) : (
          <div style={{ position: "absolute", left: 336 - 90, top: 110, width: 180, height: 180, borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom={d.objet.icone} taille={100} couleur={C.orangeVif} epaisseur={2.4} />
          </div>
        )}
        <div style={{ position: "absolute", left: 36, top: 340, width: 600, height: 40, borderRadius: 30, background: a(C.ivoire, 0.1 * chute) }} />
        <div style={{ position: "absolute", left: 36, top: 362, width: 600, height: 40, borderRadius: 30, background: a(C.ivoire, 0.18 * chute) }} />
        <div style={{ position: "absolute", left: 30, top: 390 - 260 * (1 - chute), opacity: chute, width: 612, height: 200, borderRadius: 44, background: C.blanc, display: "flex", alignItems: "center", gap: 22, padding: "0 26px", boxSizing: "border-box", boxShadow: `0 20px 50px ${a(C.nuit, 0.12)}` }}>
          <div style={{ width: 108, height: 108, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom={d.objet.icone} taille={60} couleur={C.orangeVif} epaisseur={2.6} />
          </div>
          <div style={{ ...ANTON, textTransform: "none", fontSize: tailleLibelle, lineHeight: 1.05, color: C.encre, width: 430 }}>{libelle}</div>
          {repondu ? (
            <div style={{ position: "absolute", right: -10, top: -10 }}>
              <div style={{ position: "relative", width: 1, height: 1 }}>
                <Coche x={0} y={0} r={40} />
              </div>
            </div>
          ) : null}
        </div>
        {phrase ? null : (
          <Bulle x={30} y={616} l={470} h={110} fond={C.ivoire} opacite={avance(t, 0.3, 0.3)}>
            <Points couleur={C.gris} taille={26} />
          </Bulle>
        )}
      </Telephone>
      {phrase ? <PhraseChoc p={phrase} t={tPhrase} zone={zonePhrase("OUV-C-telephone", appoint ? "9:16" : "4:5")} couleur={C.ivoire} orange={C.orangeVif} /> : null}
      {repondu ? null : (
        <>
          <Vibration x={130} y={720} cote={-1} />
          <Vibration x={872} y={700} cote={1} />
        </>
      )}
      {appoint ? (
        <>
          <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
            <path d="M540 1300 L540 1328" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", left: 540 - 13, top: 1290, width: 26, height: 26, borderRadius: "50%", background: C.orangeVif }} />
          <CarteIcone cx={540} cy={1420} l={780} h={176} icone={d.moteur} contour={C.orangeVif} epaisseur={6} ombre={0} />
        </>
      ) : null}
    </>
  );
}

export function OuvertureC({ d, t, format, boucle }: { d: D; t: number; format: FormatIV; boucle?: BoucleC }) {
  const appoint = format === "9:16";
  const deuxieme = !boucle && t >= d.bascule;
  let contenu: React.ReactNode;
  if (d.heure && (boucle || !deuxieme)) contenu = <HorlogeEtTable d={d} t={t} boucle={boucle} appoint={appoint} />;
  else if (boucle) contenu = <TelephoneMessage d={d} t={9} repondu appoint={appoint} phrase={boucle.phrase} tPhrase={t} />;
  else contenu = <TelephoneMessage d={d} t={d.heure ? t - d.bascule : t} appoint={appoint} />;
  return (
    <Ecran fond="sombre" largeur={1080} hauteur={format === "4:5" ? 1350 : 1920} cadre45={format === "4:5"}>
      {contenu}
    </Ecran>
  );
}
