/**
 * IV-SV : MODE SANS VOIX. Pièces pures du silence : un WAV de silence (PCM 16 bits, mono) de la durée d'une version.
 * Aucune voix, aucun appel payant, aucune musique : le rendu reçoit une piste muette, les sous-titres et le texte à
 * l'écran portent le sens.
 */

/** Fréquence du silence : basse (le fichier reste petit), le silence n'a pas de contenu à restituer. */
export const FREQUENCE_SILENCE_IV = 8000;

/** Octets d'un WAV (RIFF, PCM 16 bits, mono) de silence de `dureeSec` secondes (arrondie à la milliseconde, au moins 0,1 s). PUR. */
export function wavSilenceIV(dureeSec: number): Uint8Array {
  const echantillons = Math.max(1, Math.round(Math.max(0.1, dureeSec) * FREQUENCE_SILENCE_IV));
  const donnees = echantillons * 2;
  const octets = new Uint8Array(44 + donnees);
  const v = new DataView(octets.buffer);
  const texte = (decalage: number, t: string) => [...t].forEach((c, i) => v.setUint8(decalage + i, c.charCodeAt(0)));
  texte(0, "RIFF");
  v.setUint32(4, 36 + donnees, true);
  texte(8, "WAVE");
  texte(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, FREQUENCE_SILENCE_IV, true);
  v.setUint32(28, FREQUENCE_SILENCE_IV * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texte(36, "data");
  v.setUint32(40, donnees, true);
  return octets;
}
