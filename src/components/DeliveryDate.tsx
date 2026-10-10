import { useEffect, useState } from "react";

/**
 * Data da previsão: dois dias corridos após o dia atual do visitante.
 * Calculada somente no cliente para evitar diferenças na hidratação do SSR.
 * Atualiza automaticamente ao virar o dia, mesmo com a página aberta.
 */
export function useDeliveryDate(): string {
  const [date, setDate] = useState("");

  useEffect(() => {
    function updateDate() {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      today.setDate(today.getDate() + 2);
      setDate(
        new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(today)
      );
    }

    updateDate();
    const interval = window.setInterval(updateDate, 60_000);
    document.addEventListener("visibilitychange", updateDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateDate);
    };
  }, []);

  return date;
}

export function DeliveryDate({ prefix = "Chegará até " }: { prefix?: string }) {
  const date = useDeliveryDate();
  return <>{date ? `${prefix}${date}` : "Previsão de entrega: em 2 dias"}</>;
}
