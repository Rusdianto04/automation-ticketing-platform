/**
 * features/chatbot/chatbot.types.ts
 */

export interface ChatbotInteraction {
  id:                number;
  ticket_id:         number | null;
  user_id:           string;
  user_name:         string;
  question:          string;
  answer:            string;
  intent:            string;
  processing_time_ms: number;
  created_at:        string;
}

export interface ChatbotStats {
  statistics:         { intent: string; intent_count: number; avg_processing_time: number }[];
  recentInteractions: { user_name: string; intent: string; created_at: string }[];
}

export interface Runbook {
  id:           number;
  category:     string;
  title:        string;
  content:      string;
  keywords:     string[];
  usage_count:  number;
  success_rate: number;
}
