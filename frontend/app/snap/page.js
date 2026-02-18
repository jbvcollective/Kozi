import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";

export default function SnapPage() {
  return (
    <RequireAuth>
      <div className="mx-auto flex min-h-[60vh] max-w-[1600px] flex-col items-center justify-center px-8 pb-32 pt-24 text-center md:px-12">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          Kozi Snap
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-primary">Coming soon</p>
        <p className="mt-4 max-w-lg text-muted">
          Concierge moving and logistics — white-glove relocation services.
          Get help packing, moving, and settling into your new home, all coordinated in one place.
        </p>
        <Link
          href="/explore"
          className="btn-primary mt-8 inline-block rounded-xl px-6 py-3 text-sm font-bold"
        >
          Explore listings
        </Link>
      </div>
    </RequireAuth>
  );
}
