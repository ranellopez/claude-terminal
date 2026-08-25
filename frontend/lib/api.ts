// frontend/lib/api.ts
import type {
  Plan, PlanFull, Profile, Question, ChatMessage, ChatResponse, WeekPlan,
  BronelResponse, ChatSessionSummary, ChatSessionFull,
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} }
  if (body !== undefined) {
    ;(opts.headers as Record<string, string>)['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const getProfile = () => req<Profile | Record<string, never>>('GET', '/api/profile')
export const putProfile = (p: Profile) => req<{ ok: boolean }>('PUT', '/api/profile', p)
export const getQuestions = () => req<Question[]>('GET', '/api/questions')
export const generatePlan = (p: Profile) => req<{ ok: boolean; plan: WeekPlan }>('POST', '/api/plans/generate', p)
export const listPlans = () => req<Plan[]>('GET', '/api/plans')
export const getPlan = (id: number) => req<PlanFull>('GET', `/api/plans/${id}`)
export const updatePlan = (id: number, plan: WeekPlan) => req<{ ok: boolean }>('PUT', `/api/plans/${id}`, { plan })
export const restorePlan = (id: number) => req<{ ok: boolean }>('POST', `/api/plans/${id}/restore`, {})
export const deletePlan = (id: number) => req<{ ok: boolean }>('DELETE', `/api/plans/${id}`)
export const postMealCheck = (foodDesc: string) => req<{ feedback: string }>('POST', '/api/meal-check', { food_desc: foodDesc })
export const postChat = (messages: ChatMessage[], profile: Partial<Profile>) =>
  req<ChatResponse>('POST', '/api/chat', { messages, profile })
export const postChatGenerate = (messages: ChatMessage[], profile: Partial<Profile>) =>
  req<{ ok: boolean; plan: WeekPlan }>('POST', '/api/chat/generate', { messages, profile })

export const postBronelChat = (messages: ChatMessage[]) =>
  req<BronelResponse>('POST', '/api/bronel/chat', { messages })

export const listChats = (bot?: string) =>
  req<ChatSessionSummary[]>('GET', bot ? `/api/chats?bot=${encodeURIComponent(bot)}` : '/api/chats')
export const createChat = (bot: string, title: string, messages: ChatMessage[] = []) =>
  req<{ id: number; title: string; created_at: string }>('POST', '/api/chats', { bot, title, messages })
export const getChat = (id: number) => req<ChatSessionFull>('GET', `/api/chats/${id}`)
export const updateChat = (id: number, patch: { title?: string; messages?: ChatMessage[]; is_ready?: boolean }) =>
  req<{ ok: boolean }>('PUT', `/api/chats/${id}`, patch)
export const deleteChat = (id: number) => req<{ ok: boolean }>('DELETE', `/api/chats/${id}`)
