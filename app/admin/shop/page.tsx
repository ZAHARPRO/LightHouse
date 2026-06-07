import { getShopSettings, getAllShopItems, getAllPromoCodes } from "@/actions/shop";
import AdminShopClient from "./AdminShopClient";

export default async function AdminShopPage() {
  const [settings, items, promoCodes] = await Promise.all([
    getShopSettings(),
    getAllShopItems(),
    getAllPromoCodes(),
  ]);

  return <AdminShopClient settings={settings} items={items} promoCodes={promoCodes} />;
}
