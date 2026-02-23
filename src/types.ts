export interface Habit {
  id: number;
  name: string;
  icon: string;
  color: string;
  frequency: string;
  created_at: string;
}

export interface Completion {
  id: number;
  habit_id: number;
  completed_at: string;
  proof_image_url?: string;
}

export interface HabitWithStatus extends Habit {
  completedToday: boolean;
  proofImageUrl?: string;
}
