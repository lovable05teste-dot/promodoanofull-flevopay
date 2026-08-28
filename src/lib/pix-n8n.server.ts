type PixN8nWebhookInput = {
  customerName: string;
  email?: string;
  phone?: string;
  itemTitle: string;
  itemId?: string;
  itemImage?: string;
  amountCents: number;
  pixCode: string;
  transactionId: string;
};

type PixN8nWebhookResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

export async function sendPixCreatedToN8n(
  input: PixN8nWebhookInput,
  webhookUrl?: string,
): Promise<PixN8nWebhookResult> {
  const url = webhookUrl?.trim();
  if (!url) return { sent: false, skipped: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "pix_generated",
        createdAt: new Date().toISOString(),
        customer: {
          name: input.customerName,
          email: input.email || "",
          phone: input.phone || "",
        },
        product: {
          id: input.itemId || "",
          name: input.itemTitle,
          image: input.itemImage || "",
        },
        payment: {
          amountCents: input.amountCents,
          amount: (input.amountCents / 100).toFixed(2),
          currency: "BRL",
          pixCode: input.pixCode,
          transactionId: input.transactionId,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        sent: false,
        error: `n8n respondeu HTTP ${response.status}`,
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error:
        error instanceof Error ? error.message : "Falha desconhecida ao chamar o n8n",
    };
  } finally {
    clearTimeout(timeout);
  }
}
