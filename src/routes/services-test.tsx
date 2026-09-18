import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getServices } from "@/lib/services";

export const Route = createFileRoute("/services-test")({
  component: ServicesTestPage,
});

function ServicesTestPage() {
  const [services, setServices] = useState<
    {
      id: string;
      name: string;
      category: string;
      price: string;
      status: "active" | "inactive" | "suspended";
    }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getServices()
      .then((data) => {
        setServices(
          data.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.durasi_menit ? `${d.durasi_menit} Menit` : "Barbershop",
            price: String(d.price),
            status: d.status,
          })),
        );
      })
      .catch((err) => {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Gagal mengambil layanan",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>BARBERIN Services Test</h1>

      {loading && <p>Memuat layanan...</p>}

      {error && (
        <>
          <h2>❌ Error</h2>
          <pre>{error}</pre>
        </>
      )}

      {!loading && !error && (
        <>
          <h2>✅ Services berhasil diambil dari database</h2>
          <p>Jumlah layanan: {services.length}</p>

          <ul>
            {services.map((service) => (
              <li key={service.id}>
                <strong>{service.name}</strong> —{" "}
                {service.category} — Rp
                {Number(service.price).toLocaleString("id-ID")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}