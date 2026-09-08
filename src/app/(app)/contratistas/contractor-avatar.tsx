/** Círculo con la inicial del contratista, en el dorado de marca
 *  (tokens de tema, sin color literal). */
export function ContractorAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dims = size === "md" ? "size-10 text-sm" : "size-7 text-[11px]";
  return (
    <div
      title={name}
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary`}
    >
      {initial}
    </div>
  );
}
