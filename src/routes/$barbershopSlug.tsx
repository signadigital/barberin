import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { resolveBarbershopBySlug } from "@/lib/tenant-resolver";
import { BarbershopNotFound } from "@/components/barberin/barbershop-not-found";

export const Route = createFileRoute("/$barbershopSlug")({
  loader: async ({ params }) => {
    const shop = await resolveBarbershopBySlug({
      data: params.barbershopSlug,
    });

    if (!shop) {
      throw notFound();
    }

    return { shop };
  },
  notFoundComponent: BarbershopNotFound,
  component: BarbershopLayout,
});

function BarbershopLayout() {
  return <Outlet />;
}
