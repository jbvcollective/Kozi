# Responsive design

The site is built to work on **phone**, **tablet**, and **desktop**. These guidelines keep layouts from jumbling on smaller screens.

## Breakpoints (Tailwind)

- **Default** – phones (portrait)
- **sm** (640px+) – large phones / small tablets
- **md** (768px+) – tablets; desktop sidebar appears
- **lg** (1024px+) – laptops; filters sit beside grid on Explore
- **xl** (1280px+) – desktops
- **2xl** (1536px+) – large desktops

## Layout

- **Main content** has `min-w-0` and `overflow-x-hidden` so flex children don’t force horizontal scroll.
- **Safe areas** – `safe-top`, `safe-left`, `safe-right` are used for notched devices.
- **Sidebar** – Fixed top bar + hamburger on mobile (`md:hidden`); icon rail on desktop (`hidden md:flex`). Main content uses `pt-14` on mobile, `md:pl-[72px]` (lg/xl larger) on desktop.

## Typography

- Headings use responsive sizes, e.g. `text-2xl sm:text-3xl md:text-4xl`.
- Long titles use `break-words` so they wrap instead of overflowing.

## Touch targets

- Buttons and nav items that might be used on touch devices use `min-h-[44px]` (or equivalent) so they’re at least 44px tall for touch.

## Grids and filters

- **Explore** – 1 column on phones, 2 from `sm`, 3 from `lg`. Filter sidebar is full width above the grid on small screens; it sits beside the grid from `lg`.
- **FilterSidebar** – Visible at all breakpoints when “Filters” is open; width is full on mobile, `lg:w-64 xl:w-72` on desktop.

## Tables

- Wide tables (e.g. Listing History) live in an `overflow-x-auto` wrapper so they scroll horizontally on small screens instead of breaking the layout.

## Padding

- Page containers use stepped padding: `px-4 sm:px-5 md:px-6 lg:px-8 xl:px-12` (and similar for vertical) so spacing scales with viewport.
