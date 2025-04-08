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
      users: {
        Row: {
          id: number
          username: string
          password: string
          coins: number
          team_id: string | null
          avatar: string | null
          email: string | null
          is_public_profile: boolean | null
        }
        Insert: {
          id?: number
          username: string
          password: string
          coins?: number
          team_id?: string | null
          avatar?: string | null
          email?: string | null
          is_public_profile?: boolean | null
        }
        Update: {
          id?: number
          username?: string
          password?: string
          coins?: number
          team_id?: string | null
          avatar?: string | null
          email?: string | null
          is_public_profile?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          created_at: string
          owner_id: number
          rank: number
          points: number
          logo: string | null
          is_public: boolean | null
          description: string | null
        }
        Insert: {
          id: string
          name: string
          created_at?: string
          owner_id: number
          rank?: number
          points?: number
          logo?: string | null
          is_public?: boolean | null
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          owner_id?: number
          rank?: number
          points?: number
          logo?: string | null
          is_public?: boolean | null
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      players: {
        Row: {
          id: string
          name: string
          team: string
          avatar: string | null
          points: number
          price: number
          rarity: string
          role: string
          user_id: number | null
          team_id: string | null
          is_team_captain: boolean | null
          eliminations: number
          win_rate: number
          kd: number
          accuracy: number | null
          build_speed: number | null
          clutch_factor: number | null
          consistency: number | null
          tournaments: number | null
          avg_placement: number | null
          last_updated_at: string
          historical_performance: string | null
          weekly_points: number | null
          monthly_points: number | null
          season_points: number | null
          season_trend: string | null
        }
        Insert: {
          id: string
          name: string
          team: string
          avatar?: string | null
          points?: number
          price?: number
          rarity?: string
          role?: string
          user_id?: number | null
          team_id?: string | null
          is_team_captain?: boolean | null
          eliminations?: number
          win_rate?: number
          kd?: number
          accuracy?: number | null
          build_speed?: number | null
          clutch_factor?: number | null
          consistency?: number | null
          tournaments?: number | null
          avg_placement?: number | null
          last_updated_at?: string
          historical_performance?: string | null
          weekly_points?: number | null
          monthly_points?: number | null
          season_points?: number | null
          season_trend?: string | null
        }
        Update: {
          id?: string
          name?: string
          team?: string
          avatar?: string | null
          points?: number
          price?: number
          rarity?: string
          role?: string
          user_id?: number | null
          team_id?: string | null
          is_team_captain?: boolean | null
          eliminations?: number
          win_rate?: number
          kd?: number
          accuracy?: number | null
          build_speed?: number | null
          clutch_factor?: number | null
          consistency?: number | null
          tournaments?: number | null
          avg_placement?: number | null
          last_updated_at?: string
          historical_performance?: string | null
          weekly_points?: number | null
          monthly_points?: number | null
          season_points?: number | null
          season_trend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      team_members: {
        Row: {
          id: number
          team_id: string
          user_id: number
          joined_at: string
          role: string | null
        }
        Insert: {
          id?: number
          team_id: string
          user_id: number
          joined_at?: string
          role?: string | null
        }
        Update: {
          id?: number
          team_id?: string
          user_id?: number
          joined_at?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tournaments: {
        Row: {
          id: string
          name: string
          date: string
          time: string
          type: string
          prize_pool: number
          registered_teams: number
          max_teams: number
          description: string | null
          status: string | null
        }
        Insert: {
          id: string
          name: string
          date: string
          time: string
          type: string
          prize_pool: number
          registered_teams?: number
          max_teams: number
          description?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          name?: string
          date?: string
          time?: string
          type?: string
          prize_pool?: number
          registered_teams?: number
          max_teams?: number
          description?: string | null
          status?: string | null
        }
        Relationships: []
      }
      paypal_transactions: {
        Row: {
          id: string
          paypal_transaction_id: string
          user_id: number
          amount: number
          currency: string
          type: string
          status: string
          created_at: string
          completed_at: string | null
          paypal_response: Json | null
        }
        Insert: {
          id: string
          paypal_transaction_id: string
          user_id: number
          amount: number
          currency?: string
          type: string
          status?: string
          created_at?: string
          completed_at?: string | null
          paypal_response?: Json | null
        }
        Update: {
          id?: string
          paypal_transaction_id?: string
          user_id?: number
          amount?: number
          currency?: string
          type?: string
          status?: string
          created_at?: string
          completed_at?: string | null
          paypal_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "paypal_transactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      money_pools: {
        Row: {
          id: string
          tournament_id: string
          total_amount: number
          currency: string
          status: string
          created_at: string
          closed_at: string | null
          winner_id: number | null
          distributed: boolean
        }
        Insert: {
          id: string
          tournament_id: string
          total_amount?: number
          currency?: string
          status?: string
          created_at?: string
          closed_at?: string | null
          winner_id?: number | null
          distributed?: boolean
        }
        Update: {
          id?: string
          tournament_id?: string
          total_amount?: number
          currency?: string
          status?: string
          created_at?: string
          closed_at?: string | null
          winner_id?: number | null
          distributed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "money_pools_tournament_id_fkey"
            columns: ["tournament_id"]
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_pools_winner_id_fkey"
            columns: ["winner_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      money_pool_contributions: {
        Row: {
          id: string
          money_pool_id: string
          user_id: number
          amount: number
          currency: string
          transaction_id: string | null
          status: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id: string
          money_pool_id: string
          user_id: number
          amount: number
          currency?: string
          transaction_id?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          money_pool_id?: string
          user_id?: number
          amount?: number
          currency?: string
          transaction_id?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "money_pool_contributions_money_pool_id_fkey"
            columns: ["money_pool_id"]
            referencedRelation: "money_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "money_pool_contributions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_create_table: {
        Args: {
          table_name: string
          create_statement: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
