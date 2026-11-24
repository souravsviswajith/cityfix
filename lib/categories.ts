import type { Severity } from './types';

export interface CategoryDef {
  id: string;
  label: string;
  short: string;
  departmentId: string;
  departmentLabel: string;
  request: string; // category-specific request line used in the generated complaint
  examples: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'roads', label: 'Damaged Roads & Potholes', short: 'Roads', departmentId: 'roads', departmentLabel: 'Engineering Division — Roads', request: 'The stretch must be inspected and the damaged surface relaid or patched with durable material, and a dangerous pothole sign posted until repairs are complete.', examples: 'Potholes, broken tar macadam, caved-in stretches, sinkholes' },
  { id: 'drain', label: 'Drainage & Flooding', short: 'Drainage', departmentId: 'roads', departmentLabel: 'Engineering Division — Roads & Storm Water', request: 'The drain/culvert must be de-silted and restored immediately so that storm water flows freely, particularly before the next rain spell.', examples: 'Blocked storm-water drains, waterlogging, open manholes' },
  { id: 'water', label: 'Water Supply & Sewerage', short: 'Water Supply', departmentId: 'water', departmentLabel: 'Kerala Water Authority', request: 'The leakage / supply failure must be attended by the field squad within 48 hours, and sewerage overflow stopped and the area disinfected.', examples: 'Pipeline leaks, no water supply, sewage overflow, burst mains' },
  { id: 'waste', label: 'Garbage & Solid Waste', short: 'Waste', departmentId: 'waste', departmentLabel: 'Health & Sanitation', request: 'A door-to-door / point collection must be arranged immediately, the accumulated waste cleared, and the site sanitised to prevent disease.', examples: 'Uncollected garbage, overflowing bins, open dumping' },
  { id: 'light', label: 'Streetlights & Public Lighting', short: 'Streetlights', departmentId: 'electrical', departmentLabel: 'Public Lighting (KSEB)', request: 'The faulty luminaires must be repaired or replaced and a weekly maintenance cycle confirmed for this stretch.', examples: 'Dark stretches, non-functional poles, flickering lights' },
  { id: 'parks', label: 'Parks & Public Spaces', short: 'Parks', departmentId: 'health', departmentLabel: 'Health & Parks', request: 'The damaged amenity must be repaired or removed and routine inspection scheduled so public spaces remain safe for children and the elderly.', examples: 'Broken furniture, unsafe play equipment, overgrown parks' },
  { id: 'encroach', label: 'Encroachment & Illegal Construction', short: 'Encroachment', departmentId: 'health', departmentLabel: 'Health & Town Planning', request: 'A site inspection must be conducted to verify whether the structure/obstruction is lawful, and action taken under the relevant municipal rules if not.', examples: 'Footpath encroachment, illegal conversion, blocked access' },
  { id: 'other', label: 'Other Civic Issues', short: 'Other', departmentId: 'elected', departmentLabel: 'Office of the Mayor', request: 'The matter must be examined and the concerned field officer deputed to inspect and resolve it within a fixed time frame.', examples: 'Anything else affecting public health, safety or convenience' },
];

export const SEVERITIES: { id: Severity; label: string; hint: string; weight: number }[] = [
  { id: 'low', label: 'Low', hint: 'Inconvenient, not urgent', weight: 1 },
  { id: 'medium', label: 'Medium', hint: 'Affects daily life', weight: 2 },
  { id: 'high', label: 'High', hint: 'Safety risk or major disruption', weight: 3 },
  { id: 'emergency', label: 'Emergency', hint: 'Immediate danger — act now', weight: 4 },
];

export function getCategory(id: string): CategoryDef {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function severityColor(s: Severity): string {
  switch (s) {
    case 'low': return '#35805f';
    case 'medium': return '#c77414';
    case 'high': return '#d9480f';
    case 'emergency': return '#b42318';
  }
}
