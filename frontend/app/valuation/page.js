import RequireAuth from "@/components/RequireAuth";
import HomeValuation from "@/components/HomeValuation";

export default function ValuationPage() {
  return (
    <RequireAuth>
      <HomeValuation />
    </RequireAuth>
  );
}
