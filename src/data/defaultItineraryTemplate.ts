export interface PriceTier {
  id: string;
  label: string;
  price: number;
}

export interface AddOnItem {
  id: string;
  name: string;
  price: number;
  unit: string;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  title: string;
  items: Array<{
    id: string;
    time: string;
    activity: string;
  }>;
}

export interface SafetyRule {
  id: string;
  title: string;
  description: string;
}

export interface TrekItineraryData {
  // Section 1: Basic Information
  hikeNumber: string;
  title: string;
  category: 'Overnight Bus Hikes' | 'Subscription Hikes' | 'Day Hikes' | 'Multi Day Treks';
  coverImageUrl?: string;
  cardImageUrl?: string;
  priceTiers: PriceTier[];
  currency: 'NPR' | 'USD';
  pricingNotes: string;
  
  // New basic fields
  teamLeader: string;
  maxCapacity: number;
  whatsappLink?: string;
  itineraryLink?: string;
  faqLink?: string;

  // Section 2: Hike Date
  hikeDate: string;

  // Section 3: Hike Overview
  overview: {
    meetingTime: string;
    meetingPoint: string;
    expectedDuration: string;
    difficulty: string;
    approxDistance: string;
    elevationRange: string;
    elevationGross: string;
    endingPoint: string;
  };

  // Section 4: Cost Includes
  costIncludes: string[];

  // Section 5: Cost Excludes
  costExcludes: string[];

  // Section 6: Additional Add Ons
  addOns: AddOnItem[];
  addOnsNotice: string;

  // Section 7: Itinerary Details
  itineraryDays: ItineraryDay[];

  // Section 8: Booking Process & Participation Guidelines (Standard Policies)
  bookingProcessSteps: string[];
  bookingNotes: string[];
  participationGuidelines: string;
  safetyRules: SafetyRule[];
  helpContacts: string[];
}

export const INITIAL_ITINERARY_TEMPLATE: TrekItineraryData = {
  hikeNumber: '',
  title: '',
  category: 'Overnight Bus Hikes',
  coverImageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
  currency: 'NPR',
  pricingNotes: 'Normal Package price per person by Scorpio (7/8 pax)',
  teamLeader: 'Walk Nepal Walk Guide',
  maxCapacity: 25,
  whatsappLink: '',
  itineraryLink: '',
  faqLink: '',
  priceTiers: [
    { id: '1', label: 'Normal Price', price: 5500 },
    { id: '2', label: 'Student Price', price: 4800 },
    { id: '3', label: 'Monthly Subscription Member', price: 4200 },
  ],
  hikeDate: '',
  overview: {
    meetingTime: '8:00 AM',
    meetingPoint: '',
    expectedDuration: '',
    difficulty: 'Moderate',
    approxDistance: '',
    elevationRange: '',
    elevationGross: '',
    endingPoint: '',
  },
  costIncludes: [
    'Kathmandu to Kathmandu round trip Bus/EV transportation',
    '2 - Veg Lunch',
    '1 - Chicken Dinner',
    'Tea, Campfire and Music',
    'Certified Trail & Team Coordinators',
    'Basic First Aid Support',
    'En-route pickup: Sundhara - Koteshwor - Bhaktapur Main Road',
  ],
  costExcludes: [
    'Insurance of any kind',
    'Porters & personal luggage carriers',
    'Special permits (if applicable)',
    'Personal snacks, beverages & bar bills',
    'Anything not explicitly mentioned in the inclusions list',
  ],
  addOns: [
    { id: 'addon-1', name: 'Couple Room', price: 1200, unit: 'per room extra' },
    { id: 'addon-2', name: 'Single Bed Upgrade', price: 600, unit: 'per bed extra' },
  ],
  addOnsNotice: '*Please inform us for customization in advance so that we can book logistics accordingly*',
  itineraryDays: [
    {
      id: 'day-1',
      dayNumber: 1,
      title: 'Journey to Kalapani & Sunset Walk',
      items: [
        { id: 'd1-1', time: '08:00 AM', activity: 'Vehicle departs from Sundhara sharp' },
        { id: 'd1-2', time: '11:00 AM', activity: 'Lunch at Sukute Beach' },
        { id: 'd1-3', time: '02:00 PM', activity: 'Mudhe market tea break' },
        { id: 'd1-4', time: '04:00 PM', activity: 'Reach Kalapani. Short walk to the mini great wall for sunset' },
        { id: 'd1-5', time: '08:30 PM', activity: 'Have warm dinner, campfire gathering, and rest for the night' },
      ],
    },
    {
      id: 'day-2',
      dayNumber: 2,
      title: 'Sailung Summit Sunrise & Return to Kathmandu',
      items: [
        { id: 'd2-1', time: '04:30 AM', activity: 'Sunrise hike to Sailung peaks' },
        { id: 'd2-2', time: '10:00 AM', activity: 'Hearty lunch at hotel' },
        { id: 'd2-3', time: '12:00 PM', activity: 'Board return transportation heading back to Kathmandu' },
        { id: 'd2-4', time: '05:30 PM', activity: 'Arrival back at Sundhara Kathmandu' },
      ],
    },
  ],
  bookingProcessSteps: [
    'Review the itinerary, dates, route elevation, and what is included before you commit.',
    'Fill the signup registration form with your accurate information.',
    'Make advance payment / deposit to secure your booking and confirm your place.',
    'Forward payment voucher screenshot via WhatsApp for instant verification.',
    'Get added to the hike-specific WhatsApp group for live coordination, packing tips, and weather updates.',
  ],
  bookingNotes: [
    'Payment screenshot must be forwarded to WhatsApp (+977-9803568612) only for user data privacy.',
    'Booking deposit is non-transferable to another event after roster confirmation.',
  ],
  participationGuidelines:
    'Participants should have a reasonable level of fitness to complete the hike within the designated timeframe. Recommended age requirement: 13 to 50 years (participants outside this range are welcome with a friend, guardian, or self-reliant hiking fitness). Individuals whose fitness might cause severe delays are advised to consult coordinators beforehand for safety.',
  safetyRules: [
    {
      id: 's-1',
      title: 'Hike Sign-up',
      description: 'Hikers must officially register for each hike they wish to attend.',
    },
    {
      id: 's-2',
      title: 'Punctuality',
      description: 'Members must arrive at the designated meeting point at the specified time.',
    },
    {
      id: 's-3',
      title: 'Safety First',
      description: 'All participants follow the instructions of designated hike leader(s) at all times.',
    },
    {
      id: 's-4',
      title: 'Medical Conditions',
      description: 'Members are responsible for their health and must inform organizers of pre-existing conditions.',
    },
    {
      id: 's-5',
      title: 'Leave No Trace',
      description: 'Hikers shall not tamper with nature, private agriculture, or local culture in any way.',
    },
    {
      id: 's-6',
      title: 'Liability Waiver',
      description: 'Acknowledge that hiking involves natural terrain risks; organizers ensure guidance but are not liable for accidental risks.',
    },
  ],
  helpContacts: ['+977-9860071064', '+977-9803568612'],
};

export const normalizeItineraryData = (raw?: Partial<TrekItineraryData> | null): TrekItineraryData => {
  const d = raw || {};
  return {
    hikeNumber: d.hikeNumber !== undefined && d.hikeNumber !== null ? String(d.hikeNumber).trim() : '',
    title: d.title !== undefined && d.title !== null ? String(d.title) : '',
    category: d.category || 'Overnight Bus Hikes',
    coverImageUrl: d.coverImageUrl ?? '',
    cardImageUrl: d.cardImageUrl ?? '',
    currency: d.currency || 'NPR',
    pricingNotes: d.pricingNotes ?? '',
    teamLeader: d.teamLeader !== undefined && d.teamLeader !== null ? String(d.teamLeader) : 'Walk Nepal Walk Guide',
    maxCapacity: Number(d.maxCapacity) > 0 ? Number(d.maxCapacity) : 25,
    whatsappLink: d.whatsappLink ?? '',
    itineraryLink: d.itineraryLink ?? '',
    faqLink: d.faqLink ?? '',
    priceTiers: Array.isArray(d.priceTiers) && d.priceTiers.length > 0 
      ? d.priceTiers 
      : [...INITIAL_ITINERARY_TEMPLATE.priceTiers],
    hikeDate: d.hikeDate !== undefined && d.hikeDate !== null ? String(d.hikeDate) : '',
    overview: {
      meetingTime: d.overview?.meetingTime ?? '',
      meetingPoint: d.overview?.meetingPoint ?? '',
      expectedDuration: d.overview?.expectedDuration ?? '',
      difficulty: d.overview?.difficulty ?? 'Moderate',
      approxDistance: d.overview?.approxDistance ?? '',
      elevationRange: d.overview?.elevationRange ?? '',
      elevationGross: d.overview?.elevationGross ?? '',
      endingPoint: d.overview?.endingPoint ?? '',
    },
    costIncludes: Array.isArray(d.costIncludes) ? d.costIncludes : [...INITIAL_ITINERARY_TEMPLATE.costIncludes],
    costExcludes: Array.isArray(d.costExcludes) ? d.costExcludes : [...INITIAL_ITINERARY_TEMPLATE.costExcludes],
    addOns: Array.isArray(d.addOns) ? d.addOns : [],
    addOnsNotice: d.addOnsNotice ?? '',
    itineraryDays: Array.isArray(d.itineraryDays) && d.itineraryDays.length > 0
      ? d.itineraryDays
      : [...INITIAL_ITINERARY_TEMPLATE.itineraryDays],
    bookingProcessSteps: Array.isArray(d.bookingProcessSteps) ? d.bookingProcessSteps : [...INITIAL_ITINERARY_TEMPLATE.bookingProcessSteps],
    bookingNotes: Array.isArray(d.bookingNotes) ? d.bookingNotes : [...INITIAL_ITINERARY_TEMPLATE.bookingNotes],
    participationGuidelines: d.participationGuidelines ?? INITIAL_ITINERARY_TEMPLATE.participationGuidelines,
    safetyRules: Array.isArray(d.safetyRules) ? d.safetyRules : [...INITIAL_ITINERARY_TEMPLATE.safetyRules],
    helpContacts: Array.isArray(d.helpContacts) ? d.helpContacts : [...INITIAL_ITINERARY_TEMPLATE.helpContacts],
  };
};

export interface SavedHikeRecord {
  id: string;
  hikeNumber: string;
  title: string;
  category: 'Overnight Bus Hikes' | 'Subscription Hikes' | 'Day Hikes' | 'Multi Day Treks';
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  authorEmail: string;
  data: TrekItineraryData;
  syncedToCloudflare?: boolean;
}

export const DEFAULT_SAVED_HIKES: SavedHikeRecord[] = [
  {
    id: 'hike-108-sailung',
    hikeNumber: '108',
    title: 'Sailung Overnight Hike',
    category: 'Overnight Bus Hikes',
    status: 'published',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-12T14:30:00.000Z',
    authorEmail: 'walknepalwalk@gmail.com',
    data: INITIAL_ITINERARY_TEMPLATE,
  },
  {
    id: 'hike-111-gosainkunda',
    hikeNumber: '111',
    title: 'Gosainkunda Holy Lakes & Lauribina Ridge Trek',
    category: 'Multi Day Treks',
    status: 'published',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-13T02:00:00.000Z',
    authorEmail: 'walknepalwalk@gmail.com',
    data: {
      ...INITIAL_ITINERARY_TEMPLATE,
      hikeNumber: '111',
      title: 'Gosainkunda Holy Lakes & Lauribina Ridge Trek',
      category: 'Multi Day Treks',
      coverImageUrl: 'https://images.unsplash.com/photo-1585938389612-a552a28d6914?auto=format&fit=crop&w=1200&q=80',
      hikeDate: 'Wed 14 Oct – Sun 18 Oct 2026 (5 Days)',
      pricingNotes: 'Complete 5-day lodge trek package with roundtrip Jeep & permits',
      priceTiers: [
        { id: '1', label: 'Standard Package', price: 18500 },
        { id: '2', label: 'Student / Group (4+)', price: 16500 },
        { id: '3', label: 'Club Member', price: 15000 },
      ],
      overview: {
        meetingTime: '6:00 AM',
        meetingPoint: 'Machhapokhari Bus Park, Kathmandu',
        expectedDuration: '5 Days / 4 Nights',
        difficulty: 'Challenging',
        approxDistance: '48.5 km',
        elevationRange: '1960m (Dhunche) to 4380m (Gosainkunda Lake)',
        elevationGross: '+2420m / -2420m',
        endingPoint: 'Kathmandu via Dhunche',
      },
      costIncludes: [
        'Kathmandu - Dhunche - Kathmandu Private Reserved Jeep',
        '4 Nights Mountain Teahouse Accommodation (Twin Sharing)',
        'All Meals on Trek (Breakfast, Lunch, Dinner + Hot Tea)',
        'Langtang National Park Entry Permit & TIMS',
        'Certified Wilderness Guide & First-Aid Oxygen Support',
      ],
      costExcludes: [
        'Personal porter for backpack (available on request)',
        'Hot showers, battery charging & bottled water in high teahouses',
        'Personal travel/medical insurance',
      ],
      addOns: [
        { id: 'add-1', name: 'Private Porter (1 porter per 2 trekkers)', price: 6000, unit: 'entire trek' },
        { id: 'add-2', name: 'Single Room Upgrade (Subject to Teahouse Availability)', price: 3500, unit: '4 nights' },
      ],
      addOnsNotice: 'Porters must be booked at least 4 days in advance to ensure mountain permits.',
      itineraryDays: [
        {
          id: 'day-1',
          dayNumber: 1,
          title: 'Kathmandu to Dhunche & Trek to Deurali (2625m)',
          items: [
            { id: 'g-1', time: '06:00 AM', activity: 'Drive from Kathmandu to Dhunche by private Jeep (6 hrs)' },
            { id: 'g-2', time: '01:00 PM', activity: 'Lunch at Dhunche & permit verification at military checkpost' },
            { id: 'g-3', time: '02:00 PM', activity: 'Commence uphill trail through dense pine & bamboo woods' },
            { id: 'g-4', time: '05:30 PM', activity: 'Arrive at Deurali teahouse. Dinner & rest' },
          ],
        },
        {
          id: 'day-2',
          dayNumber: 2,
          title: 'Deurali to Chandanbari / Sing Gompa & Cholangpati (3584m)',
          items: [
            { id: 'g-5', time: '07:30 AM', activity: 'Breakfast & start trek along ridge toward Sing Gompa' },
            { id: 'g-6', time: '11:30 AM', activity: 'Visit local yak cheese factory at Sing Gompa & lunch' },
            { id: 'g-7', time: '01:30 PM', activity: 'Climb toward Cholangpati with panoramic Langtang Himal views' },
            { id: 'g-8', time: '04:30 PM', activity: 'Overnight at Cholangpati mountain lodge' },
          ],
        },
        {
          id: 'day-3',
          dayNumber: 3,
          title: 'Cholangpati to Lauribina Ridge & Sacred Gosainkunda Lake (4380m)',
          items: [
            { id: 'g-9', time: '06:30 AM', activity: 'Sunrise trek up steep Lauribinayak pass above the treeline' },
            { id: 'g-10', time: '10:30 AM', activity: 'Witness Saraswati Kunda, Bhairav Kunda and Holy Gosainkunda' },
            { id: 'g-11', time: '01:00 PM', activity: 'Hot lunch at lake lodge & exploration of holy shrines' },
            { id: 'g-12', time: '06:30 PM', activity: 'Star-gazing & high-altitude overnight by the holy lake' },
          ],
        },
        {
          id: 'day-4',
          dayNumber: 4,
          title: 'Gosainkunda Sunrise & Scenic Descent to Sing Gompa',
          items: [
            { id: 'g-13', time: '06:00 AM', activity: 'Sunrise prayer and photography at the lake rim' },
            { id: 'g-14', time: '08:00 AM', activity: 'Descend through Lauribina ridge enjoying Ganesh Himal views' },
            { id: 'g-15', time: '01:30 PM', activity: 'Arrive at Sing Gompa for hot lunch & relax' },
            { id: 'g-16', time: '07:00 PM', activity: 'Farewell celebratory dinner at the lodge' },
          ],
        },
        {
          id: 'day-5',
          dayNumber: 5,
          title: 'Sing Gompa to Dhunche & Drive Back to Kathmandu',
          items: [
            { id: 'g-17', time: '07:00 AM', activity: 'Final morning downhill trek to Dhunche valley' },
            { id: 'g-18', time: '11:00 AM', activity: 'Board return private Jeep at Dhunche' },
            { id: 'g-19', time: '05:30 PM', activity: 'Arrive Kathmandu (Machhapokhari) - Trip concludes' },
          ],
        },
      ],
    },
  },
  {
    id: 'hike-109-phulchowki',
    hikeNumber: '109',
    title: 'Godawari - Phulchowki Peak Ridge Trail',
    category: 'Day Hikes',
    status: 'published',
    createdAt: '2026-09-05T08:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
    authorEmail: 'velinrai.vr@gmail.com',
    data: {
      ...INITIAL_ITINERARY_TEMPLATE,
      hikeNumber: '109',
      title: 'Godawari - Phulchowki Peak Ridge Trail',
      category: 'Day Hikes',
      coverImageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
      hikeDate: 'Saturday 19 Sep 2026',
      pricingNotes: 'Includes roundtrip bus, certified guide, trail snack & lunch',
      priceTiers: [
        { id: '1', label: 'Standard Price', price: 1500 },
        { id: '2', label: 'Student Price', price: 1200 },
        { id: '3', label: 'Subscription Member', price: 900 },
      ],
      overview: {
        meetingTime: '7:00 AM',
        meetingPoint: 'Godawari Bus Park (Botanical Garden Gate)',
        expectedDuration: '6 - 7 Hours',
        difficulty: 'Moderate',
        approxDistance: '14.2 km',
        elevationRange: '1515m to 2762m',
        elevationGross: '+1247m / -1247m',
        endingPoint: 'Godawari Bus Park',
      },
      costIncludes: [
        'Round-trip local transport from Kathmandu',
        'Packed Nutritious Lunch & Energy Snack',
        'Trail Coordinator & Certified Wilderness First Aid',
        'Entry fee / Conservation area pass',
      ],
      costExcludes: [
        'Personal drinking water and extra snacks',
        'Insurance of any kind',
      ],
      addOns: [],
      addOnsNotice: '',
      itineraryDays: [
        {
          id: 'day-1',
          dayNumber: 1,
          title: 'Ascent to Phulchowki Tower & Botanical Descent',
          items: [
            { id: 'p-1', time: '07:00 AM', activity: 'Assemble at Godawari gate & briefing' },
            { id: 'p-2', time: '07:30 AM', activity: 'Commence steep pine forest ascent' },
            { id: 'p-3', time: '12:00 PM', activity: 'Reach Phulchowki Summit (2762m) - Lunch & 360 Himalayan Views' },
            { id: 'p-4', time: '01:30 PM', activity: 'Commence ridge descent via rhododendron grove' },
            { id: 'p-5', time: '04:30 PM', activity: 'Arrive at Godawari & return to Kathmandu' },
          ],
        },
      ],
    },
  },
  {
    id: 'hike-110-shivapuri-draft',
    hikeNumber: '110',
    title: 'Shivapuri Peak & Bagdwar Spring',
    category: 'Subscription Hikes',
    status: 'draft',
    createdAt: '2026-09-11T09:00:00.000Z',
    updatedAt: '2026-09-13T01:15:00.000Z',
    authorEmail: 'thingbiraj77@gmail.com',
    data: {
      ...INITIAL_ITINERARY_TEMPLATE,
      hikeNumber: '110',
      title: 'Shivapuri Peak & Bagdwar Spring',
      category: 'Subscription Hikes',
      hikeDate: 'Sunday 27 Sep 2026',
      pricingNotes: 'Discounted for monthly subscribers',
      priceTiers: [
        { id: '1', label: 'Non-Subscriber Price', price: 1800 },
        { id: '2', label: 'Active Monthly Subscriber', price: 500 },
      ],
      overview: {
        meetingTime: '7:30 AM',
        meetingPoint: 'Budhanilkantha National Park Gate',
        expectedDuration: '5.5 Hours',
        difficulty: 'Moderate',
        approxDistance: '12.8 km',
        elevationRange: '1450m to 2732m',
        elevationGross: '+1282m / -1282m',
        endingPoint: 'Budhanilkantha Gate',
      },
    },
  },
];

/**
 * Format standard YYYY-MM-DD to readable "Saturday 19 Sep 2026"
 */
export function formatSingleDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  try {
    const [year, month, day] = isoDateStr.split('-').map(Number);
    if (!year || !month || !day) return isoDateStr;
    const d = new Date(year, month - 1, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dayNames[d.getDay()]} ${day} ${monthNames[d.getMonth()]} ${year}`;
  } catch (e) {
    return isoDateStr;
  }
}

/**
 * Format date range "2026-10-14" to "2026-10-18" -> "Wed 14 Oct – Sun 18 Oct 2026 (5 Days)"
 */
export function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso) return '';
  if (!endIso || endIso === startIso) return formatSingleDate(startIso);

  try {
    const [y1, m1, d1] = startIso.split('-').map(Number);
    const [y2, m2, d2] = endIso.split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1);
    const date2 = new Date(y2, m2 - 1, d2);

    const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (y1 === y2) {
      if (m1 === m2) {
        return `${dayShort[date1.getDay()]} ${d1} – ${dayShort[date2.getDay()]} ${d2} ${monthNames[date1.getMonth()]} ${y1} (${diffDays} Days)`;
      }
      return `${dayShort[date1.getDay()]} ${d1} ${monthNames[date1.getMonth()]} – ${dayShort[date2.getDay()]} ${d2} ${monthNames[date2.getMonth()]} ${y1} (${diffDays} Days)`;
    }
    return `${dayShort[date1.getDay()]} ${d1} ${monthNames[date1.getMonth()]} ${y1} – ${dayShort[date2.getDay()]} ${d2} ${monthNames[date2.getMonth()]} ${y2} (${diffDays} Days)`;
  } catch (e) {
    return `${startIso} – ${endIso}`;
  }
}

/**
 * Preformats an ultra-clean WhatsApp text summary ready to be copied and pasted
 * into WhatsApp broadcast groups or direct chats.
 */
export function generateWhatsAppSummary(hike: SavedHikeRecord | TrekItineraryData): string {
  const rawData: TrekItineraryData = 'data' in hike ? hike.data : hike;
  const data: TrekItineraryData = normalizeItineraryData(rawData);
  const hikeNum = data.hikeNumber ? `Hike #${data.hikeNumber}` : 'Upcoming Trek';

  const priceLines = (data.priceTiers || [])
    .map((tier) => `  • *${tier.label}*: ${data.currency} ${tier.price.toLocaleString()}`)
    .join('\n');

  const inclusions = (data.costIncludes || []).map((inc) => `  ✅ ${inc}`).join('\n');
  const exclusions = (data.costExcludes || []).map((exc) => `  ❌ ${exc}`).join('\n');

  const schedule = (data.itineraryDays || [])
    .map(
      (day) =>
        `*Day ${day.dayNumber}: ${day.title}*\n` +
        (day.items || []).map((it) => `  ⏱ ${it.time} - ${it.activity}`).join('\n')
    )
    .join('\n\n');

  const links = [
    data.whatsappLink ? `  💬 *WhatsApp Group*: ${data.whatsappLink}` : '',
    data.itineraryLink ? `  📑 *Full Itinerary (PDF/Link)*: ${data.itineraryLink}` : '',
    data.faqLink ? `  ❓ *FAQ & Docs*: ${data.faqLink}` : '',
  ].filter(Boolean).join('\n');

  const addOns =
    data.addOns && data.addOns.length > 0
      ? `\n\n*Optional Add-ons:*\n` +
        data.addOns
          .map((a) => `  ➕ ${a.name}: ${data.currency} ${a.price.toLocaleString()} (${a.unit})`)
          .join('\n')
      : '';

  return `🏔️ *WALK NEPAL WALK — ${hikeNum}* 🏔️
*${data.title}*

📅 *Date:* ${data.hikeDate || 'TBA'}
📍 *Meeting Point:* ${data.overview.meetingPoint || 'Kathmandu'}
⏱️ *Duration:* ${data.overview.expectedDuration || '6 Hours'}
⛰️ *Difficulty:* ${data.overview.difficulty || 'Easy / Moderate'}
📏 *Distance & Elevation:* ${data.overview.approxDistance} (${data.overview.elevationRange})
👤 *Team Leader:* ${data.teamLeader || 'TBD'}
👥 *Max Capacity:* ${data.maxCapacity || 'TBD'} hikers

💰 *Package Pricing:*
${priceLines}
_${data.pricingNotes || 'Standard per person package'}_

📋 *Cost Includes:*
${inclusions}

🚫 *Cost Excludes:*
${exclusions}${addOns}

🗓️ *Day-by-Day Schedule:*
${schedule}

🔗 *Important Links:*
${links || '  (Links provided in coordinator group)'}

📝 *How to Book:*
1. Review the itinerary and confirm your physical fitness.
2. Complete the registration form.
3. Make advance payment deposit and send receipt screenshot to WhatsApp: *+977-9803568612*.
4. Join the official event WhatsApp coordination group!

📞 *Helpline:* ${data.helpContacts.join(' | ')}
🌐 *Walk Nepal Walk Community*`;
}

