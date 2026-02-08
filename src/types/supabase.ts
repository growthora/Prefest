export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          event_date: string
          location: string
          image_url: string | null
          category: string | null
          price: number
          max_participants: number | null
          current_participants: number
          creator_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          event_date: string
          location: string
          image_url?: string | null
          category?: string | null
          price?: number
          max_participants?: number | null
          current_participants?: number
          creator_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          event_date?: string
          location?: string
          image_url?: string | null
          category?: string | null
          price?: number
          max_participants?: number | null
          current_participants?: number
          creator_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      event_participants: {
        Row: {
          id: string
          event_id: string
          user_id: string
          ticket_quantity: number
          total_paid: number | null
          joined_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          ticket_quantity?: number
          total_paid?: number | null
          joined_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          ticket_quantity?: number
          total_paid?: number | null
          joined_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          event_id: string | null
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          event_id?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          user1_id?: string
          user2_id?: string
          event_id?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          match_id: string
          sender_id: string
          content: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          match_id: string
          sender_id: string
          content: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          match_id?: string
          sender_id?: string
          content?: string
          created_at?: string
          read_at?: string | null
        }
      }
    }
  }
}
