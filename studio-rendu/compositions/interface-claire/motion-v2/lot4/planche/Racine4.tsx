import React from "react";
/**
 * Harnais de planche du lot 4 : par élément, une composition TRANSPARENTE 1080 × 1920 (stills, assemblés sur la prise commune
 * par ffmpeg) et une composition « -video » 540 × 960 (prise commune + élément) pour l'extrait de 2 s.
 */
import { AbsoluteFill, Composition, Img, registerRoot, staticFile, useCurrentFrame } from "remotion";
import { ELEMENTS } from "./elements";
import { FPS } from "../outils4";

const Racine4: React.FC = () => (
  <>
    {ELEMENTS.map(({ id, C }) => {
      const Wrap: React.FC<{ t: number }> = ({ t }) => <C t={t} largeurImage={1080} hauteurImage={1920} />;
      const Video: React.FC = () => {
        const frame = useCurrentFrame();
        return (
          <AbsoluteFill style={{ background: "#000" }}>
            <Img src={staticFile("prise.jpg")} style={{ position: "absolute", left: 0, top: 0, width: 540, height: 960 }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: "scale(0.5)", transformOrigin: "0 0" }}>
              <C t={frame / FPS} largeurImage={1080} hauteurImage={1920} />
            </div>
          </AbsoluteFill>
        );
      };
      return (
        <React.Fragment key={id}>
          <Composition id={id} component={Wrap} durationInFrames={90} fps={FPS} width={1080} height={1920} defaultProps={{ t: 0 }} />
          <Composition id={`${id}-video`} component={Video} durationInFrames={60} fps={FPS} width={540} height={960} />
        </React.Fragment>
      );
    })}
  </>
);
registerRoot(Racine4);
