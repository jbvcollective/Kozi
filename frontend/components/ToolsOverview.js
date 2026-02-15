"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const tools = [
  {
    title: "VIP Deals",
    description: "Listings with price reductions — exclusive opportunities",
    href: "/vip",
    color: "bg-purple-600",
    buttonLabel: "Open",
  },
  {
    title: "Lumina Snap",
    description: "Concierge moving and logistics — white-glove relocation services",
    href: "/snap",
    color: "bg-black",
    buttonLabel: "Coming Soon",
  },
  {
    title: "What is my home worth?",
    description: "Get a free estimate for your property using Lumina AI",
    href: "/valuation",
    color: "bg-gray-100",
    textColor: "text-black",
    buttonLabel: "Open",
  },
];

export default function ToolsOverview() {
  const { user, openAuthModal, isProtectedPath } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-black text-foreground">Tools</h2>
        <p className="font-medium text-muted">
          VIP deals, white-glove logistics, and precision valuation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {tools.map((tool) => {
          const protectedAndGuest = isProtectedPath(tool.href) && !user;
          const className = `card-hover flex h-64 cursor-pointer flex-col justify-between rounded-2xl border border-border p-8 transition-premium ${tool.color} ${tool.textColor || "text-white"}`;
          const content = (
            <>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold leading-tight">{tool.title}</h3>
                <p className={`text-sm ${tool.textColor ? "text-muted" : "text-white/70"}`}>
                  {tool.description}
                </p>
              </div>
              <span
                className={`mt-auto self-start rounded-xl border px-6 py-2 text-sm font-bold transition-premium ${
                  tool.textColor ? "border-foreground text-foreground hover:bg-foreground hover:text-background" : "border-white text-white hover:bg-white hover:text-primary"
                }`}
              >
                {tool.buttonLabel}
              </span>
            </>
          );
          if (protectedAndGuest) {
            return (
              <button
                key={tool.title}
                type="button"
                onClick={() => openAuthModal(tool.href)}
                className={className}
              >
                {content}
              </button>
            );
          }
          return (
            <Link key={tool.title} href={tool.href} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
