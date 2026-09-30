import type { NotificationWithActor } from "@/lib/supabase/types";

// Turns a notification row into the one-line sentence the bell dropdown
// shows. Pure/no data fetching, so it's usable from both the real header
// and a mock-data preview — same reasoning as SiteNewsPanel/
// ForumActivityPanel being presentational.
export function describeNotification(notification: NotificationWithActor): string {
  const actor = notification.actorName ?? "Someone";

  switch (notification.type) {
    case "dm":
      return `${actor} sent you a message`;
    case "forum_reply":
      return `${actor} replied to "${notification.target_label ?? "your thread"}"`;
    case "trade_offer":
      return `${actor} sent you a trade offer`;
    case "trade_response":
      return notification.target_label === "completed"
        ? `${actor} accepted your trade offer`
        : `${actor} declined your trade offer`;
    case "marketplace_sold":
      return notification.target_label
        ? `Your listing for ${notification.target_label} sold`
        : "Your listing sold";
    case "marketplace_expired":
      return notification.target_label
        ? `Your listing for ${notification.target_label} expired unsold`
        : "Your listing expired unsold";
    case "ban_issued":
      return notification.target_label
        ? `You've received a ${notification.target_label} ban`
        : "You've received a ban";
    case "report_filed":
      return `${actor} filed a new report`;
    default:
      return "New notification";
  }
}
