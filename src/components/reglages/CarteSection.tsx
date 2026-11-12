import type { ReactNode } from "react";
import type { NomIcone } from "@/components/ui/Icone";
import { Section } from "@/components/ui/Section";

/** Section de Réglages : renvoie vers le système commun `Section` (ancre, icône, titre, contenu en carte). */
export function CarteSection({ id, icone, titre, action, children, className }: { id: string; icone: NomIcone; titre: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Section id={id} icone={icone} titre={titre} action={action} className={className}>
      {children}
    </Section>
  );
}
