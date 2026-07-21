import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { BarChart3, Bell, BellRing, CalendarDays, ClipboardList, ExternalLink, History, Home, KeyRound, ListChecks, Lock, PlugZap, Radar, Settings, ShieldCheck, ShoppingCart, Star, Store, Tags, WandSparkles } from "@lucide/vue";
import AnalyticsPage from "@/pages/AnalyticsPage.vue";
import AlertsPage from "@/pages/AlertsPage.vue";
import CartQueuePage from "@/pages/CartQueuePage.vue";
import HistoryPage from "@/pages/HistoryPage.vue";
import HomePage from "@/pages/HomePage.vue";
import LiveFindsPage from "@/pages/LiveFindsPage.vue";
import LoginPage from "@/pages/LoginPage.vue";
import ManualStoreLinksPage from "@/pages/ManualStoreLinksPage.vue";
import MSRPMappingPage from "@/pages/MSRPMappingPage.vue";
import NotificationHistoryPage from "@/pages/NotificationHistoryPage.vue";
import PriceRulesPage from "@/pages/PriceRulesPage.vue";
import RadarRulesPage from "@/pages/RadarRulesPage.vue";
import ReleaseCalendarPage from "@/pages/ReleaseCalendarPage.vue";
import SecurityPage from "@/pages/SecurityPage.vue";
import ScanSettingsPage from "@/pages/ScanSettingsPage.vue";
import StoreAdaptersPage from "@/pages/StoreAdaptersPage.vue";
import StoreSafetyMatrixPage from "@/pages/StoreSafetyMatrixPage.vue";
import StoresPage from "@/pages/StoresPage.vue";
import TodayActionListPage from "@/pages/TodayActionListPage.vue";
import WishlistPage from "@/pages/WishlistPage.vue";

export const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/today", label: "Today's Action List", icon: ClipboardList },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/stores", label: "Stores", icon: Store },
  { path: "/store-adapters", label: "Store Adapters", icon: PlugZap },
  { path: "/store-safety-matrix", label: "Store Safety Matrix", icon: ShieldCheck },
  { path: "/scan-settings", label: "Scan Settings", icon: Settings },
  { path: "/msrp-mapping", label: "MSRP Mapping", icon: WandSparkles },
  { path: "/wishlist", label: "Wishlist", icon: Star },
  { path: "/manual-store-links", label: "Manual Store Links", icon: ExternalLink },
  { path: "/release-calendar", label: "Release Calendar", icon: CalendarDays },
  { path: "/radar-rules", label: "Radar Rules", icon: Radar },
  { path: "/price-rules", label: "Price Rules", icon: Tags },
  { path: "/live-finds", label: "Live Finds", icon: ListChecks },
  { path: "/cart-queue", label: "Cart Queue", icon: ShoppingCart },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/notifications", label: "Notification History", icon: BellRing },
  { path: "/history", label: "History", icon: History },
  { path: "/security", label: "Security", icon: Lock }
];

const routes: RouteRecordRaw[] = [
  { path: "/login", component: LoginPage, meta: { public: true, title: "Login" } },
  { path: "/", component: HomePage, meta: { title: "Home" } },
  { path: "/today", component: TodayActionListPage, meta: { title: "Today's Action List" } },
  { path: "/analytics", component: AnalyticsPage, meta: { title: "Analytics" } },
  { path: "/stores", component: StoresPage, meta: { title: "Stores" } },
  { path: "/store-adapters", component: StoreAdaptersPage, meta: { title: "Store Adapters" } },
  { path: "/store-safety-matrix", component: StoreSafetyMatrixPage, meta: { title: "Store Safety Matrix" } },
  { path: "/scan-settings", component: ScanSettingsPage, meta: { title: "Scan Settings" } },
  { path: "/msrp-mapping", component: MSRPMappingPage, meta: { title: "MSRP Mapping" } },
  { path: "/wishlist", component: WishlistPage, meta: { title: "Wishlist" } },
  { path: "/manual-store-links", component: ManualStoreLinksPage, meta: { title: "Manual Store Links" } },
  { path: "/release-calendar", component: ReleaseCalendarPage, meta: { title: "Release Calendar" } },
  { path: "/radar-rules", component: RadarRulesPage, meta: { title: "Radar Rules" } },
  { path: "/price-rules", component: PriceRulesPage, meta: { title: "Price Rules" } },
  { path: "/live-finds", component: LiveFindsPage, meta: { title: "Live Finds" } },
  { path: "/cart-queue", component: CartQueuePage, meta: { title: "Cart Queue" } },
  { path: "/alerts", component: AlertsPage, meta: { title: "Alerts" } },
  { path: "/notifications", component: NotificationHistoryPage, meta: { title: "Notification History" } },
  { path: "/history", component: HistoryPage, meta: { title: "History" } },
  { path: "/security", component: SecurityPage, meta: { title: "Security", icon: KeyRound } }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});
