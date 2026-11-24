import potholeImg from '../assets/images/civic_pothole_road_1795273847703.jpg';
import streetlightImg from '../assets/images/civic_streetlight_outage_1795273847812.jpg';
import wasteImg from '../assets/images/civic_waste_overflow_1795273846664.jpg';
import { sanitizeSafeMediaUrl } from '../lib/securityValidation';
import type { CivicReport } from '../types/civic';

export const SEED_IMAGE_ASSETS: Record<'pothole' | 'streetlight' | 'waste', string> = {
  pothole: potholeImg,
  streetlight: streetlightImg,
  waste: wasteImg,
};

export function resolveReportMediaUrl(report: Pick<CivicReport, 'mediaUrl' | 'seedImageKey'>): string | undefined {
  const safeMediaUrl = sanitizeSafeMediaUrl(report.mediaUrl);
  if (safeMediaUrl) return safeMediaUrl;
  if (report.seedImageKey && SEED_IMAGE_ASSETS[report.seedImageKey]) {
    return SEED_IMAGE_ASSETS[report.seedImageKey];
  }
  return undefined;
}
