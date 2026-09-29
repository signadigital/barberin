import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$barbershopSlug/owner/forgot-password")({
  beforeLoad: () => {
    // Backward compatibility: alihkan ke route Lupa Password Owner global
    throw redirect({ to: "/owner/forgot-password" as any, replace: true });
  },
  component: () => null,
});
