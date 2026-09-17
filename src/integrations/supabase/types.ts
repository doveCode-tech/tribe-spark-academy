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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          performed_by: string | null
          status: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          performed_by?: string | null
          status: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          performed_by?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          color: string | null
          created_at: string
          criteria: Json | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_data: Json | null
          completion_date: string
          course_id: string | null
          course_title: string
          founder_name: string | null
          id: string
          issued_at: string
          quiz_attempt_id: string | null
          student_id: string
          student_name: string
        }
        Insert: {
          certificate_data?: Json | null
          completion_date?: string
          course_id?: string | null
          course_title: string
          founder_name?: string | null
          id?: string
          issued_at?: string
          quiz_attempt_id?: string | null
          student_id: string
          student_name: string
        }
        Update: {
          certificate_data?: Json | null
          completion_date?: string
          course_id?: string | null
          course_title?: string
          founder_name?: string | null
          id?: string
          issued_at?: string
          quiz_attempt_id?: string | null
          student_id?: string
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_quiz_attempt_id_fkey"
            columns: ["quiz_attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string | null
          edited_at: string | null
          id: string
          message: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      code_templates: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          language: string
          template: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          language: string
          template: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_tutors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          course_id: string
          id: string
          tutor_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          course_id: string
          id?: string
          tutor_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          course_id?: string
          id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_tutors_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          capstone_project_description: string | null
          capstone_project_title: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          title: string | null
        }
        Insert: {
          capstone_project_description?: string | null
          capstone_project_title?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string | null
        }
        Update: {
          capstone_project_description?: string | null
          capstone_project_title?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string | null
        }
        Relationships: []
      }
      enrollment_requests: {
        Row: {
          course_id: string
          id: string
          note: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          student_id: string
        }
        Update: {
          course_id?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string | null
          enrolled_at: string | null
          enrolled_by: string | null
          id: string
          progress_percentage: number | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          course_id?: string | null
          enrolled_at?: string | null
          enrolled_by?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          course_id?: string | null
          enrolled_at?: string | null
          enrolled_by?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      game_scores: {
        Row: {
          completed: boolean
          game_id: string | null
          id: string
          played_at: string
          score: number
          student_id: string
        }
        Insert: {
          completed?: boolean
          game_id?: string | null
          id?: string
          played_at?: string
          score?: number
          student_id: string
        }
        Update: {
          completed?: boolean
          game_id?: string | null
          id?: string
          played_at?: string
          score?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          game_data: Json
          game_type: string
          id: string
          lesson_number: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          game_data?: Json
          game_type: string
          id?: string
          lesson_number: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          game_data?: Json
          game_type?: string
          id?: string
          lesson_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity: {
        Row: {
          activity_date: string
          activity_type: string
          course_id: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          points_earned: number | null
          student_id: string
        }
        Insert: {
          activity_date: string
          activity_type: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          points_earned?: number | null
          student_id: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          points_earned?: number | null
          student_id?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string | null
          score: number | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          score?: number | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          score?: number | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          assignment_data: Json | null
          assignment_required: boolean | null
          content: string | null
          content_type: string | null
          course_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_of_course_pass_percentage: number
          end_of_course_quiz_enabled: boolean
          exercises: Json | null
          id: string
          instructions: string | null
          is_end_of_course: boolean | null
          order_index: number
          quiz_data: Json | null
          quiz_required: boolean | null
          title: string
          updated_at: string
          video_url: string | null
          video_urls: string[] | null
          youtube_urls: string[] | null
        }
        Insert: {
          assignment_data?: Json | null
          assignment_required?: boolean | null
          content?: string | null
          content_type?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_of_course_pass_percentage?: number
          end_of_course_quiz_enabled?: boolean
          exercises?: Json | null
          id?: string
          instructions?: string | null
          is_end_of_course?: boolean | null
          order_index?: number
          quiz_data?: Json | null
          quiz_required?: boolean | null
          title: string
          updated_at?: string
          video_url?: string | null
          video_urls?: string[] | null
          youtube_urls?: string[] | null
        }
        Update: {
          assignment_data?: Json | null
          assignment_required?: boolean | null
          content?: string | null
          content_type?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_of_course_pass_percentage?: number
          end_of_course_quiz_enabled?: boolean
          exercises?: Json | null
          id?: string
          instructions?: string | null
          is_end_of_course?: boolean | null
          order_index?: number
          quiz_data?: Json | null
          quiz_required?: boolean | null
          title?: string
          updated_at?: string
          video_url?: string | null
          video_urls?: string[] | null
          youtube_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          recipient_role: string | null
          recipient_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          recipient_role?: string | null
          recipient_user_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          recipient_role?: string | null
          recipient_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          student_id: string
          theme_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          student_id: string
          theme_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          student_id?: string
          theme_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          code_content: string | null
          course_id: string | null
          description: string | null
          editor_type: string | null
          feedback: string | null
          file_path: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          lesson_id: string | null
          link: string | null
          portfolio_id: string | null
          review_status: string | null
          screenshot: string | null
          student_id: string | null
          submitted_at: string | null
          title: string | null
        }
        Insert: {
          code_content?: string | null
          course_id?: string | null
          description?: string | null
          editor_type?: string | null
          feedback?: string | null
          file_path?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          lesson_id?: string | null
          link?: string | null
          portfolio_id?: string | null
          review_status?: string | null
          screenshot?: string | null
          student_id?: string | null
          submitted_at?: string | null
          title?: string | null
        }
        Update: {
          code_content?: string | null
          course_id?: string | null
          description?: string | null
          editor_type?: string | null
          feedback?: string | null
          file_path?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          lesson_id?: string | null
          link?: string | null
          portfolio_id?: string | null
          review_status?: string | null
          screenshot?: string | null
          student_id?: string | null
          submitted_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_extensions: {
        Row: {
          created_at: string
          extra_attempts: number
          granted_by: string
          id: string
          quiz_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          extra_attempts?: number
          granted_by: string
          id?: string
          quiz_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          extra_attempts?: number
          granted_by?: string
          id?: string
          quiz_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_extensions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          completed_at: string | null
          course_id: string | null
          created_at: string
          id: string
          passed: boolean
          quiz_id: string | null
          score: number
          started_at: string
          student_id: string
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string | null
          score?: number
          started_at?: string
          student_id: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          passed?: boolean
          quiz_id?: string | null
          score?: number
          started_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          attempts_allowed: number | null
          course_id: string | null
          created_at: string
          description: string | null
          id: string
          lesson_id: string | null
          pass_percentage: number | null
          questions: Json
          title: string
          updated_at: string
        }
        Insert: {
          attempts_allowed?: number | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lesson_id?: string | null
          pass_percentage?: number | null
          questions?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          attempts_allowed?: number | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lesson_id?: string | null
          pass_percentage?: number | null
          questions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          attachments: Json | null
          content: string
          course_id: string | null
          created_at: string
          grade: number | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_comments: string | null
          status: string | null
          student_id: string
          submitted_at: string | null
          title: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          course_id?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comments?: string | null
          status?: string | null
          student_id: string
          submitted_at?: string | null
          title: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          course_id?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_comments?: string | null
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_by: string | null
          badge_id: string | null
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          awarded_by?: string | null
          badge_id?: string | null
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          awarded_by?: string | null
          badge_id?: string | null
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      study_goals: {
        Row: {
          created_at: string | null
          id: string
          student_id: string
          target_days_per_week: number | null
          target_minutes_per_day: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          student_id: string
          target_days_per_week?: number | null
          target_minutes_per_day?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          student_id?: string
          target_days_per_week?: number | null
          target_minutes_per_day?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          completed_at: string | null
          course_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          lesson_id: string | null
          notes: string | null
          scheduled_date: string
          scheduled_time: string | null
          status: string | null
          student_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          lesson_id?: string | null
          notes?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: string | null
          student_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          lesson_id?: string | null
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string | null
          student_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plans_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_activity_date: string | null
          longest_streak: number | null
          streak_freezes_remaining: number | null
          student_id: string
          total_learning_days: number | null
          updated_at: string | null
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          streak_freezes_remaining?: number | null
          student_id: string
          total_learning_days?: number | null
          updated_at?: string | null
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          streak_freezes_remaining?: number | null
          student_id?: string
          total_learning_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          approved: boolean
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_access: string | null
          last_login: string | null
          last_name: string | null
          name: string | null
          parent_email: string | null
          phone: string | null
          report_required: boolean | null
          role: string | null
          role_level: number | null
          suspended: boolean | null
          username: string | null
        }
        Insert: {
          approved?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_access?: string | null
          last_login?: string | null
          last_name?: string | null
          name?: string | null
          parent_email?: string | null
          phone?: string | null
          report_required?: boolean | null
          role?: string | null
          role_level?: number | null
          suspended?: boolean | null
          username?: string | null
        }
        Update: {
          approved?: boolean
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_access?: string | null
          last_login?: string | null
          last_name?: string | null
          name?: string | null
          parent_email?: string | null
          phone?: string | null
          report_required?: boolean | null
          role?: string | null
          role_level?: number | null
          suspended?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_enrollment_request: {
        Args: { _note?: string; _request_id: string }
        Returns: undefined
      }
      admin_approve_user: {
        Args: { _auth_user_id: string }
        Returns: undefined
      }
      admin_enroll_user: {
        Args: { _course_id: string; _user_id: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          approved: boolean
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_access: string | null
          last_login: string | null
          last_name: string | null
          name: string | null
          parent_email: string | null
          phone: string | null
          report_required: boolean | null
          role: string | null
          role_level: number | null
          suspended: boolean | null
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reject_enrollment_request: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      admin_suspend_user: {
        Args: { _suspended?: boolean; _user_id: string }
        Returns: undefined
      }
      admin_unenroll_student: {
        Args: { _course_id: string; _reason?: string; _student_id: string }
        Returns: undefined
      }
      award_badge: {
        Args: { _badge_id: string; _student_id: string }
        Returns: undefined
      }
      award_milestone_badge: {
        Args: { _badge_name: string; _student_id?: string }
        Returns: Json
      }
      award_streak_badges: { Args: never; Returns: undefined }
      check_enrollment_request_status: {
        Args: { _request_id: string }
        Returns: string
      }
      cleanup_resolved_notifications: {
        Args: { _request_id: string }
        Returns: undefined
      }
      ensure_user_profile_exists: {
        Args: { _auth_user_id: string }
        Returns: undefined
      }
      generate_certificate: {
        Args: {
          _course_id: string
          _quiz_attempt_id: string
          _student_id: string
        }
        Returns: string
      }
      get_learning_activity_calendar: {
        Args: { _end_date?: string; _start_date?: string; _student_id?: string }
        Returns: {
          activity_count: number
          activity_date: string
          activity_types: string[]
          points_earned: number
        }[]
      }
      get_unresolved_enrollment_notifications: {
        Args: never
        Returns: {
          created_at: string
          data: Json
          id: string
          message: string
          read: boolean
          recipient_role: string
          recipient_user_id: string
          request_status: string
          title: string
          type: string
        }[]
      }
      get_user_streak: { Args: { _student_id?: string }; Returns: Json }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_tutor_or_admin: { Args: { user_id: string }; Returns: boolean }
      is_ultimate_tutor_or_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      record_learning_activity: {
        Args: {
          _activity_type: string
          _course_id?: string
          _lesson_id?: string
          _points?: number
        }
        Returns: Json
      }
      submit_student_project: {
        Args: {
          _code_content?: string
          _course_id: string
          _description?: string
          _editor_type?: string
          _file_path?: string
          _lesson_id?: string
          _link?: string
          _title?: string
        }
        Returns: Json
      }
      use_streak_freeze: { Args: never; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
