export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      dealers: {
        Row: {
          active_listings_count: number | null
          city: string | null
          dealer_page_url: string | null
          dealer_website_url: string | null
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          name_normalized: string | null
          name_raw: string | null
        }
        Insert: {
          active_listings_count?: number | null
          city?: string | null
          dealer_page_url?: string | null
          dealer_website_url?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          name_normalized?: string | null
          name_raw?: string | null
        }
        Update: {
          active_listings_count?: number | null
          city?: string | null
          dealer_page_url?: string | null
          dealer_website_url?: string | null
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          name_normalized?: string | null
          name_raw?: string | null
        }
        Relationships: []
      }
      listing_snapshots: {
        Row: {
          captured_at: string
          content_hash: string | null
          id: string
          listing_id: string
          mileage: number | null
          mileage_changed: boolean | null
          price: number | null
          price_changed: boolean | null
          price_delta: number | null
          status: string
          status_changed: boolean | null
        }
        Insert: {
          captured_at?: string
          content_hash?: string | null
          id?: string
          listing_id: string
          mileage?: number | null
          mileage_changed?: boolean | null
          price?: number | null
          price_changed?: boolean | null
          price_delta?: number | null
          status: string
          status_changed?: boolean | null
        }
        Update: {
          captured_at?: string
          content_hash?: string | null
          id?: string
          listing_id?: string
          mileage?: number | null
          mileage_changed?: boolean | null
          price?: number | null
          price_changed?: boolean | null
          price_delta?: number | null
          status?: string
          status_changed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_snapshots_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          content_hash: string | null
          courantheid_score: number | null
          courantheid_trend: string | null
          dealer_city: string | null
          dealer_id: string | null
          dealer_name: string | null
          first_seen_at: string
          fuel_type: string | null
          id: string
          is_normalized: boolean | null
          last_seen_at: string
          make: string | null
          mileage: number | null
          model: string | null
          normalization_confidence: number | null
          power_pk: number | null
          previous_price: number | null
          price: number | null
          raw_listing_id: string | null
          sitemap_lastmod: string | null
          source: string
          status: string
          title: string
          transmission: string | null
          url: string
          vehicle_fingerprint: string | null
          year: number | null
        }
        Insert: {
          content_hash?: string | null
          courantheid_score?: number | null
          courantheid_trend?: string | null
          dealer_city?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          first_seen_at?: string
          fuel_type?: string | null
          id?: string
          is_normalized?: boolean | null
          last_seen_at?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          normalization_confidence?: number | null
          power_pk?: number | null
          previous_price?: number | null
          price?: number | null
          raw_listing_id?: string | null
          sitemap_lastmod?: string | null
          source: string
          status?: string
          title: string
          transmission?: string | null
          url: string
          vehicle_fingerprint?: string | null
          year?: number | null
        }
        Update: {
          content_hash?: string | null
          courantheid_score?: number | null
          courantheid_trend?: string | null
          dealer_city?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          first_seen_at?: string
          fuel_type?: string | null
          id?: string
          is_normalized?: boolean | null
          last_seen_at?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          normalization_confidence?: number | null
          power_pk?: number | null
          previous_price?: number | null
          price?: number | null
          raw_listing_id?: string | null
          sitemap_lastmod?: string | null
          source?: string
          status?: string
          title?: string
          transmission?: string | null
          url?: string
          vehicle_fingerprint?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_listings_dealer"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_raw_listing_id_fkey"
            columns: ["raw_listing_id"]
            isOneToOne: false
            referencedRelation: "raw_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_listings: {
        Row: {
          consecutive_misses: number | null
          content_hash: string
          dealer_city_raw: string | null
          dealer_name_raw: string | null
          dealer_page_url: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          portal_listing_id: string | null
          raw_mileage: string | null
          raw_price: string | null
          raw_specs: Json | null
          raw_title: string
          raw_year: string | null
          scraped_at: string
          source: string
          url: string
        }
        Insert: {
          consecutive_misses?: number | null
          content_hash: string
          dealer_city_raw?: string | null
          dealer_name_raw?: string | null
          dealer_page_url?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          portal_listing_id?: string | null
          raw_mileage?: string | null
          raw_price?: string | null
          raw_specs?: Json | null
          raw_title: string
          raw_year?: string | null
          scraped_at?: string
          source: string
          url: string
        }
        Update: {
          consecutive_misses?: number | null
          content_hash?: string
          dealer_city_raw?: string | null
          dealer_name_raw?: string | null
          dealer_page_url?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          portal_listing_id?: string | null
          raw_mileage?: string | null
          raw_price?: string | null
          raw_specs?: Json | null
          raw_title?: string
          raw_year?: string | null
          scraped_at?: string
          source?: string
          url?: string
        }
        Relationships: []
      }
      scraper_configs: {
        Row: {
          delay_between_requests_ms: number | null
          discovery_frequency_minutes: number | null
          enabled: boolean | null
          gone_after_consecutive_misses: number | null
          id: string
          max_listings_per_run: number | null
          max_pages_per_run: number | null
          paused: boolean | null
          source: string
          updated_at: string | null
        }
        Insert: {
          delay_between_requests_ms?: number | null
          discovery_frequency_minutes?: number | null
          enabled?: boolean | null
          gone_after_consecutive_misses?: number | null
          id?: string
          max_listings_per_run?: number | null
          max_pages_per_run?: number | null
          paused?: boolean | null
          source: string
          updated_at?: string | null
        }
        Update: {
          delay_between_requests_ms?: number | null
          discovery_frequency_minutes?: number | null
          enabled?: boolean | null
          gone_after_consecutive_misses?: number | null
          id?: string
          max_listings_per_run?: number | null
          max_pages_per_run?: number | null
          paused?: boolean | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scraper_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_log: Json | null
          errors_count: number | null
          id: string
          job_type: string
          listings_found: number | null
          listings_gone: number | null
          listings_new: number | null
          listings_updated: number | null
          pages_processed: number | null
          source: string
          started_at: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_log?: Json | null
          errors_count?: number | null
          id?: string
          job_type: string
          listings_found?: number | null
          listings_gone?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          pages_processed?: number | null
          source: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_log?: Json | null
          errors_count?: number | null
          id?: string
          job_type?: string
          listings_found?: number | null
          listings_gone?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          pages_processed?: number | null
          source?: string
          started_at?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
