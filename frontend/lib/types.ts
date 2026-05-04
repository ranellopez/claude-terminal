// frontend/lib/types.ts
export type Plan = {
  id: number
  week_start: string
  is_current: boolean
  goal: string
  gym_days: number
  rest_days: number
  meal_prep_day: string
  daily_calorie_target: number
  protein_target_g: number
}

export type Exercise = { name: string; sets: number; reps: string }
export type Meals = { breakfast?: string; lunch?: string; dinner?: string; snack?: string }

export type DayPlan = {
  type: 'gym' | 'rest' | 'meal_prep'
  exercises?: Exercise[]
  activity?: string
  prep_tasks?: string[]
  meals?: Meals
}

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export type WeekPlan = Partial<Record<DayKey, DayPlan>>
export type PlanFull = { id: number; plan: WeekPlan }

export type Profile = {
  id?: number
  goal: string
  gym_days: string
  rest_days: string
  meal_prep_day: string
  fitness_level: string
  equipment: string
  dietary_preference: string
  allergies: string
  daily_calorie_target: number
  protein_target_g: number
}

export type QuestionOption = { value: string; label: string }

export type Question = {
  key: string
  question: string
  why: string
  type: 'single' | 'multi' | 'text' | 'targets'
  options?: QuestionOption[]
  placeholder?: string
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatResponse = { message: string; ready: boolean }
