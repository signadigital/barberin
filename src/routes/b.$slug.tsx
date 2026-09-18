import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      href: `/${params.slug}/customer/services`,
    });
  },
});
