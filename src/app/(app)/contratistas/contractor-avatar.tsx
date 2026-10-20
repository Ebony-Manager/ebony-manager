/** Círculo del contratista: su FOTO si ya se subió una, y si no la inicial
 *  en el color principal del tema (sin color literal). */
export function ContractorAvatar({
  name,
  photoUrl = null,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "xl";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dims = size === "xl" ? "size-24 text-3xl" : size === "md" ? "size-10 text-sm" : "size-7 text-[11px]";
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase Storage; next/image no aplica.
      <img src={photoUrl} alt={name} title={name} className={`${dims} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <div
      title={name}
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary`}
    >
      {initial}
    </div>
  );
}
