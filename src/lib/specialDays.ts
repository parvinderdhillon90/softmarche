export interface SpecialDay {
  date: string;
  name: string;
  category: "international" | "indian" | "muslim" | "sikh" | "christian";
  relevance?: string;
}

const SPECIAL_DAYS: SpecialDay[] = [
  { date: "2026-01-01", name: "New Year's Day", category: "international", relevance: "New Year celebrations, welcome packages, festive menus" },
  { date: "2026-01-06", name: "Guru Gobind Singh Jayanti", category: "sikh", relevance: "Sikh heritage content" },
  { date: "2026-01-13", name: "Lohri", category: "indian", relevance: "Bonfire nights, traditional Punjabi cuisine" },
  { date: "2026-01-14", name: "Makar Sankranti", category: "indian", relevance: "Harvest festival, kite flying events, til-gul specials" },
  { date: "2026-01-26", name: "Republic Day", category: "indian", relevance: "Patriotic content, national pride posts" },
  { date: "2026-02-14", name: "Valentine's Day", category: "international", relevance: "Romantic dining, couple packages, candlelit experiences" },
  { date: "2026-03-22", name: "Holi", category: "indian", relevance: "Festival of colours, special Holi brunches, themed events" },
  { date: "2026-03-30", name: "Eid ul-Fitr (approx)", category: "muslim", relevance: "Iftar gatherings, festive celebration packages" },
  { date: "2026-04-02", name: "Easter", category: "christian", relevance: "Easter brunch, egg hunts for families" },
  { date: "2026-04-14", name: "Baisakhi", category: "sikh", relevance: "Punjabi New Year, cultural celebrations, folk dance" },
  { date: "2026-04-14", name: "Tamil New Year", category: "indian", relevance: "South Indian cultural content" },
  { date: "2026-05-11", name: "Mother's Day", category: "international", relevance: "Special brunch packages, floral decor, gift vouchers" },
  { date: "2026-06-07", name: "Eid ul-Adha (approx)", category: "muslim", relevance: "Festive celebration, special feast menus" },
  { date: "2026-06-15", name: "Father's Day", category: "international", relevance: "Special dining experiences, curated menus for dads" },
  { date: "2026-06-21", name: "International Yoga Day", category: "international", relevance: "Wellness packages, yoga sessions, spa promotions" },
  { date: "2026-07-07", name: "World Chocolate Day", category: "international", relevance: "Special dessert menus, chocolate-themed posts" },
  { date: "2026-08-15", name: "Independence Day", category: "indian", relevance: "Patriotic content, tricolour-themed specials, flag hoisting" },
  { date: "2026-08-21", name: "Janmashtami (approx)", category: "indian", relevance: "Krishna Jayanti, dahi handi events, festive decor" },
  { date: "2026-09-27", name: "World Tourism Day", category: "international", relevance: "Showcase your property, travel inspiration, special deals" },
  { date: "2026-10-01", name: "International Coffee Day", category: "international", relevance: "Coffee specials, café promotions, behind-the-scenes brewing content" },
  { date: "2026-10-02", name: "Gandhi Jayanti", category: "indian", relevance: "National holiday, values-driven content" },
  { date: "2026-10-16", name: "World Food Day", category: "international", relevance: "Culinary content, chef spotlights, signature dish reveals" },
  { date: "2026-10-29", name: "Dussehra (approx)", category: "indian", relevance: "Victory of good over evil, festive season kickoff" },
  { date: "2026-11-08", name: "Diwali (approx)", category: "indian", relevance: "Festival of lights — biggest opportunity for hotel content: décor, special menus, gifting" },
  { date: "2026-11-09", name: "Guru Nanak Jayanti", category: "sikh", relevance: "Sikh New Year, langar events, spiritual content" },
  { date: "2026-11-14", name: "Children's Day", category: "indian", relevance: "Family packages, kids' activities, fun menus" },
  { date: "2026-12-24", name: "Christmas Eve", category: "christian", relevance: "Christmas dinners, midnight mass packages, festive buffet" },
  { date: "2026-12-25", name: "Christmas Day", category: "christian", relevance: "Holiday packages, Christmas brunch, Santa appearances" },
  { date: "2026-12-31", name: "New Year's Eve", category: "international", relevance: "NYE gala dinners, countdown parties, room packages" },
  // 2027
  { date: "2027-01-01", name: "New Year's Day", category: "international", relevance: "New Year celebrations, welcome packages" },
  { date: "2027-01-14", name: "Makar Sankranti", category: "indian", relevance: "Harvest festival, traditional sweets" },
  { date: "2027-01-26", name: "Republic Day", category: "indian", relevance: "National holiday" },
  { date: "2027-02-14", name: "Valentine's Day", category: "international", relevance: "Romantic dining, couple getaway packages" },
];

const CATEGORY_EMOJI: Record<SpecialDay["category"], string> = {
  international: "🌍",
  indian: "🇮🇳",
  muslim: "☪️",
  sikh: "🔵",
  christian: "✝️",
};

const CATEGORY_LABEL: Record<SpecialDay["category"], string> = {
  international: "International",
  indian: "Indian",
  muslim: "Muslim",
  sikh: "Sikh",
  christian: "Christian",
};

export function getSpecialDaysForMonth(year: number, month: number): SpecialDay[] {
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}-`;
  return SPECIAL_DAYS.filter((d) => d.date.startsWith(prefix));
}

export { CATEGORY_EMOJI, CATEGORY_LABEL };
