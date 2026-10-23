"use client";

/**
 * Cloche de l'en-tête (ARCHITECTURE §1 : propriété du développeur C).
 * Le panneau vit dans components/notifications ; ce fichier garde l'import de la coquille inchangé.
 */
import { ClocheNotifications } from "@/components/notifications/ClocheNotifications";

export function Cloche({ nonLuesInitial }: { nonLuesInitial: number }) {
  return <ClocheNotifications nonLuesInitial={nonLuesInitial} />;
}
