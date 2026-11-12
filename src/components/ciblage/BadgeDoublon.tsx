import { Pastille } from "@/components/ui/Pastille";

/** Signale un texte proche d'un autre (jamais supprimé). */
export function BadgeDoublon({ className }: { className?: string }) {
  return (
    <Pastille ton="ambre" className={className}>
      Doublon possible
    </Pastille>
  );
}
