/**
 * Modèle 4 — LIGNE DE TEMPS / FEUILLE DE ROUTE : un rail vertical dont la partie orange AVANCE AVEC LA PAROLE, d'une
 * étape à l'autre (glisse), une lueur au bout. Les jalons à venir attendent en pointillé ; l'étape dite s'allume, son
 * icône se dessine et son texte se construit ; les étapes passées gardent une coche.
 */
import { LigneDeTempsSpectaculaire } from "./spectaculaire/LigneDeTempsSpectaculaire";
import { horairesParDefaut } from "../../../../src/briques/motion/calage";
import type { DonneesLigneDeTemps, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, FlouMouvement, IconeTracee, mixer, progres, stylePanneau, TexteCinetique, Trait, useMotion } from "./noyau";

function Contenu({ d }: { d: DonneesLigneDeTemps }) {
  const { t, u, zone, taille, chute, duree, mesurer } = useMotion();
  const n = d.etapes.length;
  const defaut = horairesParDefaut(n, duree, !!d.titre);
  const heures = d.etapes.map((e, i) => e.aSec ?? defaut[i]);
  const actif = heures.reduce((a, h, i) => (t >= h ? i : a), -1);
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const feuille = d.variante === "feuille-de-route";

  const hTitre = d.titre ? mesurer(d.titre, "titre", zone.largeur) + 16 * u + Math.max(4, 7 * u) + 44 * u : 0;
  const haut = zone.y + hTitre;
  const bas = zone.y + zone.hauteur - 10 * u;
  const pas = (bas - haut) / n;
  const noeud = Math.round(Math.min(pas * 0.55, taille("corps") * 1.7));
  const xRail = zone.x + noeud / 2;
  const yEtape = (i: number) => haut + pas * i + pas * 0.38;

  // Progression du rail : glisse vers l'étape dite (0,5 s), depuis la précédente.
  const avance = (tt: number) => {
    let y = yEtape(0) - pas * 0.3;
    heures.forEach((h, i) => {
      const k = progres(tt, h - 0.12, 0.5, "glisse");
      if (k > 0) y = mixer(i === 0 ? yEtape(0) - pas * 0.3 : yEtape(i - 1), yEtape(i), k);
    });
    return y;
  };
  const yBout = avance(t);
  const dyBout = deplacementObturateur(avance, t);
  const rail = progres(t, 0.05, 0.7, "glisse");
  const epaisseur = Math.max(4, 6 * u);

  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: zone.x, width: zone.largeur, top: zone.y }}>
          <TexteCinetique texte={d.titre} niveau="titre" debut={0.1} />
          <Trait debut={0.4} largeur={zone.largeur * 0.2} epaisseur={Math.max(4, 7 * u)} style={{ marginTop: 16 * u }} />
        </div>
      )}
      {/* Rail de fond (pointillé) puis partie parcourue (orange, flou de mouvement à la glisse). */}
      <div style={{ position: "absolute", left: xRail - epaisseur / 2, top: yEtape(0), width: epaisseur, height: (yEtape(n - 1) - yEtape(0)) * rail, backgroundImage: `linear-gradient(${COULEURS.filet} 55%, transparent 55%)`, backgroundSize: `${epaisseur}px ${18 * u}px`, opacity: 1 - s }} />
      <FlouMouvement dy={dyBout} style={{ position: "absolute", left: xRail - epaisseur / 2, top: yEtape(0) - pas * 0.3, width: epaisseur, height: Math.max(0, yBout - (yEtape(0) - pas * 0.3)), opacity: (1 - s) * progres(t, heures[0] - 0.15, 0.2) }}>
        <div style={{ width: "100%", height: "100%", borderRadius: epaisseur, background: `linear-gradient(180deg, ${avecOpacite(COULEURS.orange, 0)}, ${COULEURS.orange} 30%, ${COULEURS.orangeVif})`, boxShadow: `0 0 ${18 * u}px ${avecOpacite(COULEURS.orangeVif, 0.6)}` }} />
      </FlouMouvement>
      {/* Lueur au bout du rail (respire). */}
      <div style={{ position: "absolute", left: xRail - 40 * u, top: yBout - 40 * u, width: 80 * u, height: 80 * u, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.creme, 0.9)}, ${avecOpacite(COULEURS.orangeVif, 0.5)} 30%, ${avecOpacite(COULEURS.orange, 0)} 70%)`, opacity: (1 - s) * progres(t, heures[0] - 0.15, 0.2) * (0.8 + 0.2 * Math.sin(t * 5)) }} />
      {d.etapes.map((e, i) => {
        const h = heures[i];
        const y = yEtape(i);
        const dite = t >= h;
        const passe = i < actif;
        const estActif = i === actif;
        const kActif = estActif ? progres(t, h, 0.3) : passe ? 1 - progres(t, heures[i + 1], 0.35) : 0;
        const apparitionNoeud = echelleRessort(t, 0.25 + i * DUREES.decalage, chute + (n - i) * 0.03);
        const allume = progres(t, h + 0.1, 0.25);
        const chuteEtape = chute + (n - 1 - i) * 0.04;
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: xRail - noeud / 2,
                top: y - noeud / 2,
                width: noeud,
                height: noeud,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${(apparitionNoeud * (1 + 0.12 * kActif)).toFixed(4)})`,
                background: allume > 0 ? `radial-gradient(circle at 35% 30%, ${avecOpacite(COULEURS.orangeVif, allume)}, ${avecOpacite(COULEURS.orange, allume)} 60%, ${avecOpacite(COULEURS.orangeProfond, allume)})` : COULEURS.fond,
                boxShadow: `0 0 0 ${Math.max(2, 3 * u)}px ${dite ? COULEURS.orange : COULEURS.filet}, 0 0 ${50 * u * kActif}px ${avecOpacite(COULEURS.orangeVif, 0.6 * kActif)}`,
              }}
            >
              {!dite && <span style={{ fontSize: noeud * 0.42, fontWeight: 800, color: COULEURS.cremeAttenuee, opacity: 0.7 }}>{i + 1}</span>}
              {dite && (passe ? <IconeTracee nom="coche" taille={noeud * 0.5} debut={heures[i + 1]} epaisseur={3} /> : e.icone ? <IconeTracee nom={e.icone} taille={noeud * 0.5} debut={h + 0.12} epaisseur={2.4} /> : <span style={{ fontSize: noeud * 0.42, fontWeight: 800 }}>{i + 1}</span>)}
            </div>
            {dite && (
              <div style={{ position: "absolute", left: xRail + noeud / 2 + 34 * u, top: y - pas * 0.42, width: zone.x + zone.largeur - (xRail + noeud / 2 + 34 * u), height: pas * 0.84, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ ...stylePanneau(u, kActif), padding: `${16 * u}px ${26 * u}px`, opacity: passe ? 0.72 + 0.28 * kActif : 1, transform: `translateX(${((1 - progres(t, h, DUREES.entree)) * 50 * u).toFixed(2)}px)`, background: kActif > 0.01 ? stylePanneau(u, kActif).background : "transparent", boxShadow: kActif > 0.01 ? stylePanneau(u, kActif).boxShadow : "none" }}>
                  {feuille && e.detail && <TexteCinetique texte={e.detail.toUpperCase()} niveau="legende" debut={h + 0.02} couleur={COULEURS.orangeVif} graisse={700} chute={chuteEtape} style={{ letterSpacing: "0.12em", fontSize: taille("legende") * 0.98 }} />}
                  <TexteCinetique texte={e.titre} niveau="corps" debut={h + 0.06} chute={chuteEtape} graisse={700} />
                  {!feuille && e.detail && <TexteCinetique texte={e.detail} niveau="legende" debut={h + 0.2} couleur={COULEURS.cremeAttenuee} chute={chuteEtape} />}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function MotionLigneDeTemps(p: MiseEnPageCarte & { donnees: DonneesLigneDeTemps }) {
  if (p.style === "spectaculaire") return <LigneDeTempsSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
