import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type ProprietesEssai = { titre: string };

/**
 * Composition d'ESSAI du conteneur (lot M1b) : vérifie que Remotion, le navigateur et l'encodage fonctionnent.
 * Fond noir chaud #16120F, lueur orange #C65A2E (défaut du décor avocat), titre qui apparaît.
 */
export function Essai({ titre }: ProprietesEssai) {
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entree = spring({ frame: image, fps, config: { damping: 18 } });
  const lueur = interpolate(image, [0, 75], [0.35, 0.6]);
  return (
    <AbsoluteFill style={{ backgroundColor: "#16120F", justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 40% at 50% 45%, rgba(198,90,46,${lueur}), transparent 70%)` }} />
      <div
        style={{
          fontFamily: "sans-serif",
          fontWeight: 700,
          fontSize: 88,
          color: "#F4EDE6",
          textAlign: "center",
          padding: "0 90px",
          transform: `translateY(${(1 - entree) * 60}px)`,
          opacity: entree,
        }}
      >
        {titre}
      </div>
    </AbsoluteFill>
  );
}
