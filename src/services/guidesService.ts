export interface CustomGuideData {
  id: string;
  name: string;
  role: string;
  bio: string;
  gender: 'Male' | 'Female';
  specialty?: string;
  badge?: string;
  experienceKm?: string;
  is_visible: boolean;
}

export interface GuidesSettings {
  show_trek_leaders_tab: boolean;
  custom_guides: CustomGuideData[];
}

export const DEFAULT_GUIDES: CustomGuideData[] = [
  {
    id: 'biraj-thing',
    name: 'Biraj Thing',
    role: 'Senior Trek Leader & Mountain Guide',
    bio: 'Experienced mountain leader with over 1,400+ km traversed across high-altitude Himalayan trails with Walk Nepal Walk.',
    gender: 'Male',
    experienceKm: '1,400+ km',
    badge: 'Senior Guide',
    specialty: 'High-altitude passes & wilderness expeditions',
    is_visible: true,
  },
  {
    id: 'salina-tamang',
    name: 'Salina Tamang',
    role: 'Certified Trek Leader & Community Guide',
    bio: 'High-altitude circuit trek specialist and community trail leader guiding day hikes and multi-day expeditions.',
    gender: 'Female',
    experienceKm: '800+ km',
    badge: 'Circuit Specialist',
    specialty: 'Circuit routes, beginner pacing & community care',
    is_visible: true,
  },
  {
    id: 'sundar-gurung',
    name: 'Sundar Gurung',
    role: 'Senior Mountain Guide',
    bio: 'High-altitude expedition leader and veteran trail pioneer across Annapurna, Langtang, and Jugal ranges.',
    gender: 'Male',
    experienceKm: '1,200+ km',
    badge: 'Senior Guide',
    specialty: 'Annapurna, Langtang & Jugal high ridges',
    is_visible: true,
  },
  {
    id: 'velin-rai',
    name: 'Velin Rai',
    role: 'Founder & Head of Expeditions',
    bio: 'Founder of Walk Nepal Walk with nearly 2,000 km of trail-blazing and community leading.',
    gender: 'Male',
    experienceKm: '1,900+ km',
    badge: 'Expedition Head',
    specialty: 'Expedition logistics & pioneer ridge routes',
    is_visible: true,
  },
  {
    id: 'saraswoti-tamang',
    name: 'Saraswoti Tamang',
    role: 'Senior Coordinator & Trek Guide',
    bio: 'Patient, friendly mountain coordinator and high-altitude trail guide ensuring group safety and motivation.',
    gender: 'Female',
    experienceKm: '600+ km',
    badge: 'Coordinator',
    specialty: 'Group safety, medical care & route coordination',
    is_visible: true,
  },
  {
    id: 'gauri',
    name: 'Gauri',
    role: 'Senior Trek Coordinator & Route Leader',
    bio: 'Veteran trail coordinator leading Saturday subscription hikes and high ridge circuit ascents.',
    gender: 'Male',
    experienceKm: '850+ km',
    badge: 'Senior Coordinator',
    specialty: 'Ridge navigation, weekend pacing & group safety',
    is_visible: true,
  },
  {
    id: 'aanung',
    name: 'Aanung',
    role: 'Trail Leader & Route Coordinator',
    bio: 'Energetic trail leader and wilderness route specialist guiding weekend day walks.',
    gender: 'Male',
    experienceKm: '550+ km',
    badge: 'Route Leader',
    specialty: 'Cave circuits, waterfall trails & group briefings',
    is_visible: true,
  },
  {
    id: 'krishna',
    name: 'Krishna',
    role: 'Mountain Leader & Expedition Guide',
    bio: 'Experienced expedition leader for multi-day high altitude circuit treks across North ABC and Langtang.',
    gender: 'Male',
    experienceKm: '1,100+ km',
    badge: 'Expedition Guide',
    specialty: 'Multi-day treks, high pass safety & logistics',
    is_visible: true,
  },
  {
    id: 'laxmi',
    name: 'Laxmi',
    role: 'High Altitude Trek Guide & Coordinator',
    bio: 'Certified Himalayan circuit guide leading Shey Phoksundo and Gosaikunda high-altitude expeditions.',
    gender: 'Female',
    experienceKm: '950+ km',
    badge: 'Circuit Guide',
    specialty: 'High lake circuits, altitude acclimatization & care',
    is_visible: true,
  },
  {
    id: 'subarna',
    name: 'Subarna',
    role: 'Wilderness Guide & Trail Coordinator',
    bio: 'Trail pioneer and wilderness expedition guide focused on group safety and alpine logistics.',
    gender: 'Male',
    experienceKm: '700+ km',
    badge: 'Wilderness Guide',
    specialty: 'Alpine wilderness, route scouting & navigation',
    is_visible: true,
  },
  {
    id: 'hochhali-rai',
    name: 'Hochhali Rai',
    role: 'Trek Coordinator & Trail Leader',
    bio: 'Trail logistics coordinator and Himalayan expedition leader dedicated to sustainable community trekking.',
    gender: 'Male',
    experienceKm: '750+ km',
    badge: 'Coordinator',
    specialty: 'Trail logistics, group briefings & pacing',
    is_visible: true,
  },
  {
    id: 'chiranjibi-singh-saud',
    name: 'Chiranjibi Singh Saud',
    role: 'Trail Coordinator & Mountain Leader',
    bio: 'Mountain leader and route specialist guiding wilderness day walks and ridge ascents.',
    gender: 'Male',
    experienceKm: '500+ km',
    badge: 'Coordinator',
    specialty: 'Day hike ridges & wilderness navigation',
    is_visible: true,
  },
  {
    id: 'sujan-khadka',
    name: 'Sujan Khadka',
    role: 'Trek Coordinator & Community Leader',
    bio: 'Enthusiastic coordinator and trail leader focused on hiker care, trail encouragement, and safety.',
    gender: 'Male',
    experienceKm: '450+ km',
    badge: 'Coordinator',
    specialty: 'Hiker support, photography & ridge trails',
    is_visible: true,
  },
  {
    id: 'rajan',
    name: 'Rajan',
    role: 'Community Trek Guide',
    bio: 'Specialist in Kathmandu Valley ridge circuits, day hike exploration, and trail pacing.',
    gender: 'Male',
    experienceKm: '350+ km',
    badge: 'Trail Guide',
    specialty: 'Kathmandu valley rim & weekend explorer',
    is_visible: true,
  },
];

export const STORAGE_KEY = 'wnw_guides_settings_v1';

export function deduplicateGuides(guides: CustomGuideData[]): CustomGuideData[] {
  if (!Array.isArray(guides)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: CustomGuideData[] = [];

  for (const guide of guides) {
    if (!guide || typeof guide !== 'object') continue;
    const name = (guide.name || '').trim();
    if (!name) continue;

    const id = (guide.id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
    const nameKey = name.toLowerCase();

    if (!seenIds.has(id) && !seenNames.has(nameKey)) {
      seenIds.add(id);
      seenNames.add(nameKey);
      result.push({
        ...guide,
        id,
        name,
      });
    }
  }

  return result;
}

export function getGuidesSettings(): GuidesSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.custom_guides)) {
        const combined = deduplicateGuides([...parsed.custom_guides, ...DEFAULT_GUIDES]);
        return {
          show_trek_leaders_tab: parsed.show_trek_leaders_tab !== false,
          custom_guides: combined,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse guide settings:', err);
  }
  return {
    show_trek_leaders_tab: true,
    custom_guides: deduplicateGuides(DEFAULT_GUIDES),
  };
}

export function saveGuidesSettings(settings: GuidesSettings): void {
  try {
    const cleanSettings: GuidesSettings = {
      show_trek_leaders_tab: settings.show_trek_leaders_tab !== false,
      custom_guides: deduplicateGuides(settings.custom_guides || []),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanSettings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wnw-guide-settings-updated', { detail: cleanSettings }));
    }
  } catch (err) {
    console.error('Failed to save guide settings:', err);
  }
}
