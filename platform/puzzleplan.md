# Landing Page UI Specification: The Puzzle Layout

## 1. Architectural Overview
This document outlines the technical and design specifications for a fully responsive landing page utilizing a unique "interlocking puzzle piece" UI metaphor. The layout transitions from a 3-column desktop grid to a single-column mobile view, dynamically adjusting the puzzle connection points to maintain the visual metaphor across breakpoints.

## 2. Color System & Theming
The project utilizes a strict two-theme system, shifting between a deep, high-contrast dark mode and a crisp, architectural light mode. 

### Accent Colors (Persistent across both modes)
* Primary Accent 1: `#1274ec`
* Primary Accent 2: `#074ba0`
* Highlight Accent: `#ff5400`

### Dark Mode ("Void" Palette)
* **Background Base:** `#0B0F14`
* **Surface (Standard Cards/Projects):** `#161B22`
* **Elevated (Admin/Settings):** `#21262D`
* **Entities (Rows/Questions):** `#1C2128`
* **Primary Text:** `#F0F6FC`
* **Secondary Text:** `#8B949E`
* **Interactive Hover Effect:** Neon glow `box-shadow: 0 0 8px #1274ec, 0 0 20px #1274ec;` applied to buttons and active states.

### Light Mode ("Paper" Palette)
* **Background Base:** `#F8FAFC`
* **Surface (Standard Cards/Projects):** `#FFFFFF`
* **Elevated (Admin/Settings):** `#F1F5F9`
* **Entities (Rows/Questions):** `#E2E8F0`
* **Primary Text:** `#0F172A`
* **Secondary Text:** `#64748B`
* **Interactive Hover Effect:** Soft elevation shadow without neon properties.

## 3. The Puzzle Piece Mechanism (CSS Pseudo-Elements)
To avoid rigid SVG masks, the puzzle interlocking effect is driven purely by CSS pseudo-elements, allowing content to flow naturally while maintaining physical connection metaphors.

### Core Logic (Desktop - Horizontal Flow)
Each puzzle entity is a standard container (`overflow: visible`) with:
* **The Tab (`::after`):** A colored circle protruding from the right edge (`top: 50%`, `right: -[half size]`). Matches the container's background color.
* **The Socket (`::before`):** A circle "cutout" on the left edge (`top: 50%`, `left: -[half size]`). Matches the *parent section's* background color to create the illusion of negative space.
* Entities utilize negative margins (`margin-right: -10px`) to overlap perfectly.

### Responsive Logic (Mobile - Vertical Flow)
At `max-width: 768px`, the grid collapses to 1 column. The directional flow of the puzzle must rotate 90 degrees:
* Horizontal margins reset; negative `margin-bottom` applied to stack elements.
* **Tabs (`::after`)** move to the bottom edge (`left: 50%`, `bottom: -[half size]`).
* **Sockets (`::before`)** move to the top edge (`left: 50%`, `top: -[half size]`).
* *Exceptions:* The absolute first piece on the page has `::before { display: none; }`. The absolute final piece (footer) has `::after { display: none; }`.

## 4. Specific Component Requirements

### Language Toggle Button
* Must be a direct toggle button, **not a dropdown**.
* Displays `EN` when the active language is English, and `TR` when Turkish.
* On hover, it must smoothly display a tooltip reading: `"Change Language - Dil Değiştir"`.

### Universal Hover Animations
* All interactive elements and individual puzzle pieces must feature a transition: `transition: all 0.2s ease-in-out;`
* Hover state triggers a subtle physical lift: `transform: scale(1.05);`
* Hover state must trigger the neon glow in Dark Mode, ensuring the glow applies to *both* the main container body and the `::after` tab extension so the whole puzzle shape glows seamlessly.

## 5. Layout Structure (As per Excalidraw Wireframe)
* **Top Row (Header):** 3 puzzle pieces connecting horizontally (Logo -> Config/Language Toggle -> Sign In).
* **Hero Section:** Large featured piece for "CustomERP", spanning columns as needed to draw focus.
* **Process Flow ("Three Simple Steps"):** A strict 3-piece horizontal chain (Step 1 -> Step 2 -> Step 3).
* **Continuity:** The system must continue vertically down the DOM, allowing endless scroll integration until the final Footer piece caps the sequence.