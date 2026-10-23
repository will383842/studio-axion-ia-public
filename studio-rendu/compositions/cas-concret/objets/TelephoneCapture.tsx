/** Objet `telephone-capture` : le vrai écran du site, entier, dans un téléphone ; onde orange au point touché. */
import { Freeze, Img, OffthreadVideo } from "remotion";
import type { ProprietesObjet } from "../plans/commun";
import type { ContexteObjet } from "../plans/Objet";
import { planTelephoneCapture } from "../plans/TelephoneCapture";
import { mvt, styleMouvement } from "../plans/anim-objets";

export function TelephoneCapture(p: ProprietesObjet) {
  const t = planTelephoneCapture(p as ContexteObjet);
  const c = t.capture;
  const style = c ? { position: "absolute" as const, left: c.boite.x, top: c.boite.y, width: c.boite.largeur, height: c.boite.hauteur, ...styleMouvement(mvt(c)) } : undefined;
  return (
    <div style={{ position: "absolute", left: t.corps.x, top: t.corps.y, width: t.corps.largeur, height: t.corps.hauteur, borderRadius: t.rayon, background: t.couleur, padding: t.bord, boxSizing: "border-box", boxShadow: `0 ${t.corps.hauteur * 0.065}px ${t.corps.hauteur * 0.14}px ${t.ombre}` }}>
      <div style={{ position: "relative", width: t.ecran.largeur, height: t.ecran.hauteur, borderRadius: t.rayonEcran, overflow: "hidden", background: t.fondEcran }}>
        {c && style ? (
          c.sorte === "video" ? (
            <div style={style}>
              {/* Le film est figé à l'image voulue par son départ (`trimBefore`) : un `Freeze` serait borné à la durée de l'écran. */}
              <Freeze frame={0}>
                <OffthreadVideo src={c.src} trimBefore={c.imageFilm ?? 0} muted style={{ width: "100%", height: "100%" }} />
              </Freeze>
            </div>
          ) : (
            <Img src={c.src} style={style} />
          )
        ) : null}
        <div style={{ position: "absolute", left: t.onde.x - t.onde.diametre / 2, top: t.onde.y - t.onde.diametre / 2, width: t.onde.diametre, height: t.onde.diametre, boxSizing: "border-box", borderRadius: "50%", border: `${t.onde.trait}px solid ${t.onde.couleur}`, background: t.onde.remplissage, opacity: t.onde.opacite, transform: `scale(${t.onde.echelle})` }} />
      </div>
    </div>
  );
}
