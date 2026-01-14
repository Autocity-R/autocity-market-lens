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

function sanitizePlate(plate: string): string {
  return plate.replace(/[-\s]/g, '').toUpperCase();
}

function parseYear(dateStr: string): number {
  // Format: YYYYMMDD
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

function inferTransmission(model: string): string {
  const autoKeywords = ['automaat', 'aut', 'dct', 'dsg', 'cvt', 'tiptronic', 'steptronic', 'pdk'];
  const modelLower = model.toLowerCase();
  for (const keyword of autoKeywords) {
    if (modelLower.includes(keyword)) {
      return 'Automaat';
    }
  }
  return 'Handgeschakeld';
}

function inferBodyType(model: string, doors: number): string {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('cabrio') || modelLower.includes('roadster') || modelLower.includes('spider')) {
    return 'Cabrio';
  }
  if (modelLower.includes('coupe') || modelLower.includes('coupé')) {
    return 'Coupé';
  }
  if (modelLower.includes('touring') || modelLower.includes('avant') || modelLower.includes('variant') || 
      modelLower.includes('break') || modelLower.includes('estate') || modelLower.includes('wagon') ||
      modelLower.includes('kombi') || modelLower.includes('sw') || modelLower.includes('sport wagon')) {
    return 'Stationwagon';
  }
  if (modelLower.includes('suv') || modelLower.includes('crossover') || modelLower.includes('x-drive') ||
      modelLower.includes('quattro') || modelLower.includes('4matic') || modelLower.includes('allroad')) {
    return 'SUV';
  }
  if (modelLower.includes('mpv') || modelLower.includes('van') || modelLower.includes('space')) {
    return 'MPV';
  }
  
  if (doors === 2 || doors === 3) {
    return 'Coupé';
  }
  if (doors >= 5) {
    return 'Hatchback';
  }
  
  return 'Sedan';
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
    
    if (fuelResponse.ok) {
      const fuelData: RdwFuel[] = await fuelResponse.json();
      if (fuelData && fuelData.length > 0) {
        fuelType = mapFuelType(fuelData[0].brandstof_omschrijving);
      }
    }

    const doors = vehicle.aantal_deuren ? parseInt(vehicle.aantal_deuren, 10) : 4;
    const hp = vehicle.vermogen_motor_pk ? parseInt(vehicle.vermogen_motor_pk, 10) : undefined;
    const kw = hp ? Math.round(hp * 0.7355) : undefined;

    const result = {
      success: true,
      vehicle: {
        licensePlate: sanitized,
        make: vehicle.merk || 'Onbekend',
        model: vehicle.handelsbenaming || 'Onbekend',
        year: parseYear(vehicle.datum_eerste_toelating),
        fuelType,
        transmission: inferTransmission(vehicle.handelsbenaming || ''),
        bodyType: inferBodyType(vehicle.handelsbenaming || '', doors),
        power: hp && kw ? { hp, kw } : undefined,
        color: vehicle.eerste_kleur || undefined,
        doors,
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
