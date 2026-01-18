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
      dealer_stats: {
        Row: {
          avg_days_on_market: number | null
          avg_price: number | null
          created_at: string | null
          dealer_id: string | null
          id: string
          listings_count: number | null
          period_end: string
          period_start: string
          price_strategy: string | null
          sold_count: number | null
          top_makes: Json | null
          top_models: Json | null
          total_revenue: number | null
        }
        Insert: {
          avg_days_on_market?: number | null
          avg_price?: number | null
          created_at?: string | null
          dealer_id?: string | null
          id?: string
          listings_count?: number | null
          period_end: string
          period_start: string
          price_strategy?: string | null
          sold_count?: number | null
          top_makes?: Json | null
          top_models?: Json | null
          total_revenue?: number | null
        }
        Update: {
          avg_days_on_market?: number | null
          avg_price?: number | null
          created_at?: string | null
          dealer_id?: string | null
          id?: string
          listings_count?: number | null
          period_end?: string
          period_start?: string
          price_strategy?: string | null
          sold_count?: number | null
          top_makes?: Json | null
          top_models?: Json | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_stats_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
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
          battery_capacity_kwh: number | null
          body_type: string | null
          canonical_url: string | null
          chosen_detail_source: string | null
          chosen_detail_url: string | null
          color: string | null
          content_hash: string | null
          courantheid_score: number | null
          courantheid_trend: string | null
          dealer_city: string | null
          dealer_id: string | null
          dealer_name: string | null
          description_raw: string | null
          detail_attempts: number | null
          detail_completeness_score: number | null
          detail_scraped_at: string | null
          detail_status: string | null
          doors: number | null
          drivetrain: string | null
          electric_range_km: number | null
          engine_cc: number | null
          first_seen_at: string
          fuel_type: string | null
          generation: string | null
          gone_detected_at: string | null
          id: string
          image_count: number | null
          image_url_main: string | null
          is_normalized: boolean | null
          last_detail_error: string | null
          last_seen_at: string
          license_plate: string | null
          license_plate_hash: string | null
          make: string | null
          mileage: number | null
          mileage_bucket: number | null
          model: string | null
          needs_detail_rescrape: boolean | null
          normalization_confidence: number | null
          options_parsed: string[] | null
          options_raw: string | null
          outbound_links: Json | null
          outbound_sources: string[] | null
          power_pk: number | null
          previous_price: number | null
          price: number | null
          price_bucket: number | null
          raw_listing_id: string | null
          registration_date: string | null
          sitemap_lastmod: string | null
          sold_confirmed_at: string | null
          source: string
          status: string
          title: string
          transmission: string | null
          url: string
          vehicle_fingerprint: string | null
          vin: string | null
          vin_hash: string | null
          year: number | null
        }
        Insert: {
          battery_capacity_kwh?: number | null
          body_type?: string | null
          canonical_url?: string | null
          chosen_detail_source?: string | null
          chosen_detail_url?: string | null
          color?: string | null
          content_hash?: string | null
          courantheid_score?: number | null
          courantheid_trend?: string | null
          dealer_city?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          description_raw?: string | null
          detail_attempts?: number | null
          detail_completeness_score?: number | null
          detail_scraped_at?: string | null
          detail_status?: string | null
          doors?: number | null
          drivetrain?: string | null
          electric_range_km?: number | null
          engine_cc?: number | null
          first_seen_at?: string
          fuel_type?: string | null
          generation?: string | null
          gone_detected_at?: string | null
          id?: string
          image_count?: number | null
          image_url_main?: string | null
          is_normalized?: boolean | null
          last_detail_error?: string | null
          last_seen_at?: string
          license_plate?: string | null
          license_plate_hash?: string | null
          make?: string | null
          mileage?: number | null
          mileage_bucket?: number | null
          model?: string | null
          needs_detail_rescrape?: boolean | null
          normalization_confidence?: number | null
          options_parsed?: string[] | null
          options_raw?: string | null
          outbound_links?: Json | null
          outbound_sources?: string[] | null
          power_pk?: number | null
          previous_price?: number | null
          price?: number | null
          price_bucket?: number | null
          raw_listing_id?: string | null
          registration_date?: string | null
          sitemap_lastmod?: string | null
          sold_confirmed_at?: string | null
          source: string
          status?: string
          title: string
          transmission?: string | null
          url: string
          vehicle_fingerprint?: string | null
          vin?: string | null
          vin_hash?: string | null
          year?: number | null
        }
        Update: {
          battery_capacity_kwh?: number | null
          body_type?: string | null
          canonical_url?: string | null
          chosen_detail_source?: string | null
          chosen_detail_url?: string | null
          color?: string | null
          content_hash?: string | null
          courantheid_score?: number | null
          courantheid_trend?: string | null
          dealer_city?: string | null
          dealer_id?: string | null
          dealer_name?: string | null
          description_raw?: string | null
          detail_attempts?: number | null
          detail_completeness_score?: number | null
          detail_scraped_at?: string | null
          detail_status?: string | null
          doors?: number | null
          drivetrain?: string | null
          electric_range_km?: number | null
          engine_cc?: number | null
          first_seen_at?: string
          fuel_type?: string | null
          generation?: string | null
          gone_detected_at?: string | null
          id?: string
          image_count?: number | null
          image_url_main?: string | null
          is_normalized?: boolean | null
          last_detail_error?: string | null
          last_seen_at?: string
          license_plate?: string | null
          license_plate_hash?: string | null
          make?: string | null
          mileage?: number | null
          mileage_bucket?: number | null
          model?: string | null
          needs_detail_rescrape?: boolean | null
          normalization_confidence?: number | null
          options_parsed?: string[] | null
          options_raw?: string | null
          outbound_links?: Json | null
          outbound_sources?: string[] | null
          power_pk?: number | null
          previous_price?: number | null
          price?: number | null
          price_bucket?: number | null
          raw_listing_id?: string | null
          registration_date?: string | null
          sitemap_lastmod?: string | null
          sold_confirmed_at?: string | null
          source?: string
          status?: string
          title?: string
          transmission?: string | null
          url?: string
          vehicle_fingerprint?: string | null
          vin?: string | null
          vin_hash?: string | null
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
      market_segments: {
        Row: {
          avg_days_on_market: number | null
          avg_price: number | null
          courantheid_score: number | null
          created_at: string | null
          filters: Json
          id: string
          last_calculated_at: string | null
          median_price: number | null
          name: string
          sales_last_30_days: number | null
          trend: string | null
          updated_at: string | null
          window_size: number | null
        }
        Insert: {
          avg_days_on_market?: number | null
          avg_price?: number | null
          courantheid_score?: number | null
          created_at?: string | null
          filters?: Json
          id?: string
          last_calculated_at?: string | null
          median_price?: number | null
          name: string
          sales_last_30_days?: number | null
          trend?: string | null
          updated_at?: string | null
          window_size?: number | null
        }
        Update: {
          avg_days_on_market?: number | null
          avg_price?: number | null
          courantheid_score?: number | null
          created_at?: string | null
          filters?: Json
          id?: string
          last_calculated_at?: string | null
          median_price?: number | null
          name?: string
          sales_last_30_days?: number | null
          trend?: string | null
          updated_at?: string | null
          window_size?: number | null
        }
        Relationships: []
      }
      mileage_coefficients: {
        Row: {
          b_eur_per_km: number
          id: string
          model_key: string
          n_samples: number
          r_squared: number | null
          updated_at: string | null
          year_band: string
        }
        Insert: {
          b_eur_per_km: number
          id?: string
          model_key: string
          n_samples: number
          r_squared?: number | null
          updated_at?: string | null
          year_band: string
        }
        Update: {
          b_eur_per_km?: number
          id?: string
          model_key?: string
          n_samples?: number
          r_squared?: number | null
          updated_at?: string | null
          year_band?: string
        }
        Relationships: []
      }
      option_premiums: {
        Row: {
          calculated_at: string | null
          id: string
          iqr_lower: number | null
          iqr_upper: number | null
          make: string
          option_key: string
          premium_median: number | null
          sample_size: number | null
        }
        Insert: {
          calculated_at?: string | null
          id?: string
          iqr_lower?: number | null
          iqr_upper?: number | null
          make: string
          option_key: string
          premium_median?: number | null
          sample_size?: number | null
        }
        Update: {
          calculated_at?: string | null
          id?: string
          iqr_lower?: number | null
          iqr_upper?: number | null
          make?: string
          option_key?: string
          premium_median?: number | null
          sample_size?: number | null
        }
        Relationships: []
      }
      portal_configs: {
        Row: {
          created_at: string
          enabled: boolean
          frequency_minutes: number
          id: string
          last_success_at: string | null
          name: string
          portal_id: string
          priority: number
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency_minutes?: number
          id?: string
          last_success_at?: string | null
          name: string
          portal_id: string
          priority?: number
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency_minutes?: number
          id?: string
          last_success_at?: string | null
          name?: string
          portal_id?: string
          priority?: number
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      raw_listings: {
        Row: {
          canonical_url: string | null
          chosen_detail_source: string | null
          chosen_detail_url: string | null
          consecutive_misses: number | null
          content_hash: string
          dealer_city_raw: string | null
          dealer_name_raw: string | null
          dealer_page_url: string | null
          description_raw: string | null
          detail_scraped_at: string | null
          first_seen_at: string
          html_detail: string | null
          html_detail_size: number | null
          id: string
          image_count: number | null
          image_url_main: string | null
          last_seen_at: string
          options_raw_html: string | null
          options_raw_list: string[] | null
          options_raw_text: string | null
          outbound_links: Json | null
          portal_listing_id: string | null
          raw_mileage: string | null
          raw_price: string | null
          raw_specs: Json | null
          raw_title: string
          raw_year: string | null
          scraped_at: string
          source: string
          url: string
          vin_hash: string | null
        }
        Insert: {
          canonical_url?: string | null
          chosen_detail_source?: string | null
          chosen_detail_url?: string | null
          consecutive_misses?: number | null
          content_hash: string
          dealer_city_raw?: string | null
          dealer_name_raw?: string | null
          dealer_page_url?: string | null
          description_raw?: string | null
          detail_scraped_at?: string | null
          first_seen_at?: string
          html_detail?: string | null
          html_detail_size?: number | null
          id?: string
          image_count?: number | null
          image_url_main?: string | null
          last_seen_at?: string
          options_raw_html?: string | null
          options_raw_list?: string[] | null
          options_raw_text?: string | null
          outbound_links?: Json | null
          portal_listing_id?: string | null
          raw_mileage?: string | null
          raw_price?: string | null
          raw_specs?: Json | null
          raw_title: string
          raw_year?: string | null
          scraped_at?: string
          source: string
          url: string
          vin_hash?: string | null
        }
        Update: {
          canonical_url?: string | null
          chosen_detail_source?: string | null
          chosen_detail_url?: string | null
          consecutive_misses?: number | null
          content_hash?: string
          dealer_city_raw?: string | null
          dealer_name_raw?: string | null
          dealer_page_url?: string | null
          description_raw?: string | null
          detail_scraped_at?: string | null
          first_seen_at?: string
          html_detail?: string | null
          html_detail_size?: number | null
          id?: string
          image_count?: number | null
          image_url_main?: string | null
          last_seen_at?: string
          options_raw_html?: string | null
          options_raw_list?: string[] | null
          options_raw_text?: string | null
          outbound_links?: Json | null
          portal_listing_id?: string | null
          raw_mileage?: string | null
          raw_price?: string | null
          raw_specs?: Json | null
          raw_title?: string
          raw_year?: string | null
          scraped_at?: string
          source?: string
          url?: string
          vin_hash?: string | null
        }
        Relationships: []
      }
      scraper_configs: {
        Row: {
          delay_between_requests_ms: number | null
          discovery_frequency_minutes: number | null
          enabled: boolean | null
          error_rate_threshold: number | null
          gone_after_consecutive_misses: number | null
          id: string
          max_credits_per_day: number | null
          max_listings_per_run: number | null
          max_pages_per_run: number | null
          parse_quality_threshold: number | null
          paused: boolean | null
          source: string
          updated_at: string | null
        }
        Insert: {
          delay_between_requests_ms?: number | null
          discovery_frequency_minutes?: number | null
          enabled?: boolean | null
          error_rate_threshold?: number | null
          gone_after_consecutive_misses?: number | null
          id?: string
          max_credits_per_day?: number | null
          max_listings_per_run?: number | null
          max_pages_per_run?: number | null
          parse_quality_threshold?: number | null
          paused?: boolean | null
          source: string
          updated_at?: string | null
        }
        Update: {
          delay_between_requests_ms?: number | null
          discovery_frequency_minutes?: number | null
          enabled?: boolean | null
          error_rate_threshold?: number | null
          gone_after_consecutive_misses?: number | null
          id?: string
          max_credits_per_day?: number | null
          max_listings_per_run?: number | null
          max_pages_per_run?: number | null
          parse_quality_threshold?: number | null
          paused?: boolean | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scraper_credit_usage: {
        Row: {
          created_at: string
          credits_used: number
          date: string
          detail_requests: number | null
          id: string
          jobs_count: number | null
          sitemap_requests: number | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          date?: string
          detail_requests?: number | null
          id?: string
          jobs_count?: number | null
          sitemap_requests?: number | null
          source: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          date?: string
          detail_requests?: number | null
          id?: string
          jobs_count?: number | null
          sitemap_requests?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraper_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          credits_used: number | null
          detail_requests: number | null
          duration_seconds: number | null
          error_log: Json | null
          error_rate: number | null
          errors_count: number | null
          id: string
          job_type: string
          listings_found: number | null
          listings_gone: number | null
          listings_new: number | null
          listings_updated: number | null
          pages_processed: number | null
          parse_success_rate: number | null
          sitemap_requests: number | null
          source: string
          started_at: string | null
          status: string
          stop_reason: string | null
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits_used?: number | null
          detail_requests?: number | null
          duration_seconds?: number | null
          error_log?: Json | null
          error_rate?: number | null
          errors_count?: number | null
          id?: string
          job_type: string
          listings_found?: number | null
          listings_gone?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          pages_processed?: number | null
          parse_success_rate?: number | null
          sitemap_requests?: number | null
          source: string
          started_at?: string | null
          status?: string
          stop_reason?: string | null
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits_used?: number | null
          detail_requests?: number | null
          duration_seconds?: number | null
          error_log?: Json | null
          error_rate?: number | null
          errors_count?: number | null
          id?: string
          job_type?: string
          listings_found?: number | null
          listings_gone?: number | null
          listings_new?: number | null
          listings_updated?: number | null
          pages_processed?: number | null
          parse_success_rate?: number | null
          sitemap_requests?: number | null
          source?: string
          started_at?: string | null
          status?: string
          stop_reason?: string | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      valuation_cache: {
        Row: {
          avg_days_on_market: number | null
          calculated_at: string | null
          courantheid_score: number | null
          fuel_type: string | null
          id: string
          live_count: number | null
          live_median: number | null
          make: string
          model: string
          sold_count: number | null
          sold_median: number | null
          trend_7d_vs_30d: number | null
        }
        Insert: {
          avg_days_on_market?: number | null
          calculated_at?: string | null
          courantheid_score?: number | null
          fuel_type?: string | null
          id?: string
          live_count?: number | null
          live_median?: number | null
          make: string
          model: string
          sold_count?: number | null
          sold_median?: number | null
          trend_7d_vs_30d?: number | null
        }
        Update: {
          avg_days_on_market?: number | null
          calculated_at?: string | null
          courantheid_score?: number | null
          fuel_type?: string | null
          id?: string
          live_count?: number | null
          live_median?: number | null
          make?: string
          model?: string
          sold_count?: number | null
          sold_median?: number | null
          trend_7d_vs_30d?: number | null
        }
        Relationships: []
      }
      vehicle_events: {
        Row: {
          created_at: string | null
          days_on_market: number | null
          event_at: string
          event_type: string
          fuel_type: string | null
          id: string
          is_real_sale: boolean | null
          license_plate_hash: string | null
          listing_id: string
          make: string | null
          mileage: number | null
          model: string | null
          price_at_event: number | null
          reason: Json | null
          vehicle_fingerprint: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          days_on_market?: number | null
          event_at?: string
          event_type: string
          fuel_type?: string | null
          id?: string
          is_real_sale?: boolean | null
          license_plate_hash?: string | null
          listing_id: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          price_at_event?: number | null
          reason?: Json | null
          vehicle_fingerprint?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          days_on_market?: number | null
          event_at?: string
          event_type?: string
          fuel_type?: string | null
          id?: string
          is_real_sale?: boolean | null
          license_plate_hash?: string | null
          listing_id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          price_at_event?: number | null
          reason?: Json | null
          vehicle_fingerprint?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          dealer_id: string | null
          id: string
          is_active: boolean | null
          listing_id: string | null
          segment_id: string | null
          threshold: Json | null
          trigger_data: Json | null
          triggered_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          dealer_id?: string | null
          id?: string
          is_active?: boolean | null
          listing_id?: string | null
          segment_id?: string | null
          threshold?: Json | null
          trigger_data?: Json | null
          triggered_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          dealer_id?: string | null
          id?: string
          is_active?: boolean | null
          listing_id?: string | null
          segment_id?: string | null
          threshold?: Json | null
          trigger_data?: Json | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_alerts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_alerts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_alerts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "market_segments"
            referencedColumns: ["id"]
          },
        ]
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
