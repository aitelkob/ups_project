import DeBagMetricsDashboard from "@/components/debag-metrics-dashboard";

export default function Home() {
  const pinRequired = Boolean(process.env.APP_PIN?.trim());
  return <DeBagMetricsDashboard pinRequired={pinRequired} />;
}
