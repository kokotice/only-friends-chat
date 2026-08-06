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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crates: {
        Row: {
          blurb: string | null
          cost: number
          key: string
          name: string
          odds: Json
          sort: number
        }
        Insert: {
          blurb?: string | null
          cost: number
          key: string
          name: string
          odds: Json
          sort?: number
        }
        Update: {
          blurb?: string | null
          cost?: number
          key?: string
          name?: string
          odds?: Json
          sort?: number
        }
        Relationships: []
      }
      gambling_bets: {
        Row: {
          created_at: string
          game: string
          id: string
          payout: number
          result: Json
          user_id: string
          wager: number
        }
        Insert: {
          created_at?: string
          game: string
          id?: string
          payout: number
          result?: Json
          user_id: string
          wager: number
        }
        Update: {
          created_at?: string
          game?: string
          id?: string
          payout?: number
          result?: Json
          user_id?: string
          wager?: number
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_profile_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          seat_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          seat_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          seat_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          host_id: string
          id: string
          started_at: string
          title: string | null
        }
        Insert: {
          host_id: string
          id?: string
          started_at?: string
          title?: string | null
        }
        Update: {
          host_id?: string
          id?: string
          started_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_host_profile_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          id: string
          video_url: string
          view_count: number
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          id?: string
          video_url: string
          view_count?: number
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          video_url?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_theme: string
          avatar_url: string | null
          bio: string | null
          boost_until: string | null
          created_at: string
          display_name: string | null
          gen_claimed_at: string | null
          gen_until: string | null
          id: string
          last_bet_at: string | null
          last_daily_at: string | null
          max_upload_mb: number
          sparks: number
          username: string
          vip_tier: string | null
          vip_until: string | null
        }
        Insert: {
          active_theme?: string
          avatar_url?: string | null
          bio?: string | null
          boost_until?: string | null
          created_at?: string
          display_name?: string | null
          gen_claimed_at?: string | null
          gen_until?: string | null
          id: string
          last_bet_at?: string | null
          last_daily_at?: string | null
          max_upload_mb?: number
          sparks?: number
          username: string
          vip_tier?: string | null
          vip_until?: string | null
        }
        Update: {
          active_theme?: string
          avatar_url?: string | null
          bio?: string | null
          boost_until?: string | null
          created_at?: string
          display_name?: string | null
          gen_claimed_at?: string | null
          gen_until?: string | null
          id?: string
          last_bet_at?: string | null
          last_daily_at?: string | null
          max_upload_mb?: number
          sparks?: number
          username?: string
          vip_tier?: string | null
          vip_until?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          subscribed_to_id: string
          subscriber_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscribed_to_id: string
          subscriber_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscribed_to_id?: string
          subscriber_id?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          ac_c: number
          ac_h: number
          ac_l: number
          bg_c: number
          bg_h: number
          bg_l: number
          blurb: string | null
          created_at: string
          feed_bonus: number
          key: string
          luck_bonus: number
          name: string
          rarity: string
          spark_bonus: number
        }
        Insert: {
          ac_c: number
          ac_h: number
          ac_l: number
          bg_c: number
          bg_h: number
          bg_l: number
          blurb?: string | null
          created_at?: string
          feed_bonus?: number
          key: string
          luck_bonus?: number
          name: string
          rarity: string
          spark_bonus?: number
        }
        Update: {
          ac_c?: number
          ac_h?: number
          ac_l?: number
          bg_c?: number
          bg_h?: number
          bg_l?: number
          blurb?: string | null
          created_at?: string
          feed_bonus?: number
          key?: string
          luck_bonus?: number
          name?: string
          rarity?: string
          spark_bonus?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          meta: Json
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          created_at: string
          theme_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          theme_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          theme_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_themes_theme_key_fkey"
            columns: ["theme_key"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _bet_gate: { Args: never; Returns: undefined }
      _luck: { Args: { _uid: string }; Returns: number }
      _sparks_adjust: {
        Args: { _delta: number; _kind: string; _meta?: Json; _uid: string }
        Returns: number
      }
      _vip_bonus: { Args: { _uid: string }; Returns: number }
      are_friends: { Args: { u1: string; u2: string }; Returns: boolean }
      boost_profile: { Args: never; Returns: string }
      buy_spark_generator: { Args: never; Returns: string }
      buy_upload_boost: { Args: never; Returns: number }
      buy_vip: { Args: { _tier: string }; Returns: string }
      change_display_name: { Args: { _new: string }; Returns: string }
      change_username: { Args: { _new: string }; Returns: string }
      claim_daily: { Args: never; Returns: number }
      claim_generator: { Args: never; Returns: number }
      create_group: { Args: { _name: string }; Returns: string }
      create_post: {
        Args: { _bytes: number; _caption: string; _video_url: string }
        Returns: string
      }
      equip_theme: { Args: { _key: string }; Returns: string }
      feed_ranked: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          author_id: string
          avatar_url: string
          caption: string
          comment_count: number
          created_at: string
          display_name: string
          id: string
          like_count: number
          liked_by_me: boolean
          score: number
          share_count: number
          subscribed: boolean
          tier: string
          username: string
          video_url: string
          view_count: number
        }[]
      }
      gamble_coinflip: {
        Args: { _pick: string; _wager: number }
        Returns: Json
      }
      gamble_dice: { Args: { _pick: string; _wager: number }; Returns: Json }
      gamble_slots: { Args: { _wager: number }; Returns: Json }
      gamble_wheel: { Args: { _wager: number }; Returns: Json }
      group_add_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: number
      }
      group_buy_seat: { Args: { _group_id: string }; Returns: number }
      increment_post_view: { Args: { p_id: string }; Returns: undefined }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      open_crate: { Args: { _key: string }; Returns: Json }
      record_share: { Args: { _post_id: string }; Returns: number }
      theme_perks: {
        Args: { _uid: string }
        Returns: {
          feed: number
          luck: number
          spark: number
        }[]
      }
      tip_user: { Args: { _amount: number; _to: string }; Returns: number }
      top_creators: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          subscribed_by_me: boolean
          subscriber_count: number
          username: string
        }[]
      }
      top_posts: {
        Args: { _metric: string }
        Returns: {
          author_id: string
          avatar_url: string
          caption: string
          created_at: string
          display_name: string
          id: string
          like_count: number
          metric_value: number
          share_count: number
          username: string
          video_url: string
          view_count: number
        }[]
      }
      upload_cost: { Args: { _bytes: number }; Returns: number }
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
