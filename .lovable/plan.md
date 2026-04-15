

# Plan: Claude Briefing Document Genereren

Ik ga een compleet briefing document aanmaken als Markdown bestand in `/mnt/documents/` dat je kunt delen met Claude. Dit document bevat alles wat Claude moet weten om het project verder te ontwikkelen.

## Wat het document bevat

### 1. Project Visie & Doel
- AutoCity: Automotive Market Intelligence & Taxation Platform
- Gaspedaal.nl als "discovery engine" voor de Nederlandse tweedehands automarkt
- Doel: 100% betrouwbare voertuigherkenning + taxatie-engine
- AI als "Bounded Advisor" (P10-P90 statistische grenzen)

### 2. Tech Stack
- Frontend: React 18 + Vite + Tailwind + TypeScript + shadcn/ui
- Backend: Supabase (Lovable Cloud) - Edge Functions, DB, Auth
- Scraping: Firecrawl API (v1/v2)
- Data: PostgreSQL via Supabase

### 3. Architectuur Overzicht
- Alle pagina's/routes (Dashboard, Listings, Valuation, Dealers, Admin, etc.)
- DataSourceProvider (mock/db/api switch)
- Edge Functions: gaspedaal-discovery, debug-gaspedaal, rdw-lookup, valuate-vehicle, etc.
- Database tabellen: listings, raw_listings, scraper_jobs, scraper_configs, vehicle_events, etc.

### 4. Scraper Status - Wat Werkt & Wat Niet
- **WERKT**: Index page scraping van Gaspedaal (parseIndexPageListings), HTML sanitizing, deduplicatie (fingerprint v2, dealer-scoped), lifecycle tracking, credit budget systeem, safety limits
- **WERKT NIET**: Detail pagina links ophalen. De portal links (AutoTrack, Dealersite, etc.) zitten in een dynamische modal op Gaspedaal die niet via Firecrawl te openen is
- Geprobeerde strategieën die FAALDEN: redirect API patterns, cookie handshake, Firecrawl Actions click, __NEXT_DATA__ parsing (SPA skeleton), modal trigger click
- Huidige fallback: AutoTrack portal search (zoek URL bouwen → scrape → match op prijs/jaar/km) - werkt maar kost extra credits

### 5. Het Kernprobleem (voor Claude)
- Gaspedaal is een Next.js SPA - de HTML bij eerste render is een skeleton zonder data
- Portal links verschijnen pas na klik op voertuig card in een modal/popup
- Firecrawl kan de modal niet openen (Element not found errors)
- We hebben GEEN toegang tot Gaspedaal's interne API
- Concurrenten (JP Cars, Indicata) gebruiken waarschijnlijk B2B data partnerships

### 6. Wat Nu Moet Gebeuren
- Een betrouwbare manier vinden om van Gaspedaal listing → externe portal detail URL te komen
- OF: Alternatieve strategie bedenken die niet afhankelijk is van Gaspedaal's modal
- Detail data (opties, beschrijving, kenteken) is essentieel voor de taxatie-engine

### 7. Codebase Structuur
- Alle relevante bestanden en hun functie
- Database schema referentie
- Edge function overzicht

## Technische Details
Het document wordt gegenereerd als `/mnt/documents/claude-briefing-autocity.md` - een enkel Markdown bestand dat je kunt uploaden naar Claude.ai Projects of kunt gebruiken als context voor Claude Code.

## Bestanden die NIET gewijzigd worden
Geen codewijzigingen - alleen een document genereren.

