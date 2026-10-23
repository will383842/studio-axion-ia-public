import { cn } from "@/lib/cn";

/** Logo « Axion-IA Studio ». `replie` : le symbole seul. */
export function Logo({ replie, taille = "md", className }: { replie?: boolean; taille?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "relative grid shrink-0 place-items-center rounded-xl bg-orange font-titre text-sur-orange shadow-orange",
          taille === "lg" ? "size-14 rounded-2xl text-2xl" : "size-9 text-base",
        )}
      >
        A
        <span className={cn("absolute rounded-full bg-sur-orange", taille === "lg" ? "right-2.5 top-2.5 size-2" : "right-1.5 top-1.5 size-1.5")} />
      </span>
      {!replie && (
        <span className="flex flex-col leading-none">
          <span className={cn("font-titre text-texte", taille === "lg" ? "text-2xl" : "text-[15px]")}>Axion-IA</span>
          <span className={cn("font-semibold uppercase tracking-[0.2em] text-orange-vif", taille === "lg" ? "mt-1 text-xs" : "mt-0.5 text-[10px]")}>Studio</span>
        </span>
      )}
      <span className="sr-only">Axion-IA Studio</span>
    </span>
  );
}
