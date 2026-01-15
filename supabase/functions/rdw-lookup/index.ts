import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RdwVehicle {
  kenteken: string;
  merk: string;
  handelsbenaming: string;
  eerste_kleur: string;
  aantal_deuren?: string;
  datum_eerste_toelating: string;
  catalogusprijs?: string;
  vermogen_motor_pk?: string;
  aantal_zitplaatsen?: string;
}

interface RdwFuel {
  kenteken: string;
  brandstof_omschrijving: string;
}

interface RdwTechnisch {
  kenteken: string;
  nettomaximumvermogen?: string;
}

type DataSource = 'rdw' | 'inferred' | 'missing';

interface VehicleField<T> {
  value: T;
  source: DataSource;
  confidence?: number;
  note?: string;
}

function sanitizePlate(plate: string): string {
  return plate.replace(/[-\s]/g, '').toUpperCase();
}

function parseYear(dateStr: string): number {
  if (dateStr && dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4), 10);
  }
  return new Date().getFullYear();
}

function mapFuelType(rdwFuel: string): string {
  const fuelMap: Record<string, string> = {
    'benzine': 'Benzine',
    'diesel': 'Diesel',
    'elektriciteit': 'Elektrisch',
    'lpg': 'LPG',
    'waterstof': 'Waterstof',
    'cng': 'CNG',
  };
  const lower = (rdwFuel || '').toLowerCase();
  return fuelMap[lower] || rdwFuel || 'Onbekend';
}

// Model-specific body type overrides for known models
const BODY_TYPE_OVERRIDES: Record<string, string> = {
  'ioniq5': 'SUV',
  'ioniq 5': 'SUV',
  'ioniq6': 'Sedan',
  'ioniq 6': 'Sedan',
  'kona': 'SUV',
  'model 3': 'Sedan',
  'model s': 'Sedan',
  'model x': 'SUV',
  'model y': 'SUV',
  'id.3': 'Hatchback',
  'id.4': 'SUV',
  'id.5': 'SUV',
  'id.7': 'Sedan',
  'enyaq': 'SUV',
  'mustang mach-e': 'SUV',
  'mach-e': 'SUV',
  'e-tron': 'SUV',
  'q4 e-tron': 'SUV',
  'eqa': 'SUV',
  'eqb': 'SUV',
  'eqc': 'SUV',
  'eqs': 'Sedan',
  'ix': 'SUV',
  'ix3': 'SUV',
  'i4': 'Sedan',
  'i5': 'Sedan',
  'i7': 'Sedan',
  'polestar 2': 'Sedan',
  'ev6': 'SUV',
  'niro': 'SUV',
  'ariya': 'SUV',
  'leaf': 'Hatchback',
  'zoe': 'Hatchback',
  'megane e-tech': 'Hatchback',
  'born': 'Hatchback',
  'atto 3': 'SUV',
  'seal': 'Sedan',
  'dolphin': 'Hatchback',
};

function inferTransmission(model: string, fuelType: string): { value: string; source: DataSource; note?: string } {
  // Electric vehicles always have automatic-like transmission
  if (fuelType === 'Elektrisch') {
    return { 
      value: 'Automaat', 
      source: 'inferred', 
      note: 'Elektrische voertuigen hebben geen traditionele versnellingsbak' 
    };
  }
  
  // Hybrid vehicles are usually automatic
  if (fuelType.toLowerCase().includes('hybride')) {
    return { 
      value: 'Automaat', 
      source: 'inferred', 
      note: 'Hybride voertuigen zijn meestal automaat' 
    };
  }
  
  // Check keywords for other fuel types
  const autoKeywords = ['automaat', 'aut', 'dct', 'dsg', 'cvt', 'tiptronic', 'steptronic', 'pdk', 's-tronic', 'multitronic', 'edc'];
  const manualKeywords = ['handgeschakeld', 'manual', '5-bak', '6-bak'];
  const modelLower = model.toLowerCase();
  
  for (const keyword of autoKeywords) {
    if (modelLower.includes(keyword)) {
      return { value: 'Automaat', source: 'inferred', note: `Afgeleid uit modelnaam (${keyword})` };
    }
  }
  
  for (const keyword of manualKeywords) {
    if (modelLower.includes(keyword)) {
      return { value: 'Handgeschakeld', source: 'inferred', note: `Afgeleid uit modelnaam (${keyword})` };
    }
  }
  
  // If we can't determine, return missing so user can select
  return { value: '', source: 'missing', note: 'Transmissie kon niet worden bepaald' };
}

function inferBodyType(model: string, doors: number): { value: string; source: DataSource; note?: string } {
  const modelLower = model.toLowerCase();
  
  // Check model-specific overrides first
  for (const [key, bodyType] of Object.entries(BODY_TYPE_OVERRIDES)) {
    if (modelLower.includes(key)) {
      return { value: bodyType, source: 'inferred', note: `Gecorrigeerd voor ${model}` };
    }
  }
  
  // Existing keyword-based logic
  if (modelLower.includes('cabrio') || modelLower.includes('roadster') || modelLower.includes('spider')) {
    return { value: 'Cabrio', source: 'inferred' };
  }
  if (modelLower.includes('coupe') || modelLower.includes('coupé')) {
    return { value: 'Coupé', source: 'inferred' };
  }
  if (modelLower.includes('touring') || modelLower.includes('avant') || modelLower.includes('variant') || 
      modelLower.includes('break') || modelLower.includes('estate') || modelLower.includes('wagon') ||
      modelLower.includes('kombi') || modelLower.includes('sw') || modelLower.includes('sport wagon') ||
      modelLower.includes('sportwagon')) {
    return { value: 'Stationwagon', source: 'inferred' };
  }
  if (modelLower.includes('suv') || modelLower.includes('crossover') || modelLower.includes('x-drive') ||
      modelLower.includes('quattro') || modelLower.includes('4matic') || modelLower.includes('allroad') ||
      modelLower.includes('cross')) {
    return { value: 'SUV', source: 'inferred' };
  }
  if (modelLower.includes('mpv') || modelLower.includes('van') || modelLower.includes('space') ||
      modelLower.includes('scenic') || modelLower.includes('touran') || modelLower.includes('sharan')) {
    return { value: 'MPV', source: 'inferred' };
  }
  
  // Door-based inference (less confident)
  if (doors === 2 || doors === 3) {
    return { value: 'Coupé', source: 'inferred', note: 'Afgeleid uit aantal deuren' };
  }
  if (doors >= 5) {
    return { value: 'Hatchback', source: 'inferred', note: 'Afgeleid uit aantal deuren' };
  }
  
  return { value: 'Sedan', source: 'inferred', note: 'Standaard aanname' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { licensePlate } = await req.json();
    
    if (!licensePlate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kenteken is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitized = sanitizePlate(licensePlate);
    console.log(`Looking up plate: ${sanitized}`);

    // Fetch basic vehicle data
    const vehicleUrl = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${sanitized}`;
    const vehicleResponse = await fetch(vehicleUrl);
    
    if (!vehicleResponse.ok) {
      throw new Error(`RDW API error: ${vehicleResponse.status}`);
    }

    const vehicleData: RdwVehicle[] = await vehicleResponse.json();
    
    if (!vehicleData || vehicleData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kenteken niet gevonden' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vehicle = vehicleData[0];

    // Fetch fuel data
    const fuelUrl = `https://opendata.rdw.nl/resource/8ys7-d773.json?kenteken=${sanitized}`;
    const fuelResponse = await fetch(fuelUrl);
    let fuelType = 'Onbekend';
    let fuelSource: DataSource = 'missing';
    
    if (fuelResponse.ok) {
      const fuelData: RdwFuel[] = await fuelResponse.json();
      if (fuelData && fuelData.length > 0) {
        fuelType = mapFuelType(fuelData[0].brandstof_omschrijving);
        fuelSource = 'rdw';
      }
    }

    // Fetch technical data for power (kW)
    let hp = vehicle.vermogen_motor_pk ? parseInt(vehicle.vermogen_motor_pk, 10) : undefined;
    let kw = hp ? Math.round(hp * 0.7355) : undefined;
    let powerSource: DataSource = hp ? 'rdw' : 'missing';
    
    // Try additional endpoint for electric vehicles (nettomaximumvermogen in kW)
    if (!hp || fuelType === 'Elektrisch') {
      try {
        const technischeUrl = `https://opendata.rdw.nl/resource/vezc-m2t6.json?kenteken=${sanitized}`;
        const technischeResponse = await fetch(technischeUrl);
        
        if (technischeResponse.ok) {
          const technischeData: RdwTechnisch[] = await technischeResponse.json();
          if (technischeData?.[0]?.nettomaximumvermogen) {
            kw = Math.round(parseFloat(technischeData[0].nettomaximumvermogen));
            hp = Math.round(kw / 0.7355);
            powerSource = 'rdw';
            console.log(`Found power from technical data: ${kw} kW / ${hp} PK`);
          }
        }
      } catch (e) {
        console.log('Could not fetch technical data for power');
      }
    }

    const doors = vehicle.aantal_deuren ? parseInt(vehicle.aantal_deuren, 10) : 4;
    const transmission = inferTransmission(vehicle.handelsbenaming || '', fuelType);
    const bodyType = inferBodyType(vehicle.handelsbenaming || '', doors);

    const result = {
      success: true,
      vehicle: {
        licensePlate: sanitized,
        make: {
          value: vehicle.merk || 'Onbekend',
          source: vehicle.merk ? 'rdw' : 'missing',
        },
        model: {
          value: vehicle.handelsbenaming || 'Onbekend',
          source: vehicle.handelsbenaming ? 'rdw' : 'missing',
        },
        year: {
          value: parseYear(vehicle.datum_eerste_toelating),
          source: vehicle.datum_eerste_toelating ? 'rdw' : 'missing',
        },
        fuelType: {
          value: fuelType,
          source: fuelSource,
        },
        transmission: transmission,
        bodyType: bodyType,
        power: hp && kw ? {
          value: { hp, kw },
          source: powerSource,
        } : {
          value: null,
          source: 'missing' as DataSource,
          note: 'Vermogen niet beschikbaar in RDW data',
        },
        color: {
          value: vehicle.eerste_kleur || null,
          source: vehicle.eerste_kleur ? 'rdw' : 'missing',
        },
        doors: {
          value: doors,
          source: vehicle.aantal_deuren ? 'rdw' : 'inferred',
        },
      },
    };

    console.log('RDW lookup result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('RDW lookup error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
