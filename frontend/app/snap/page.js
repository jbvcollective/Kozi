import RequireAuth from "@/components/RequireAuth";

export default function SnapPage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-[1600px] px-8 pb-32 pt-24 text-center md:px-12">
        <p className="text-zinc-500">Snap coming soon.</p>
      </div>
    </RequireAuth>
  );
}
