import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$barbershopSlug/owner/reset-password")({
  beforeLoad: () => {
    // Backward compatibility: alihkan ke route Reset Password Owner global
    throw redirect({ to: "/owner/reset-password" as any, replace: true });
  },
  component: () => null,
});
