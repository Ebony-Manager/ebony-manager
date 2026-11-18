import { PersonAvatar } from "@/components/shared/person-avatar";

/** Círculo del contratista: el mismo de toda la app (`PersonAvatar`): foto, o la inicial. */
export function ContractorAvatar(props: React.ComponentProps<typeof PersonAvatar>) {
  return <PersonAvatar {...props} />;
}
