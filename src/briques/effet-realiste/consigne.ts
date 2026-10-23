/**
 * EFFET RÉALISTE PAR IA — CONSIGNE VIDÉO (anglais) envoyée au modèle (lot K). PUR.
 *
 * Claude rédige la consigne dans son appel unique (champ `consigneVideo`) ; le code y ajoute TOUJOURS les règles de
 * préservation (même visage, mêmes lèvres, même voix, même décor, même lumière) et la physique de l'action. Sans
 * consigne de Claude (version simple, plafond atteint), une consigne est écrite ici d'après la demande lue.
 * Les règles reprennent l'essai v2 du Décor IA (JOURNAL-E1) : visage et lèvres identiques image par image.
 */
import type { DemandeEffetLue } from "./demande";
import type { ObjetConnu } from "./types";

export const REGLES_PRESERVATION = [
  "Keep the person's face, identity, expression, lip movements and mouth shapes exactly identical, frame by frame (the original voice is kept and must stay in sync).",
  "Keep the room, background, framing, camera position, lighting, white balance and clothing exactly identical.",
  "Only add the action described above; do not add any other object, text, logo overlay or person.",
  "Photorealistic, natural physics, correct scale, consistent shadows, reflections and motion blur, no morphing of the hands or fingers.",
].join(" ");

export const NOMS_ANGLAIS: Record<ObjetConnu, string> = {
  telephone: "a modern black smartphone with its screen on",
  "logo-axion": "a solid orange 3D Axion logo (exactly as in the reference image)",
  tasse: "a white ceramic cup of hot coffee with light steam",
  livre: "a hardcover book",
  stylo: "a black ballpoint pen",
  "carte-bancaire": "a bank card",
  cle: "a set of metal keys",
  autre: "the requested object",
};

/** Action physique décrite précisément, d'après la demande lue (repli quand Claude n'a rien écrit). */
export function actionAnglaise(d: DemandeEffetLue, avecReference: boolean): string {
  const objet = d.objet === "autre" && avecReference ? "the object shown in the reference image" : NOMS_ANGLAIS[d.objet];
  if (d.dansLeDecor) return `${cap(objet)} appears naturally on the desk in front of the person, resting on the surface with a soft contact shadow, as if it had always been there.`;
  const main = `${cap(objet)} appears in the person's open hand, resting on the palm facing up, fingers slightly curled around it, held naturally at chest height.`;
  if (d.finitSurEcran)
    return `${main} After a short beat, the person throws it straight toward the camera: it flies forward with motion blur, grows larger as it approaches and hits the camera lens at the very end of the clip (impact on the screen).`;
  return main;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nettoie la consigne de Claude (une ligne, bornée) ; null si elle est inutilisable. */
export function nettoyerConsigneClaude(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const s = brut.replace(/\s+/g, " ").trim().slice(0, 900);
  // Une consigne vide, ou visiblement en français, n'est pas gardée : le modèle comprend mieux l'anglais.
  if (s.length < 20) return null;
  if (/\b(le|la|les|une|des|dans|avec)\b/i.test(s) && !/\b(the|a|an|with|in)\b/i.test(s)) return null;
  return s;
}

/** Consigne finale : l'action (Claude ou repli) + les règles de préservation, toujours. */
export function consigneVideo(o: { claude?: string | null; demande: DemandeEffetLue; avecReference: boolean }): string {
  const action = nettoyerConsigneClaude(o.claude) ?? actionAnglaise(o.demande, o.avecReference);
  const impact = o.demande.finitSurEcran && !/lens|camera|screen/i.test(action) ? " The object ends its flight hitting the camera lens (impact on the screen) at the end of the clip." : "";
  return `${action}${impact} ${REGLES_PRESERVATION}`.trim();
}

/** Description française pour la carte (« Un téléphone apparaît dans votre main, puis vous le jetez vers l'écran »). */
export function descriptionFrancaise(d: DemandeEffetLue): string {
  const noms: Record<ObjetConnu, string> = {
    telephone: "Un téléphone",
    "logo-axion": "Le logo Axion",
    tasse: "Une tasse de café",
    livre: "Un livre",
    stylo: "Un stylo",
    "carte-bancaire": "Une carte bancaire",
    cle: "Des clés",
    autre: "L'objet demandé",
  };
  const o = noms[d.objet];
  if (d.dansLeDecor) return `${o} apparaît sur votre bureau, en vrai.`;
  if (d.finitSurEcran) return `${o} apparaît dans votre main, puis vous le jetez vers l'écran (la vitre se brise à l'impact).`;
  return `${o} apparaît dans votre main, en vrai.`;
}
