export type UserRole = 'admin' | 'member';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  user_id: string;
  name: string;
  reason: string;
  status: RequestStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  bio: string;
  dp_url: string;
}

export interface Message {
  id: string;
  sender_id: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  created_at: string;
  // Joined fields
  profiles?: Profile;
}
