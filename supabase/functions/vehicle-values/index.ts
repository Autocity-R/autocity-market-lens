import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete automotive makes database
const MAKES = [
  'Abarth', 'Acura', 'Alfa Romeo', 'Alpine', 'Aston Martin', 'Audi',
  'Bentley', 'BMW', 'Bugatti', 'Buick',
  'Cadillac', 'Chevrolet', 'Chrysler', 'Citroën', 'Cupra',
  'Dacia', 'Daewoo', 'Daihatsu', 'Dodge', 'DS',
  'Ferrari', 'Fiat', 'Fisker', 'Ford',
  'Genesis', 'GMC',
  'Honda', 'Hummer', 'Hyundai',
  'Infiniti', 'Isuzu',
  'Jaguar', 'Jeep',
  'Kia', 'Koenigsegg',
  'Lada', 'Lamborghini', 'Lancia', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Lucid', 'Lynk & Co',
  'Maserati', 'Maybach', 'Mazda', 'McLaren', 'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Morgan',
  'NIO', 'Nissan',
  'Oldsmobile', 'Opel',
  'Pagani', 'Peugeot', 'Polestar', 'Pontiac', 'Porsche',
  'RAM', 'Renault', 'Rivian', 'Rolls-Royce', 'Rover',
  'Saab', 'Seat', 'Škoda', 'Smart', 'SsangYong', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota',
  'Volkswagen', 'Volvo',
  'XPeng',
].sort();

// Models per make (most popular models)
const MODELS_BY_MAKE: Record<string, string[]> = {
  'Abarth': ['124 Spider', '500', '595', '695', 'Punto'],
  'Alfa Romeo': ['147', '156', '159', 'Brera', 'Giulia', 'Giulietta', 'MiTo', 'Spider', 'Stelvio', 'Tonale'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'e-tron GT', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'R8', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'RS Q8', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'SQ5', 'SQ7', 'SQ8', 'TT', 'TTS', 'TT RS'],
  'BMW': ['1 Serie', '2 Serie', '3 Serie', '4 Serie', '5 Serie', '6 Serie', '7 Serie', '8 Serie', 'i3', 'i4', 'i5', 'i7', 'i8', 'iX', 'iX1', 'iX3', 'M2', 'M3', 'M4', 'M5', 'M8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4'],
  'Citroën': ['Berlingo', 'C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C4 Picasso', 'C5', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'DS5', 'Jumpy', 'SpaceTourer', 'ë-C4'],
  'Cupra': ['Ateca', 'Born', 'Formentor', 'Leon', 'Tavascan', 'Terramar'],
  'Dacia': ['Dokker', 'Duster', 'Jogger', 'Logan', 'Sandero', 'Spring'],
  'DS': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 5', 'DS 7', 'DS 9'],
  'Fiat': ['124 Spider', '500', '500C', '500L', '500X', 'Bravo', 'Doblo', 'Ducato', 'Grande Punto', 'Panda', 'Punto', 'Tipo'],
  'Ford': ['B-Max', 'C-Max', 'EcoSport', 'Edge', 'Explorer', 'Fiesta', 'Focus', 'Galaxy', 'Ka', 'Ka+', 'Kuga', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Puma', 'Ranger', 'S-Max', 'Transit', 'Transit Custom'],
  'Honda': ['Accord', 'Civic', 'CR-V', 'e', 'HR-V', 'Jazz', 'NSX', 'ZR-V'],
  'Hyundai': ['Bayon', 'i10', 'i20', 'i30', 'i40', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Nexo', 'Santa Fe', 'Tucson'],
  'Jaguar': ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF', 'XJ'],
  'Jeep': ['Avenger', 'Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  'Kia': ['Carens', 'Ceed', 'e-Niro', 'EV6', 'EV9', 'Niro', 'Optima', 'Picanto', 'ProCeed', 'Rio', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Stonic', 'Venga', 'XCeed'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Evoque', 'Freelander', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar'],
  'Lexus': ['CT', 'ES', 'GS', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'UX'],
  'Mazda': ['2', '3', '5', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-80', 'MX-30', 'MX-5'],
  'Mercedes-Benz': ['A-Klasse', 'AMG GT', 'B-Klasse', 'C-Klasse', 'CL-Klasse', 'CLA', 'CLS', 'E-Klasse', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'G-Klasse', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Klasse', 'SL', 'SLK', 'SLS', 'V-Klasse', 'Vito'],
  'MG': ['4', '5', 'EHS', 'HS', 'Marvel R', 'MG4', 'ZS'],
  'Mini': ['Cabrio', 'Clubman', 'Cooper', 'Countryman', 'John Cooper Works', 'One', 'Paceman'],
  'Mitsubishi': ['ASX', 'Eclipse Cross', 'L200', 'Outlander', 'Pajero', 'Space Star'],
  'Nissan': ['Ariya', 'Juke', 'Leaf', 'Micra', 'Navara', 'Note', 'Pathfinder', 'Qashqai', 'Townstar', 'X-Trail'],
  'Opel': ['Adam', 'Astra', 'Combo', 'Corsa', 'Crossland', 'Grandland', 'Insignia', 'Meriva', 'Mokka', 'Movano', 'Vivaro', 'Zafira'],
  'Peugeot': ['108', '2008', '208', '3008', '308', '408', '5008', '508', 'Boxer', 'e-208', 'e-2008', 'e-308', 'Expert', 'Partner', 'Rifter', 'Traveller'],
  'Polestar': ['1', '2', '3', '4'],
  'Porsche': ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  'Renault': ['Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Kadjar', 'Kangoo', 'Koleos', 'Master', 'Megane', 'Megane E-Tech', 'Scenic', 'Talisman', 'Twingo', 'Twizy', 'Zoe'],
  'Seat': ['Alhambra', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Mii', 'Tarraco', 'Toledo'],
  'Škoda': ['Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Scala', 'Superb', 'Yeti'],
  'Smart': ['EQ forfour', 'EQ fortwo', 'forfour', 'fortwo'],
  'Subaru': ['BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Levorg', 'Outback', 'Solterra', 'WRX', 'XV'],
  'Suzuki': ['Alto', 'Baleno', 'Celerio', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Vitara'],
  'Tesla': ['Cybertruck', 'Model 3', 'Model S', 'Model X', 'Model Y'],
  'Toyota': ['Auris', 'Avensis', 'Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Corolla', 'Crown', 'GT86', 'Highlander', 'Hilux', 'Land Cruiser', 'Mirai', 'Prius', 'ProAce', 'RAV4', 'Supra', 'Yaris', 'Yaris Cross'],
  'Volkswagen': ['Amarok', 'Arteon', 'Beetle', 'Caddy', 'California', 'Caravelle', 'CC', 'Crafter', 'e-Golf', 'Golf', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz', 'Jetta', 'Multivan', 'Passat', 'Polo', 'Scirocco', 'Sharan', 'T-Cross', 'T-Roc', 'Taigo', 'Tiguan', 'Tiguan Allspace', 'Touareg', 'Touran', 'Transporter', 'Up!'],
  'Volvo': ['C30', 'C40', 'C70', 'EX30', 'EX90', 'S40', 'S60', 'S80', 'S90', 'V40', 'V50', 'V60', 'V70', 'V90', 'XC40', 'XC60', 'XC70', 'XC90'],
};

const FUEL_TYPES = [
  'Benzine',
  'Diesel',
  'Elektrisch',
  'Hybride',
  'Plug-in Hybride',
  'LPG',
  'CNG',
  'Waterstof',
];

const TRANSMISSIONS = [
  'Handgeschakeld',
  'Automaat',
  'Semi-automaat',
  'CVT',
];

const BODY_TYPES = [
  'Hatchback',
  'Sedan',
  'Stationwagon',
  'SUV',
  'Coupé',
  'Cabrio',
  'MPV',
  'Pick-up',
  'Bedrijfswagen',
];

// Valuable options database - organized by category
const OPTIONS_DATABASE = {
  performance: {
    label: 'Performance & Sport',
    options: [
      { value: 'amg_line', label: 'AMG Line', brands: ['Mercedes-Benz'] },
      { value: 'amg_pakket', label: 'AMG Pakket', brands: ['Mercedes-Benz'] },
      { value: 'm_sport', label: 'M Sport', brands: ['BMW'] },
      { value: 'm_pakket', label: 'M Pakket', brands: ['BMW'] },
      { value: 's_line', label: 'S Line', brands: ['Audi'] },
      { value: 'rs_line', label: 'RS Line', brands: ['Audi', 'Renault'] },
      { value: 'st_line', label: 'ST Line', brands: ['Ford'] },
      { value: 'r_line', label: 'R Line', brands: ['Volkswagen'] },
      { value: 'gti', label: 'GTI', brands: ['Volkswagen'] },
      { value: 'gtd', label: 'GTD', brands: ['Volkswagen'] },
      { value: 'gte', label: 'GTE', brands: ['Volkswagen'] },
      { value: 'r_design', label: 'R-Design', brands: ['Volvo'] },
      { value: 'fr', label: 'FR', brands: ['Seat', 'Cupra'] },
      { value: 'n_line', label: 'N Line', brands: ['Hyundai'] },
      { value: 'type_r', label: 'Type R', brands: ['Honda'] },
      { value: 'nismo', label: 'Nismo', brands: ['Nissan'] },
      { value: 'sport', label: 'Sport pakket', brands: [] },
      { value: 'sportonderstel', label: 'Sportonderstel', brands: [] },
      { value: 'sportuitlaat', label: 'Sportuitlaat', brands: [] },
    ],
  },
  comfort: {
    label: 'Comfort & Interieur',
    options: [
      { value: 'panoramadak', label: 'Panoramadak', brands: [] },
      { value: 'schuifdak', label: 'Schuifdak', brands: [] },
      { value: 'leder', label: 'Leder interieur', brands: [] },
      { value: 'alcantara', label: 'Alcantara interieur', brands: [] },
      { value: 'stoelverwarming', label: 'Stoelverwarming', brands: [] },
      { value: 'stoelventilatie', label: 'Stoelventilatie', brands: [] },
      { value: 'massagestoelen', label: 'Massage stoelen', brands: [] },
      { value: 'elektrische_stoelen', label: 'Elektrisch verstelbare stoelen', brands: [] },
      { value: 'geheugen_stoelen', label: 'Geheugen stoelen', brands: [] },
      { value: 'stuurverwarming', label: 'Stuurverwarming', brands: [] },
      { value: 'keyless', label: 'Keyless entry & start', brands: [] },
      { value: 'elektrische_achterklep', label: 'Elektrische achterklep', brands: [] },
      { value: 'soft_close', label: 'Soft-close deuren', brands: [] },
      { value: 'ambient_light', label: 'Ambient verlichting', brands: [] },
    ],
  },
  technology: {
    label: 'Technologie & Audio',
    options: [
      { value: 'matrix_led', label: 'Matrix LED koplampen', brands: [] },
      { value: 'laser', label: 'Laser koplampen', brands: ['BMW', 'Audi'] },
      { value: 'hud', label: 'Head-up display', brands: [] },
      { value: 'digitaal_dashboard', label: 'Digitaal dashboard', brands: [] },
      { value: 'groot_navigatie', label: 'Groot navigatiescherm', brands: [] },
      { value: 'harman_kardon', label: 'Harman Kardon audio', brands: [] },
      { value: 'bose', label: 'Bose audio', brands: [] },
      { value: 'bang_olufsen', label: 'Bang & Olufsen audio', brands: ['Audi'] },
      { value: 'burmester', label: 'Burmester audio', brands: ['Mercedes-Benz'] },
      { value: 'meridian', label: 'Meridian audio', brands: ['Land Rover', 'Jaguar'] },
      { value: 'naim', label: 'Naim audio', brands: ['Bentley'] },
      { value: 'apple_carplay', label: 'Apple CarPlay', brands: [] },
      { value: 'android_auto', label: 'Android Auto', brands: [] },
      { value: 'draadloos_laden', label: 'Draadloos telefoon laden', brands: [] },
    ],
  },
  safety: {
    label: 'Veiligheid & Rijhulp',
    options: [
      { value: 'acc', label: 'Adaptive cruise control', brands: [] },
      { value: 'lane_assist', label: 'Lane assist', brands: [] },
      { value: 'dodehoek', label: 'Dodehoek detectie', brands: [] },
      { value: 'nightvision', label: 'Nightvision', brands: [] },
      { value: 'camera_360', label: '360° camera', brands: [] },
      { value: 'achteruitrijcamera', label: 'Achteruitrijcamera', brands: [] },
      { value: 'park_assist', label: 'Park assist', brands: [] },
      { value: 'auto_parkeren', label: 'Automatisch parkeren', brands: [] },
      { value: 'verkeersbord', label: 'Verkeersbordherkenning', brands: [] },
      { value: 'noodrem', label: 'Automatische noodrem', brands: [] },
      { value: 'driver_assist', label: 'Driver assist pakket', brands: [] },
    ],
  },
  exterior: {
    label: 'Exterieur & Wielen',
    options: [
      { value: '18_inch', label: '18 inch velgen', brands: [] },
      { value: '19_inch', label: '19 inch velgen', brands: [] },
      { value: '20_inch', label: '20 inch velgen', brands: [] },
      { value: '21_inch', label: '21 inch velgen', brands: [] },
      { value: '22_inch', label: '22 inch velgen', brands: [] },
      { value: 'luchtvering', label: 'Luchtvering', brands: [] },
      { value: 'adaptief_onderstel', label: 'Adaptief onderstel', brands: [] },
      { value: 'trekhaak', label: 'Trekhaak', brands: [] },
      { value: 'privacy_glas', label: 'Privacy glas', brands: [] },
      { value: 'metallic', label: 'Metallic lak', brands: [] },
      { value: 'individual', label: 'Individual kleur', brands: ['BMW'] },
      { value: 'designo', label: 'Designo kleur', brands: ['Mercedes-Benz'] },
      { value: 'audi_exclusive', label: 'Audi Exclusive', brands: ['Audi'] },
    ],
  },
  packages: {
    label: 'Pakketten',
    options: [
      { value: 'winterpakket', label: 'Winterpakket', brands: [] },
      { value: 'business', label: 'Business pakket', brands: [] },
      { value: 'comfort_pakket', label: 'Comfort pakket', brands: [] },
      { value: 'launch_edition', label: 'Launch Edition', brands: [] },
      { value: 'first_edition', label: 'First Edition', brands: [] },
      { value: 'black_edition', label: 'Black Edition', brands: [] },
      { value: 'night_pakket', label: 'Night pakket', brands: [] },
      { value: 'premium', label: 'Premium pakket', brands: [] },
      { value: 'premium_plus', label: 'Premium Plus pakket', brands: [] },
    ],
  },
};

function getYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear + 1; year >= 1990; year--) {
    years.push(year);
  }
  return years;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, filters } = await req.json();
    
    let values: any;
    
    switch (type) {
      case 'makes':
        values = MAKES;
        break;
        
      case 'models':
        if (filters?.make) {
          // First try to get models from our hardcoded database
          const hardcodedModels = MODELS_BY_MAKE[filters.make] || [];
          
          // Also try to get models from the listings database for more coverage
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const { data: dbModels } = await supabase
            .from('listings')
            .select('model')
            .ilike('make', filters.make)
            .not('model', 'is', null)
            .limit(500);
          
          const dbModelNames = [...new Set((dbModels || []).map(m => m.model).filter(Boolean))];
          
          // Merge and deduplicate
          const allModels = [...new Set([...hardcodedModels, ...dbModelNames])].sort();
          values = allModels.length > 0 ? allModels : hardcodedModels;
        } else {
          values = [];
        }
        break;
        
      case 'fuels':
        values = FUEL_TYPES;
        break;
        
      case 'transmissions':
        values = TRANSMISSIONS;
        break;
        
      case 'bodyTypes':
        values = BODY_TYPES;
        break;
        
      case 'years':
        values = getYears();
        break;
        
      case 'options':
        // Return options filtered by make if provided
        const filteredOptions: Record<string, any> = {};
        const make = filters?.make;
        
        for (const [category, data] of Object.entries(OPTIONS_DATABASE)) {
          const categoryData = data as { label: string; options: Array<{ value: string; label: string; brands: string[] }> };
          const filteredCategoryOptions = categoryData.options.filter(opt => {
            // Include if no brands specified (universal) or if brand matches
            return opt.brands.length === 0 || (make && opt.brands.includes(make));
          });
          
          if (filteredCategoryOptions.length > 0) {
            filteredOptions[category] = {
              label: categoryData.label,
              options: filteredCategoryOptions,
            };
          }
        }
        values = filteredOptions;
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: `Unknown type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ values }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Vehicle values error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
