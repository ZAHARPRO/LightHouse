export type PlanType = "BASIC" | "PRO" | "ELITE";

export const PLANS = {
  BASIC: {
    name: "Basic",
    price: 4.99,
    features: [
      "HD video quality",
      "5 creator subscriptions",
      "Standard chat access",
      "10 reward points / month",
    ],
  },
  PRO: {
    name: "Pro",
    price: 12.99,
    features: [
      "4K video quality",
      "Unlimited subscriptions",
      "Priority chat badge",
      "50 reward points / month",
      "Early access to content",
      "Download videos",
    ],
  },
  ELITE: {
    name: "Elite",
    price: 24.99,
    features: [
      "Everything in Pro",
      "Exclusive Elite badge",
      "150 reward points / month",
      "Direct creator messaging",
      "Monthly merchandise discount",
      "Ad-free experience",
    ],
  },
};
