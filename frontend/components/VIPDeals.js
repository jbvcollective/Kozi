"use client";

import Link from "next/link";
import { MOCK_PERKS } from "@/constants/perks";

export default function VIPDeals({ properties = [], onSelectProperty }) {
  const propertyDeals = properties.filter(
    (p) => p?.originalPrice && p?.originalPrice > p?.price
  );

  return (
    <div className="mx-auto max-w-[1600px] animate-fade-in px-8 pb-32 pt-24 md:px-12">
      {/* Immersive Header */}
      <header className="mb-16 border-b border-gray-100 pb-12">
        <div className="max-w-4xl">
          <div className="mb-3 flex items-center space-x-3">
            <div className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">
              Privé Lifestyle Concierge
            </span>
          </div>
          <h1 className="mb-4 text-7xl font-black leading-none tracking-tighter md:text-9xl">
            Wonderland.
          </h1>
          <p className="max-w-2xl text-xl font-medium leading-tight text-gray-400 md:text-2xl">
            Exclusive access to boutique shopping, elite dining, and high-adrenaline entertainment.{" "}
            <span className="font-black text-black">Your membership is the key.</span>
          </p>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {/* BIG HERO: Entertainment / Wonderland */}
        <div className="group relative h-[500px] overflow-hidden rounded-[2.5rem] border border-gray-50 bg-gray-100 shadow-xl md:col-span-4 lg:col-span-4">
          <img
            src={MOCK_PERKS[1].image}
            alt="Wonderland"
            className="absolute inset-0 h-full w-full object-cover transition-all duration-1000 group-hover:rotate-1 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-10">
            <div className="space-y-3">
              <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                Featured Experience
              </span>
              <h2 className="text-5xl font-black tracking-tighter text-white md:text-7xl">
                {MOCK_PERKS[1].brand}
              </h2>
              <p className="max-w-md text-lg font-medium text-white/70">{MOCK_PERKS[1].offer}</p>
              <button
                type="button"
                className="mt-4 rounded-2xl bg-white px-10 py-4 font-black text-black shadow-2xl transition-all hover:scale-105 active:scale-95"
              >
                Claim VIP Pass
              </button>
            </div>
          </div>
        </div>

        {/* SIDE PERK: Dining */}
        <div className="group relative h-[500px] overflow-hidden rounded-[2.5rem] bg-black md:col-span-2 lg:col-span-2">
          <img
            src={MOCK_PERKS[0].image}
            alt="Dining"
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity duration-500 group-hover:opacity-80"
          />
          <div className="absolute inset-0 flex flex-col justify-end p-10 text-white">
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">
                Gastronomy
              </span>
              <h3 className="text-4xl font-black tracking-tighter">{MOCK_PERKS[0].brand}</h3>
              <p className="text-base font-bold leading-tight text-white/60">{MOCK_PERKS[0].offer}</p>
              <button
                type="button"
                className="w-full rounded-2xl border border-white/20 py-4 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white hover:text-black"
              >
                Priority Reservation
              </button>
            </div>
          </div>
        </div>

        {/* PROMINENT: THE WEEKLY DROP */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[3rem] bg-purple-600 p-10 text-white md:col-span-4 lg:col-span-3">
          <div className="relative z-10">
            <div className="mb-6 flex items-center space-x-2">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">
                Limited Release
              </span>
            </div>
            <h3 className="mb-4 text-5xl font-black leading-none tracking-tighter md:text-6xl">
              The Weekly Drop.
            </h3>
            <p className="mb-8 max-w-sm text-lg font-medium text-white/80">
              Every Tuesday, we unlock exclusive shopping credits and private sales for Canada&apos;s
              finest luxury retailers.
            </p>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                className="rounded-2xl bg-white px-10 py-4 text-sm font-black text-purple-600 shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                Set Drop Alert
              </button>
              <span className="text-xs font-black uppercase tracking-widest opacity-40">
                Next Drop: 14:02:55
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-16 -right-16 opacity-10 transition-transform duration-700 group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-80 w-80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          </div>
        </div>

        {/* SHOPPING: Saint Laurent */}
        <div className="group flex flex-col justify-between rounded-[3rem] border border-gray-100 bg-gray-50 p-10 transition-all duration-500 hover:bg-black hover:text-white md:col-span-2 lg:col-span-3">
          <div className="space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-sm transition-all group-hover:rotate-6 group-hover:bg-purple-600 group-hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 group-hover:text-white/40">
                Haute Couture
              </span>
              <h3 className="mb-2 text-4xl font-black tracking-tighter">{MOCK_PERKS[2].brand}</h3>
              <p className="text-lg font-medium leading-tight text-gray-500 group-hover:text-white/60">
                {MOCK_PERKS[2].offer}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="border-b-2 border-transparent pt-2 text-[11px] font-black uppercase tracking-[0.2em] transition-all group-hover:border-white"
          >
            Unlock Member Code
          </button>
        </div>
      </div>

      {/* Real Estate Opportunities: Privé Listings */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between border-b border-gray-100 pb-4 md:flex-row md:items-baseline">
          <div className="flex flex-col">
            <h2 className="text-4xl font-black tracking-tight">Privé Listings.</h2>
            <p className="font-medium text-gray-400">Under-market assets curated for your portfolio.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
            {propertyDeals.length} Active Offers
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {propertyDeals.slice(0, 4).map((deal) => {
            const href = `/listings/${deal.id}`;
            return (
              <Link
                key={deal.id}
                href={href}
                className="group flex cursor-pointer flex-col space-y-2"
              >
                <div className="relative aspect-[1.4] overflow-hidden rounded-[2rem] border border-gray-50">
                  <img
                    src={deal.image || deal.images?.[0]}
                    alt={deal.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute bottom-4 right-4 rounded-xl bg-white px-3 py-1.5 shadow-xl">
                    <div className="text-[9px] font-black uppercase leading-none tracking-tighter text-gray-300 line-through">
                      ${(deal.originalPrice ?? 0).toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-sm font-black leading-none text-purple-600">
                      ${(deal.price ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="px-1">
                  <h4 className="truncate text-base font-black transition-colors group-hover:text-purple-600">
                    {deal.title}
                  </h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {deal.location}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer Concierge Action */}
      <footer className="mt-20 border-t border-gray-50 pt-16 text-center">
        <div className="mx-auto max-w-xl space-y-8">
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-gray-300">
            Lumina Concierge Privé
          </p>
          <h4 className="text-3xl font-black leading-none tracking-tight">
            Looking for something specific?
          </h4>
          <p className="font-medium text-gray-400">
            Our lifestyle managers can source sold-out tickets, private table access, or off-market
            items globally.
          </p>
          <button
            type="button"
            className="rounded-2xl bg-black px-12 py-5 text-lg font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            Contact Lifestyle Manager
          </button>
        </div>
      </footer>
    </div>
  );
}
