/**
 * CARTE SUR MESURE (plan v4 B.10, correctif du 09/10) : HTML, CSS et timeline GSAP écrits par Claude, dans une
 * iframe ISOLÉE (`sandbox="allow-scripts"` sans même origine, politique de sécurité sans aucune adresse), posée sur
 * le fond vivant commun (lumière, particules, grain, poussée de caméra). À chaque image, la composition demande
 * `tl.seek(image / 25)` à l'iframe et attend qu'elle ait redessiné (`delayRender`) : rendu image par image exact.
 * Le code a déjà passé les garde-fous (`verifierSurMesure`) ; sinon le moteur pose le modèle fixe de repli.
 * `controle: true` : zones sûres et textes fautifs encadrés en rouge (image de contrôle relue par Claude).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { documentSurMesure } from "../../../../src/briques/motion/sur-mesure";
import type { ProprietesCarteSurMesure } from "../../../../src/briques/motion/types";
import { GSAP_JS, POLICES_CSS, TROIS_D_JS } from "./sur-mesure/bibliotheques.genere";
import { CarteMotion } from "./noyau";

type Message = { type: "pret"; erreurs: string[] } | { type: "vu"; id: number; erreurs: string[] };

function Iframe(p: ProprietesCarteSurMesure & { controle?: boolean }) {
  const image = useCurrentFrame();
  const ref = useRef<HTMLIFrameElement>(null);
  const [pret, setPret] = useState(false);
  const [attentePret] = useState(() => delayRender("Carte sur mesure : chargement de l'iframe", { timeoutInMilliseconds: 60_000 }));
  const document = useMemo(
    () =>
      documentSurMesure(
        { html: p.html, css: p.css, js: p.js, troisD: p.troisD, largeur: p.largeur, hauteur: p.hauteur, hauteurVideo: p.hauteurVideo, ratio: p.ratio, dureeSec: p.images / p.fps, controle: p.controle },
        { gsap: GSAP_JS, troisD: TROIS_D_JS, polices: POLICES_CSS },
      ),
    [p.html, p.css, p.js, p.troisD, p.largeur, p.hauteur, p.hauteurVideo, p.ratio, p.images, p.fps, p.controle],
  );

  useEffect(() => {
    const recevoir = (ev: MessageEvent<Message>) => {
      if (ev.source !== ref.current?.contentWindow || ev.data?.type !== "pret") return;
      if (ev.data.erreurs.length) console.warn(`Carte sur mesure : ${ev.data.erreurs.join(" ; ")}`);
      setPret(true);
      continueRender(attentePret);
    };
    window.addEventListener("message", recevoir);
    return () => window.removeEventListener("message", recevoir);
  }, [attentePret]);

  useEffect(() => {
    if (!pret) return;
    const fenetre = ref.current?.contentWindow;
    if (!fenetre) return;
    const id = image + 1;
    const attente = delayRender(`Carte sur mesure : image ${image}`, { timeoutInMilliseconds: 30_000 });
    const recevoir = (ev: MessageEvent<Message>) => {
      if (ev.source !== fenetre || ev.data?.type !== "vu" || ev.data.id !== id) return;
      window.removeEventListener("message", recevoir);
      continueRender(attente);
    };
    window.addEventListener("message", recevoir);
    fenetre.postMessage({ type: "seek", t: image / p.fps, id }, "*");
    return () => window.removeEventListener("message", recevoir);
  }, [image, pret, p.fps]);

  return <iframe ref={ref} title="Carte sur mesure" sandbox="allow-scripts" srcDoc={document} style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: p.hauteur, border: 0, background: "transparent" }} />;
}

export function CarteSurMesure(p: ProprietesCarteSurMesure & { controle?: boolean }) {
  if (!p.js.trim()) return <AbsoluteFill style={{ backgroundColor: "#16120F" }} />;
  return (
    <CarteMotion mp={p}>
      <Iframe {...p} />
    </CarteMotion>
  );
}
