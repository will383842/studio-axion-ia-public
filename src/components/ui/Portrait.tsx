import Image from "next/image";
import { cn } from "@/lib/cn";

const TAILLES = { sm: "size-9 text-sm", md: "size-12 text-base", lg: "size-16 text-xl", xl: "size-24 text-3xl" } as const;
const PX = { sm: 36, md: 48, lg: 64, xl: 96 } as const;

/** Photo ronde d'un personnage, ou ses initiales sur fond orange doux. (Jamais « avatar » à l'écran.) */
export function Portrait({ nom, photo, taille = "md", anneau, className }: { nom: string; photo?: string | null; taille?: keyof typeof TAILLES; anneau?: boolean; className?: string }) {
  const initiales = nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-orange-doux font-titre text-orange-vif", TAILLES[taille], anneau && "ring-2 ring-orange ring-offset-2 ring-offset-fond", className)}>
      {photo ? <Image src={photo} alt={nom} width={PX[taille]} height={PX[taille]} className="size-full object-cover" /> : <span aria-hidden>{initiales}</span>}
    </span>
  );
}
