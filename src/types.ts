export interface ParticipantCount {
  total: number;
  male: number;
  female: number;
}

export interface Trek {
  id: string;
  hike_number?: string;
  name: string;
  date: string;
  days: string | number;
  difficulty: 'easy' | 'moderate' | 'difficult';
  leader?: string;
  capacity: number;
  itinerary?: string;
  itinerary_link?: string;
  faq_link?: string;
  whatsapp_link?: string;
  participants?: number;
  participants_by_gender?: ParticipantCount;
  recent_participants?: Array<{
    name: string;
    gender: 'm' | 'f';
  }>;
  elevation?: string;
  start_location?: string;
  featured_image?: string;
  price?: number | string;
  distance?: string;
  fitness_level?: string;
  season?: string;
  type_of_trail?: string;
  is_cancelled?: boolean;
  cancellation_reason?: string;
  status?: 'draft' | 'published' | 'archived' | string;
  data?: any;
}

export interface TeamMember {
  full_name: string;
  gender: string;
  age_group?: string;
  phone?: string;
}

export interface BookingFormData {
  trek_id: string;
  trek_name?: string;
  trek_date?: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  emergency_contact?: string;
  email: string;
  profession?: string;
  is_group?: 'Solo' | 'Group';
  age_group: string;
  gender: string;
  team_members?: TeamMember[];
  has_medical?: string;
  specify_medical?: string;
  recent_hikes?: string;
  agree_rules?: string;
  guide_preference?: string;
  transport_preference?: string;
  suggestions?: string;
}

export interface Booking {
  id: number | string;
  trek_id: string;
  hike_number?: string;
  user_email: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  emergency_contact?: string;
  email?: string;
  profession?: string;
  is_group?: 'Solo' | 'Group';
  age_group: string;
  gender: string;
  joined_at: string;
  trek_name?: string;
  trek_date?: string;
  trek_difficulty?: string;
  trek_days?: string | number;
  pax?: number;
  team_members?: TeamMember[];
  has_medical?: string;
  specify_medical?: string;
  recent_hikes?: string;
  agree_rules?: string;
  guide_preference?: string;
  transport_preference?: string;
  suggestions?: string;
  itinerary_link?: string;
  faq_link?: string;
  whatsapp_link?: string;
  is_cancelled?: boolean;
  cancellation_reason?: string;
  status?: string;
  payment_status?: string;
  paid_amount?: number;
  due_amount?: number;
  pickup_point?: string;
  admin_notes?: string;
}

export interface Invite {
  code: string;
  trek_id: string;
  created_by: string;
  used_count: number;
  created_at: string;
}

export interface TrekFeedback {
  id?: string;
  name: string;
  email?: string;
  recentWalk: string;
  hikeNumber?: string;
  teamFeedback: string;
  teamRating: number;
  overallFeedback: string;
  overallRating: number;
  submittedAt?: string;
}

export interface PhotoComment {
  id: string;
  photoId: string;
  userUid: string;
  userName: string;
  userAvatar?: string;
  commentText: string;
  createdAt: string;
}

