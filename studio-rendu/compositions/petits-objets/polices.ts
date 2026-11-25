/**
 * Chargeur à la demande de JetBrains Mono (terminal des petits objets). Ajout pur : rien n'appelle
 * `chargerJetBrainsMono` tant qu'un objet ne l'utilise pas, et rien ne se charge au niveau du module.
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import jetbrainsMono from "../commune/polices/JetBrainsMono-Variable.ttf";

export const FAMILLE_JETBRAINS_MONO = "JetBrains Mono";

let chargement: Promise<void> | null = null;
export function chargerJetBrainsMono(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police JetBrains Mono");
  const face = new FontFace(FAMILLE_JETBRAINS_MONO, `url(${jetbrainsMono})`, { weight: "100 800" });
  chargement = face.load().then(
    () => {
      document.fonts.add(face);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police illisible (${FAMILLE_JETBRAINS_MONO}) : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
}
