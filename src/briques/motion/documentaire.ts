/**
 * GARDE-FOU DE LA CARTE DOCUMENTAIRE (modèle 13, lot F2) : jamais de nom de personne ni de bandeau « nom · marque »
 * (consigne de Will). PUR, sans Zod ni alias « @/ » : lu par le choix automatique, les schémas et le rendu.
 */

/**
 * Vrai si le texte porte un nom de personne ou un bandeau : une civilité suivie d'un nom (« M. Dupont », « Maître
 * Martin »), le séparateur « · », « • » ou « | » d'un bandeau, ou la marque.
 */
export function contientNomOuBandeau(texteLibre: string): boolean {
  const t = texteLibre.normalize("NFC");
  if (/[·•|]/.test(t)) return true;
  if (/axion/i.test(t)) return true;
  return /(?:^|[\s(«"])(M\.|Mme|Mlle|Monsieur|Madame|Mademoiselle|Ma[iî]tre|Me|Dr|Docteur|Pr|Professeur)\s+[A-ZÀ-Ý][a-zà-ÿ-]+/.test(t);
}
