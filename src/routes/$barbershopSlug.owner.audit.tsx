import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$barbershopSlug/owner/audit")({
  beforeLoad: ({ params }: { params: { barbershopSlug: string } }) => {
    throw redirect({ to: `/${params.barbershopSlug}/owner/audit-activities` as any });
  },
  component: () => null,
});


