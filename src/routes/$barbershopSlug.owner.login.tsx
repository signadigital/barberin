import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$barbershopSlug/owner/login")({
  beforeLoad: () => {
    // Backward compatibility: redirect URL lama ke route login Owner global
    throw redirect({ to: "/owner/login" as any, replace: true });
  },
  component: () => null,
});
