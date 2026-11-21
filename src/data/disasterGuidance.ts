import type { DisasterCategoryMeta, EmergencyHelpline } from '../types/civic';

export const VERIFIED_EMERGENCY_HELPLINES: EmergencyHelpline[] = [
  {
    serviceName: 'All-in-One Emergency (Police, Fire, Ambulance)',
    phoneNumber: '112',
    scope: 'India ERSS (National Emergency Response Support System)',
    isVerifiedOfficial: true,
    sourceCitation: 'https://112.gov.in',
  },
  {
    serviceName: 'Fire & Rescue Services',
    phoneNumber: '101',
    scope: 'National Fire Service',
    isVerifiedOfficial: true,
    sourceCitation: 'https://ndma.gov.in',
  },
  {
    serviceName: 'Medical Ambulance',
    phoneNumber: '108',
    scope: 'National Ambulance Service',
    isVerifiedOfficial: true,
    sourceCitation: 'https://nhm.gov.in',
  },
  {
    serviceName: 'Disaster Management / NDMA Helpline',
    phoneNumber: '1078',
    scope: 'National Disaster Management Authority',
    isVerifiedOfficial: true,
    sourceCitation: 'https://ndma.gov.in',
  },
  {
    serviceName: 'State / District Disaster Control Room',
    phoneNumber: '1070 / 1077',
    scope: 'SDMA / DDMA Toll-Free Control Desk',
    isVerifiedOfficial: true,
    sourceCitation: 'https://ndma.gov.in',
  },
];

export const DISASTER_CATEGORIES: DisasterCategoryMeta[] = [
  // Local Emergencies
  {
    id: 'house_fire',
    title: 'House / Structural Fire',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Alert occupants and evacuate immediately using stairs—never elevators.',
      'Stay low beneath smoke layers where air is cooler and clearer.',
      'Dial 101 (Fire & Rescue) or 112 once safely outside the structure.',
      'Close doors behind you as you exit to slow fire spread.',
    ],
    strictDoNots: [
      'Do not re-enter a burning building to retrieve belongings.',
      'Do not open hot doors; check door handles with the back of your hand first.',
    ],
    sourceAgency: 'National Disaster Management Authority (NDMA)',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'medical_cpr',
    title: 'Medical / Cardiac (CPR) Emergency',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Call 112 or 108 immediately and put the phone on speaker.',
      'Check responsiveness and normal breathing for no more than 10 seconds.',
      'If unresponsive and not breathing normally, place hands on center of chest and push hard and fast (100–120 compressions/min, ~5 cm deep).',
      'Ask a bystander to locate an Automated External Defibrillator (AED) if available.',
    ],
    strictDoNots: [
      'Do not give food, water, or oral medication to an unresponsive person.',
      'Do not interrupt chest compressions for more than 10 seconds.',
    ],
    sourceAgency: 'Indian Red Cross Society / WHO Basic Emergency Care',
    sourceUrl: 'https://indianredcross.org',
  },
  {
    id: 'gas_leak',
    title: 'LPG / Pipeline Gas Leak',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Extinguish all open flames immediately.',
      'Open all doors and windows to cross-ventilate the area.',
      'Turn off the LPG regulator or main gas shut-off valve.',
      'Evacuate occupants to open air and call 112 or the gas emergency desk from outside.',
    ],
    strictDoNots: [
      'DO NOT turn any electrical switches, fans, or lights ON or OFF (sparks can ignite gas).',
      'DO NOT use mobile phones or lighters inside the premises.',
    ],
    sourceAgency: 'National Disaster Management Authority (NDMA)',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'serious_accident',
    title: 'Serious Road / Industrial Accident',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Ensure scene safety before approaching; turn on hazard lights and set warning triangles.',
      'Call 112 or 108 with exact road markers or GPS coordinates.',
      'Apply direct firm pressure with clean cloth to control severe bleeding.',
    ],
    strictDoNots: [
      'Do not move an injured person with suspected neck or spinal trauma unless threatened by fire or traffic.',
      'Do not remove embedded objects from deep wounds.',
    ],
    sourceAgency: 'WHO Basic Emergency Care / Ministry of Road Transport',
    sourceUrl: 'https://112.gov.in',
  },
  {
    id: 'electrical_hazard',
    title: 'Downed Power Line / Electrocution',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Keep at least 10 meters away from downed wires and any wet ground or metal fences nearby.',
      'Call 112 and the municipal electricity control desk immediately.',
      'If someone is in contact with a live source, disconnect the main breaker before touching them.',
    ],
    strictDoNots: [
      'Do not touch a victim still in contact with an energized wire.',
      'Do not drive over downed electrical cables.',
    ],
    sourceAgency: 'Central Electricity Authority / NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'chemical_hazard',
    title: 'Chemical Spill / Toxic Fumes',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Move upwind and uphill immediately away from the visible plume or spill.',
      'Close interior doors, shut off HVAC/ventilation if sheltering indoors, and seal window gaps.',
      'Call 112 / 1077 and report container placards or chemical odors from a safe distance.',
    ],
    strictDoNots: [
      'Do not walk through or touch unknown liquids or powders.',
      'Do not use open flames near unknown vapors.',
    ],
    sourceAgency: 'National Disaster Management Authority (NDMA)',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'structural_collapse',
    title: 'Building / Bridge Collapse',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Move clear of the collapse perimeter immediately due to secondary structural failures.',
      'Call 112 / 101 to dispatch urban search and rescue teams.',
      'If trapped under debris, cover mouth/nose with cloth and tap on pipes or walls to signal rescuers.',
    ],
    strictDoNots: [
      'Do not enter partially collapsed structures to search unassisted.',
      'Do not shout continuously if trapped—conserve air and avoid inhaling dust.',
    ],
    sourceAgency: 'National Disaster Response Force (NDRF) / NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'falling_trees',
    title: 'Fallen Tree Blocking Access / Wires',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Treat any fallen tree entangled with overhead cables as an energized electrical hazard.',
      'Block pedestrian access from a safe distance and dial 112 / 101.',
    ],
    strictDoNots: [
      'Do not attempt to saw or clear limbs resting on utility lines.',
    ],
    sourceAgency: 'Municipal Emergency Operations / NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'flooding_waterlogging',
    title: 'Flash Flooding / Severe Waterlogging',
    scale: 'LOCAL_EMERGENCY',
    immediateActions: [
      'Move immediately to higher ground or upper floors away from rising water.',
      'Switch off main electrical supply if water begins entering ground-level rooms.',
      'Call 112 or District Disaster Control Room (1077) if stranded.',
    ],
    strictDoNots: [
      'Do not walk or drive through moving floodwater (15 cm can knock down an adult).',
      'Do not touch electrical appliances while standing on wet surfaces.',
    ],
    sourceAgency: 'National Disaster Management Authority (NDMA)',
    sourceUrl: 'https://ndma.gov.in',
  },

  // Large-Scale Disasters
  {
    id: 'earthquake',
    title: 'Earthquake',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'DROP to your hands and knees.',
      'COVER your head and neck under a sturdy table or against an interior wall away from glass.',
      'HOLD ON until the shaking stops.',
      'If outdoors, move to an open area clear of buildings, trees, and overhead power lines.',
    ],
    strictDoNots: [
      'Do not use elevators.',
      'Do not run outside while debris is falling.',
    ],
    sourceAgency: 'National Disaster Management Authority (NDMA)',
    sourceUrl: 'https://ndma.gov.in/Natural-Hazards/Earthquakes',
  },
  {
    id: 'tsunami',
    title: 'Tsunami Warning',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Evacuate coastal lowlands immediately on foot toward designated high ground or inland elevation.',
      'Follow official INCOIS / NDMA SACHET alerts for all-clear notices.',
    ],
    strictDoNots: [
      'Do not go to the shoreline to watch receding ocean water.',
      'Do not return after the first wave—subsequent waves are often larger.',
    ],
    sourceAgency: 'INCOIS / NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'cyclone',
    title: 'Cyclone / Hurricane',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Secure loose outdoor objects, board glass windows, and keep emergency water/battery kits ready.',
      'Move to an interior room or designated cyclone shelter before winds peak.',
      'Keep tuned to official IMD / NDMA SACHET weather bulletins.',
    ],
    strictDoNots: [
      'Do not venture outside during the calm "eye" of the storm; winds reverse violently.',
    ],
    sourceAgency: 'India Meteorological Department / NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'severe_storm',
    title: 'Severe Thunderstorm / Squall',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Seek shelter inside a sturdy enclosed building or hard-topped metal vehicle.',
      'Unplug sensitive appliances and keep clear of windows.',
    ],
    strictDoNots: [
      'Do not shelter under isolated tall trees or temporary tin sheds.',
    ],
    sourceAgency: 'NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'lightning',
    title: 'Cloud-to-Ground Lightning',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Move indoors immediately if thunder follows lightning within 30 seconds.',
      'Wait 30 minutes after the last thunderclap before resuming outdoor activity.',
    ],
    strictDoNots: [
      'Do not use corded landline phones, metal umbrellas, or stay in open fields/water.',
    ],
    sourceAgency: 'NDMA Lightning Safety Protocol',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'landslide',
    title: 'Landslide / Mudslide',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Listen for unusual cracking sounds or sudden changes in stream water clarity.',
      'Evacuate perpendicular to the slide path toward stable higher ground.',
      'Alert neighbors and notify 1077 / 112 immediately.',
    ],
    strictDoNots: [
      'Do not remain in steep valley bottoms or cross active debris flows.',
    ],
    sourceAgency: 'NDMA / Geological Survey',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'wildfire',
    title: 'Wildfire / Forest Fire',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Evacuate early along pre-identified clear routes perpendicular to wind direction.',
      'Wear N95 masks or wet cloth over nose and mouth to filter smoke particulates.',
    ],
    strictDoNots: [
      'Do not attempt to outrun an uphill fire front.',
    ],
    sourceAgency: 'NDMA',
    sourceUrl: 'https://ndma.gov.in',
  },
  {
    id: 'heatwave',
    title: 'Extreme Heatwave',
    scale: 'LARGE_SCALE_DISASTER',
    immediateActions: [
      'Stay hydrated with water and oral rehydration solution (ORS) even without thirst.',
      'Avoid strenuous outdoor labor between 12:00 and 15:00 hours.',
      'Move any person showing confusion, hot dry skin, or dizziness to shade, cool with wet cloths, and call 108/112.',
    ],
    strictDoNots: [
      'Do not leave children, elderly persons, or pets inside parked vehicles.',
    ],
    sourceAgency: 'NDMA Heatwave Action Plan',
    sourceUrl: 'https://ndma.gov.in',
  },
];
