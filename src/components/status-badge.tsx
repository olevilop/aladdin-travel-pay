import type { Application, PaymentStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

export function getPaymentStatus(app: Application): PaymentStatus {
  if (app.files.length === 0) return "empty";
  const paid = app.files.filter((f) => f.is_paid).length;
  if (paid === 0) return "unpaid";
  if (paid === app.files.length) return "paid";
  return "partial";
}

export function StatusBadge({ app }: { app: Application }) {
  const total = app.files.length;
  const paid = app.files.filter((f) => f.is_paid).length;
  const status = getPaymentStatus(app);

  const map: Record<PaymentStatus, { label: string; className: string }> = {
    empty: {
      label: "Пусто",
      className: "bg-muted text-muted-foreground border-transparent",
    },
    unpaid: {
      label: "Не оплачено",
      className: "bg-red-100 text-red-700 border-transparent",
    },
    partial: {
      label: `Частично ${paid}/${total}`,
      className: "bg-yellow-100 text-yellow-800 border-transparent",
    },
    paid: {
      label: "Оплачено полностью",
      className: "bg-green-100 text-green-700 border-transparent",
    },
  };
  const { label, className } = map[status];
  return <Badge className={className}>{label}</Badge>;
}
