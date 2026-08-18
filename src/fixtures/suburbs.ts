import type { Suburb } from '@/domain/serviceZone';

/**
 * Curated Canadian locality master list (stands in for the system's national
 * suburb/province/postcode reference data). Enough rows to demo filtering,
 * assignment, conflicts, and pagination on the Suburbs tab.
 */
export const SUBURBS: Suburb[] = [
  // ── Greater Toronto (ON) ──
  { id: 'sub-tor-1', name: 'Toronto', province: 'ON', postcode: 'M4C 3C4' },
  { id: 'sub-tor-2', name: 'Toronto', province: 'ON', postcode: 'M5T 1R5' },
  { id: 'sub-tor-3', name: 'Toronto', province: 'ON', postcode: 'M6K 3P6' },
  { id: 'sub-scar', name: 'Scarborough', province: 'ON', postcode: 'M1B 2K9' },
  { id: 'sub-ny', name: 'North York', province: 'ON', postcode: 'M2N 5V7' },
  { id: 'sub-eto', name: 'Etobicoke', province: 'ON', postcode: 'M9W 6H8' },
  { id: 'sub-miss', name: 'Mississauga', province: 'ON', postcode: 'L5B 3C2' },
  { id: 'sub-bram', name: 'Brampton', province: 'ON', postcode: 'L6T 4M5' },
  { id: 'sub-mark', name: 'Markham', province: 'ON', postcode: 'L3R 9X1' },
  { id: 'sub-vaug', name: 'Vaughan', province: 'ON', postcode: 'L4K 2N6' },
  { id: 'sub-rhill', name: 'Richmond Hill', province: 'ON', postcode: 'L4B 3P7' },
  { id: 'sub-oak', name: 'Oakville', province: 'ON', postcode: 'L6H 5R7' },
  { id: 'sub-burl', name: 'Burlington', province: 'ON', postcode: 'L7R 3N2' },
  { id: 'sub-ham', name: 'Hamilton', province: 'ON', postcode: 'L8N 1A1' },
  { id: 'sub-osh', name: 'Oshawa', province: 'ON', postcode: 'L1H 7K4' },
  // ── Eastern / Northern ON ──
  { id: 'sub-ott-1', name: 'Ottawa', province: 'ON', postcode: 'K1A 0B1' },
  { id: 'sub-ott-2', name: 'Ottawa', province: 'ON', postcode: 'K1H 8L1' },
  { id: 'sub-kan', name: 'Kanata', province: 'ON', postcode: 'K2K 2X3' },
  { id: 'sub-king', name: 'Kingston', province: 'ON', postcode: 'K7L 3N6' },
  { id: 'sub-lon', name: 'London', province: 'ON', postcode: 'N6A 3K7' },
  { id: 'sub-wind', name: 'Windsor', province: 'ON', postcode: 'N9A 6T3' },
  { id: 'sub-kit', name: 'Kitchener', province: 'ON', postcode: 'N2G 4X6' },
  { id: 'sub-bar', name: 'Barrie', province: 'ON', postcode: 'L4M 3A1' },
  { id: 'sub-sud', name: 'Sudbury', province: 'ON', postcode: 'P3A 1M8' },
  { id: 'sub-tim', name: 'Timmins', province: 'ON', postcode: 'P4N 1A1' },
  { id: 'sub-tbay', name: 'Thunder Bay', province: 'ON', postcode: 'P7B 5E1' },
  // ── British Columbia ──
  { id: 'sub-van-1', name: 'Vancouver', province: 'BC', postcode: 'V5K 0A1' },
  { id: 'sub-van-2', name: 'Vancouver', province: 'BC', postcode: 'V6B 2W9' },
  { id: 'sub-van-3', name: 'Vancouver', province: 'BC', postcode: 'V6X 3E4' },
  { id: 'sub-burn', name: 'Burnaby', province: 'BC', postcode: 'V5H 4M1' },
  { id: 'sub-sur', name: 'Surrey', province: 'BC', postcode: 'V3T 5X3' },
  { id: 'sub-rich', name: 'Richmond', province: 'BC', postcode: 'V7B 1A3' },
  { id: 'sub-coq', name: 'Coquitlam', province: 'BC', postcode: 'V3K 6T2' },
  { id: 'sub-lang', name: 'Langley', province: 'BC', postcode: 'V2Y 1A1' },
  { id: 'sub-abb', name: 'Abbotsford', province: 'BC', postcode: 'V2S 3N5' },
  { id: 'sub-vic', name: 'Victoria', province: 'BC', postcode: 'V8W 1P6' },
  { id: 'sub-kel', name: 'Kelowna', province: 'BC', postcode: 'V1Y 6N2' },
  // ── Quebec ──
  { id: 'sub-mtl-1', name: 'Montreal', province: 'QC', postcode: 'H2X 1Y4' },
  { id: 'sub-mtl-2', name: 'Montreal', province: 'QC', postcode: 'H3B 4W8' },
  { id: 'sub-lav', name: 'Laval', province: 'QC', postcode: 'H7T 2Y3' },
  { id: 'sub-long', name: 'Longueuil', province: 'QC', postcode: 'J4K 5G4' },
  { id: 'sub-qc', name: 'Quebec City', province: 'QC', postcode: 'G1R 4P3' },
  { id: 'sub-gat', name: 'Gatineau', province: 'QC', postcode: 'J8X 2V1' },
  // ── Prairies / Atlantic ──
  { id: 'sub-cal', name: 'Calgary', province: 'AB', postcode: 'T2P 1J9' },
  { id: 'sub-edm', name: 'Edmonton', province: 'AB', postcode: 'T5J 3N4' },
  { id: 'sub-win', name: 'Winnipeg', province: 'MB', postcode: 'R3C 4A5' },
  { id: 'sub-hal', name: 'Halifax', province: 'NS', postcode: 'B3J 3K5' },
  { id: 'sub-sas', name: 'Saskatoon', province: 'SK', postcode: 'S7K 1J5' },
  { id: 'sub-reg', name: 'Regina', province: 'SK', postcode: 'S4P 3Y2' },
];
