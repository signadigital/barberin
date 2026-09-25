import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useBarberin } from "@/lib/barberin-store";
import { getTransactionDetail } from "@/lib/bookings";

export const Route = createFileRoute("/$barbershopSlug/customer/payment-confirmation")({
  head: () => ({
    meta: [
      { title: "BARBERIN" },
    ],
  }),
  component: PaymentConfirmationRedirect,
});

function PaymentConfirmationRedirect() {
  const navigate = useNavigate();
  const { barbershopSlug } = (Route as any).useParams();
  const { transactionId } = useBarberin();

  useEffect(() => {
    if (!transactionId) {
      navigate({ to: `/${barbershopSlug}/customer/services` as any });
      return;
    }

    getTransactionDetail({ data: { transactionId, barbershopSlug } })
      .then((detail) => {
        if (detail && (detail.status === "paid" || detail.paymentStatus === "success")) {
          navigate({
            to: `/${barbershopSlug}/customer/receipt/${transactionId}` as any,
          });
        } else {
          navigate({
            to: `/${barbershopSlug}/customer/service-execution` as any,
            search: { tx: transactionId } as any,
          });
        }
      })
      .catch(() => {
        navigate({
          to: `/${barbershopSlug}/customer/service-execution` as any,
          search: { tx: transactionId } as any,
        });
      });
  }, [transactionId, barbershopSlug, navigate]);

  return null;
}

