/**
 * LEVIERS DE MISE EN PAGE (banc V4-1) : taille obtenue par le gabarit `etape` du format selon la zone et la bande des
 * sous-titres, comparée à la v4 (titre 190 px, téléphone 470 × 920 px). Calcul pur (`boites` de la brique), aucun rendu.
 * Usage : pnpm exec tsx outils/v4-fidelite/leviers.mts
 */
const { boites, charteDuoPour, zonesEcran } = await import("../../src/briques/ecrans-motion");
const { zoneProtegeeCombinee } = await import("../../src/reseaux");

const H = 1920;
const cas = [
  { nom: "Format actuel (4 réseaux, bande 8 %, marque)", reseaux: ["facebook", "instagram", "tiktok", "linkedin"], bande: 0.08, sansMarque: false },
  { nom: "Bande des sous-titres 5 % (une ligne)", reseaux: ["facebook", "instagram", "tiktok", "linkedin"], bande: 0.05, sansMarque: false },
  { nom: "Sans la marque axion-ia.com", reseaux: ["facebook", "instagram", "tiktok", "linkedin"], bande: 0.08, sansMarque: true },
  { nom: "Bande 5 % et sans marque", reseaux: ["facebook", "instagram", "tiktok", "linkedin"], bande: 0.05, sansMarque: true },
  { nom: "LinkedIn seul (bas 14 %), bande 8 %, marque", reseaux: ["linkedin"], bande: 0.08, sansMarque: false },
] as const;
const lignes: string[] = [];
for (const c of cas) {
  const zone = zoneProtegeeCombinee("9:16", [...c.reseaux] as never)!;
  const z = zonesEcran(zone as never, 1080, H, c.bande);
  const marque = 0.0188 * H * 1.3;
  const utile = c.sansMarque ? { ...z.utile, y: z.utile.y - marque, hauteur: z.utile.hauteur + marque } : z.utile;
  const dessin = { ...z.dessin, hauteur: utile.y + utile.hauteur - z.dessin.y };
  const b = boites("etape", utile, charteDuoPour(H), { puces: 1 }, { dessin });
  const titre = b.textes.find((t) => t.nom === "titre")!;
  const visuel = b.objets.find((o) => o.nom === "visuel")!.boite;
  lignes.push(`| ${c.nom} | ${(b.reduction.textes).toFixed(2)} | ${Math.round(titre.taille)} px (v4 190) | ${Math.round(visuel.hauteur)} px = ${((visuel.hauteur / H) * 100).toFixed(0)} % (v4 935 = 49 %) | ${Math.round(z.sousTitres.y)}–${Math.round(z.sousTitres.y + z.sousTitres.hauteur)} |`);
}
console.log("| Variante | Rapport | Titre d'étape | Téléphone (hauteur) | Sous-titres (px) |\n|---|---|---|---|---|\n" + lignes.join("\n"));
