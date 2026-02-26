import PinForm from "@/components/pin-form";

type PinPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function PinPage({ searchParams }: PinPageProps) {
  const resolved = await searchParams;
  const nextPath = resolved.next || "/documents";
  return <PinForm nextPath={nextPath} />;
}
