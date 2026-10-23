/**
 * BRUITAGE DE VERRE (lot F3, facultatif sur la vitre qui se brise) : synthèse maison, déterministe, sans fichier
 * externe (même esprit que la banque CC0 du studio, `outils/bruitages/fabriquer.mts`). Impact sourd, craquement,
 * pluie d'éclats et tintements. PUR : rend des échantillons ; `wavMono16` en fait un fichier WAV.
 */

export function synthetiserVerre(frequence = 48000, dureeSec = 1.6): Float32Array {
  const n = Math.round(frequence * dureeSec);
  const s = new Float32Array(n);
  let graine = 1;
  const alea = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  let passeHaut = 0;
  let prec = 0;
  for (let i = 0; i < n; i++) {
    const t = i / frequence;
    const bruit = alea() * 2 - 1;
    passeHaut = 0.92 * (passeHaut + bruit - prec);
    prec = bruit;
    const impact = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 26) * 0.55;
    const craque = passeHaut * Math.exp(-t * 38) * 0.7;
    const pluie = passeHaut * Math.exp(-t * 4.2) * 0.16 * Math.min(1, t * 30);
    s[i] = impact + craque + pluie;
  }
  // Tintements : 26 éclats qui touchent le sol (2,8 à 7 kHz), plus serrés au début.
  for (let k = 0; k < 26; k++) {
    const t0 = 0.05 + Math.pow(alea(), 1.4) * 1.1;
    const f = 2800 + alea() * 4200;
    const a = 0.08 + alea() * 0.12;
    for (let i = Math.round(t0 * frequence); i < n; i++) {
      const u = i / frequence - t0;
      if (u > 0.25) break;
      s[i] += Math.sin(2 * Math.PI * f * u) * Math.exp(-u * 30) * a + Math.sin(2 * Math.PI * f * 1.51 * u) * Math.exp(-u * 45) * a * 0.5;
    }
  }
  const crete = s.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  for (let i = 0; i < n; i++) s[i] = (s[i] / crete) * 0.7;
  return s;
}

/** Échantillons (−1 à 1) → fichier WAV mono 16 bits. */
export function wavMono16(echantillons: Float32Array, frequence = 48000): Uint8Array {
  const n = echantillons.length;
  const tampon = new ArrayBuffer(44 + n * 2);
  const v = new DataView(tampon);
  const ecrire = (o: number, texte: string) => [...texte].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ecrire(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  ecrire(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, frequence, true);
  v.setUint32(28, frequence * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  // Lot I : l'en-tête du bloc « data » manquait (fichier refusé par FFmpeg).
  ecrire(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, echantillons[i])) * 32767), true);
  return new Uint8Array(tampon);
}
