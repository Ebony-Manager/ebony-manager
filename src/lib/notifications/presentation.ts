const NOTIFICATION_EMOJIS: Record<string, string> = {
  personal_new_intake: "👤",
  personal_status: "🔄",
  attendance_adjustment: "🕒",
  payroll_loan: "💵",
  payroll_deduction: "➖",
  warehouse_low_stock: "⚠️",
  warehouse_out_stock: "🚨",
  warehouse_adjustment: "📦",
  purchasing_request: "🛒",
  purchasing_no_supplier: "🔎",
  purchasing_overdue: "⏰",
  purchasing_received: "📥",
  inspection_created: "🔍",
  inspection_status: "✅",
};

/** Prefix an icon by notification type for consistent inbox and push display. */
export function notificationTitle(typeKey: string | null | undefined, title: string): string {
  const emoji = typeKey ? NOTIFICATION_EMOJIS[typeKey] : undefined;
  if (!emoji || title.startsWith(emoji)) return title;
  if (typeKey === "inspection_status") {
    const statusEmoji = /reabiert/i.test(title) ? "🔁" : "✅";
    return `${statusEmoji} ${title}`;
  }
  return `${emoji} ${title}`;
}
