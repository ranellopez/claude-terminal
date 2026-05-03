# Vercel Next.js Frontend Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the meal/gym planner frontend from `static/` (vanilla HTML/CSS/JS) into a Next.js 15 app in `frontend/`, deployed on Vercel with a Whoop/Strong-inspired dark design.

**Architecture:** Next.js App Router lives in `frontend/` subdirectory. All API calls go directly from the browser to `NEXT_PUBLIC_API_URL` (Railway backend). State managed with `useState` at the root page, passed down as props. CSS Modules with CSS custom properties. Vercel root directory set to `frontend/`.

**Tech Stack:** Next.js 15, TypeScript, CSS Modules, Jest, React Testing Library

---

### Task 1: Scaffold Next.js project and test infrastructure

**Files:**
- Create: `frontend/` (Next.js project)
- Create: `frontend/jest.config.ts`
- Create: `frontend/jest.setup.ts`
- Create: `frontend/.env.local`

- [ ] **Step 1: Scaffold the project**

```bash
cd /Users/ranel/Developer/claude-terminal
npx create-next-app@latest frontend --typescript --eslint --no-tailwind --app --import-alias "@/*" --no-turbopack
```

When prompted for `src/` directory → **No**. Accept all other defaults.

Expected: `frontend/` created with `app/`, `public/`, `package.json`, `next.config.ts`, `tsconfig.json`

- [ ] **Step 2: Install test dependencies**

```bash
cd frontend
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest
```

Expected: packages added to `devDependencies` in `package.json`

- [ ] **Step 3: Create `jest.config.ts`**

```typescript
// frontend/jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 4: Create `jest.setup.ts`**

```typescript
// frontend/jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

In `frontend/package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Create `.env.local`**

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: `▲ Next.js 15.x.x` / `Local: http://localhost:3000`

Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/
git commit -m "feat: scaffold Next.js 15 frontend with Jest test infrastructure"
```

---

### Task 2: Types and API layer

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/lib/__tests__/api.test.ts
const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000'
})

describe('listPlans', () => {
  it('GETs /api/plans', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => [] })
    const { listPlans } = await import('../api')
    await listPlans()
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/plans',
      expect.objectContaining({ method: 'GET' })
    )
  })
})

describe('generatePlan', () => {
  it('POSTs to /api/plans/generate', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ ok: true, plan: {} }) })
    const { generatePlan } = await import('../api')
    const profile = {
      goal: 'build_muscle', gym_days: 'Mon,Wed,Fri', rest_days: 'Tue,Thu,Sat,Sun',
      meal_prep_day: 'Sun', fitness_level: 'intermediate', equipment: 'dumbbells',
      dietary_preference: 'none', allergies: 'none', daily_calorie_target: 2800, protein_target_g: 180,
    }
    await generatePlan(profile)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/plans/generate',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('postChat', () => {
  it('POSTs to /api/chat with messages and profile', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ message: 'Hi', ready: false }) })
    const { postChat } = await import('../api')
    await postChat([{ role: 'user', content: 'Hello' }], {})
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/chat',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- lib/__tests__/api.test.ts
```

Expected: FAIL — `Cannot find module '../api'`

- [ ] **Step 3: Create `lib/types.ts`**

```typescript
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

export type WeekPlan = Record<string, DayPlan>
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
```

- [ ] **Step 4: Create `lib/api.ts`**

```typescript
// frontend/lib/api.ts
import type { Plan, PlanFull, Profile, Question, ChatMessage, ChatResponse, WeekPlan } from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} }
  if (body !== undefined) {
    ;(opts.headers as Record<string, string>)['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- lib/__tests__/api.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/lib/
git commit -m "feat: add TypeScript types and API layer"
```

---

### Task 3: Global styles and layout

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace `app/globals.css`**

```css
/* frontend/app/globals.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0a;
  --surface: #111111;
  --surface-raised: #1a1a1a;
  --accent: #c0f000;
  --accent-dim: rgba(192, 240, 0, 0.12);
  --text: #ffffff;
  --text-muted: #888888;
  --text-dim: #555555;
  --border: #222222;
  --danger: #ff4040;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

button { cursor: pointer; font-family: inherit; }
input  { font-family: inherit; }
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Planner',
  description: 'Meal prep, gym plan & rest day scheduler',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat: add Whoop/Strong design system CSS variables"
```

---

### Task 4: Toast component

**Files:**
- Create: `frontend/components/Toast/Toast.tsx`
- Create: `frontend/components/Toast/Toast.module.css`
- Create: `frontend/components/Toast/__tests__/Toast.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/Toast/__tests__/Toast.test.tsx
import { render, screen } from '@testing-library/react'
import Toast from '../Toast'

describe('Toast', () => {
  it('is not visible when visible=false', () => {
    const { container } = render(<Toast message="Hi" visible={false} onHide={jest.fn()} />)
    expect(container.firstChild).not.toHaveClass('show')
  })

  it('renders message text when visible', () => {
    render(<Toast message="Plan saved!" visible={true} onHide={jest.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Plan saved!')
  })

  it('applies success modifier when type=success', () => {
    const { container } = render(<Toast message="Done" type="success" visible={true} onHide={jest.fn()} />)
    expect(container.firstChild?.toString()).toBeTruthy()
    expect(screen.getByRole('status').className).toContain('success')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- components/Toast/__tests__/Toast.test.tsx
```

Expected: FAIL — `Cannot find module '../Toast'`

- [ ] **Step 3: Create `Toast.tsx`**

```tsx
// frontend/components/Toast/Toast.tsx
'use client'
import { useEffect, useRef } from 'react'
import styles from './Toast.module.css'

interface Props {
  message: string
  type?: 'success' | ''
  visible: boolean
  onHide: () => void
}

export default function Toast({ message, type = '', visible, onHide }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (visible) {
      clearTimeout(timer.current)
      timer.current = setTimeout(onHide, 3000)
    }
    return () => clearTimeout(timer.current)
  }, [visible, message, onHide])

  return (
    <div
      role="status"
      aria-live="polite"
      className={[styles.toast, visible ? styles.show : '', type === 'success' ? styles.success : ''].join(' ')}
    >
      {message}
    </div>
  )
}
```

- [ ] **Step 4: Create `Toast.module.css`**

```css
/* frontend/components/Toast/Toast.module.css */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 200;
}
.show    { opacity: 1; }
.success { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- components/Toast/__tests__/Toast.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/components/Toast/
git commit -m "feat: add Toast notification component"
```

---

### Task 5: PlansTab component

**Files:**
- Create: `frontend/components/PlansTab/PlansTab.tsx`
- Create: `frontend/components/PlansTab/PlansTab.module.css`
- Create: `frontend/components/PlansTab/__tests__/PlansTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/PlansTab/__tests__/PlansTab.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlansTab from '../PlansTab'
import type { Plan } from '@/lib/types'

jest.mock('@/lib/api', () => ({
  getPlan: jest.fn().mockResolvedValue({ id: 1, plan: { Mon: { type: 'gym', exercises: [], meals: {} } } }),
  restorePlan: jest.fn().mockResolvedValue({ ok: true }),
  deletePlan: jest.fn().mockResolvedValue({ ok: true }),
}))

const plan: Plan = {
  id: 1, week_start: '2026-04-28', is_current: true, goal: 'build_muscle',
  gym_days: 3, rest_days: 4, meal_prep_day: 'Sun', daily_calorie_target: 2800, protein_target_g: 180,
}

describe('PlansTab', () => {
  it('shows empty state when no plans', () => {
    render(<PlansTab plans={[]} onRestore={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />)
    expect(screen.getByText(/no saved plans yet/i)).toBeInTheDocument()
  })

  it('renders plan card with date and meta', () => {
    render(<PlansTab plans={[plan]} onRestore={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />)
    expect(screen.getByText(/week of/i)).toBeInTheDocument()
    expect(screen.getByText(/build muscle/i)).toBeInTheDocument()
    expect(screen.getByText(/2800/)).toBeInTheDocument()
  })

  it('shows CURRENT badge for current plan', () => {
    render(<PlansTab plans={[plan]} onRestore={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />)
    expect(screen.getByText('CURRENT')).toBeInTheDocument()
  })

  it('calls onEdit with plan id', () => {
    const onEdit = jest.fn()
    render(<PlansTab plans={[plan]} onRestore={jest.fn()} onDelete={jest.fn()} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith(1)
  })

  it('expands view when View button clicked', async () => {
    render(<PlansTab plans={[plan]} onRestore={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} />)
    fireEvent.click(screen.getByText('View ▾'))
    await waitFor(() => expect(screen.getByText('DAILY KCAL')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- components/PlansTab/__tests__/PlansTab.test.tsx
```

Expected: FAIL — `Cannot find module '../PlansTab'`

- [ ] **Step 3: Create `PlansTab.tsx`**

```tsx
// frontend/components/PlansTab/PlansTab.tsx
'use client'
import { useState } from 'react'
import type { Plan, PlanFull, DayPlan, Exercise } from '@/lib/types'
import { getPlan, restorePlan as apiRestore, deletePlan as apiDelete } from '@/lib/api'
import styles from './PlansTab.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

interface Props {
  plans: Plan[]
  onRestore: () => void
  onDelete: () => void
  onEdit: (id: number) => void
}

export default function PlansTab({ plans, onRestore, onDelete, onEdit }: Props) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [fullPlans, setFullPlans] = useState<Record<number, PlanFull>>({})
  const [activeDay, setActiveDay] = useState<Record<number, string>>({})

  if (!plans.length) {
    return <p className={styles.empty}>No saved plans yet. Use New Plan to generate one.</p>
  }

  async function toggleView(id: number) {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    if (!fullPlans[id]) {
      const full = await getPlan(id)
      setFullPlans(prev => ({ ...prev, [id]: full }))
    }
    setActiveDay(prev => ({ ...prev, [id]: prev[id] ?? 'Mon' }))
  }

  async function handleRestore(id: number) {
    await apiRestore(id)
    onRestore()
  }

  async function handleDelete(id: number) {
    await apiDelete(id)
    onDelete()
  }

  return (
    <div className={styles.list}>
      {plans.map(plan => {
        const dateStr = new Date(plan.week_start + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
        const isOpen = openId === plan.id
        const full = fullPlans[plan.id]
        const day = activeDay[plan.id] ?? 'Mon'

        return (
          <div key={plan.id} className={`${styles.card} ${plan.is_current ? styles.cardCurrent : ''}`}>
            <div className={styles.header}>
              <div>
                <div className={styles.title}>
                  Week of {dateStr}
                  {plan.is_current && <span className={styles.badge}>CURRENT</span>}
                </div>
                <div className={styles.meta}>
                  {plan.gym_days} gym days · {plan.goal.replace(/_/g, ' ')} · {plan.daily_calorie_target} kcal · {plan.protein_target_g}g protein
                </div>
              </div>
              <div className={styles.actions}>
                <button className={`${styles.btn} ${styles.btnView}`} onClick={() => toggleView(plan.id)}>
                  {isOpen ? 'Hide ▴' : 'View ▾'}
                </button>
                <button className={`${styles.btn} ${styles.btnEdit}`} onClick={() => onEdit(plan.id)}>Edit</button>
                {!plan.is_current && <>
                  <button className={`${styles.btn} ${styles.btnRestore}`} onClick={() => handleRestore(plan.id)}>Restore</button>
                  <button className={`${styles.btn} ${styles.btnDelete}`} onClick={() => handleDelete(plan.id)}>Delete</button>
                </>}
              </div>
            </div>

            {isOpen && full && (
              <div className={styles.view}>
                <div className={styles.statsBar}>
                  {([
                    [plan.daily_calorie_target, 'DAILY KCAL'],
                    [`${plan.protein_target_g}g`, 'PROTEIN'],
                    [`${plan.gym_days}/7`, 'GYM DAYS'],
                    [plan.meal_prep_day ?? '–', 'PREP DAY'],
                  ] as [string | number, string][]).map(([val, lbl]) => (
                    <div key={lbl} className={styles.statBox}>
                      <div className={styles.statVal}>{val}</div>
                      <div className={styles.statLbl}>{lbl}</div>
                    </div>
                  ))}
                </div>
                <div className={styles.dayTabs}>
                  {DAYS.map(d => (
                    <button
                      key={d}
                      className={`${styles.dayTab} ${d === day ? styles.dayTabActive : ''}`}
                      onClick={() => setActiveDay(prev => ({ ...prev, [plan.id]: d }))}
                    >{d}</button>
                  ))}
                </div>
                <DayContent dayData={full.plan[day]} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayContent({ dayData }: { dayData: DayPlan | undefined }) {
  if (!dayData?.type) return <p className={styles.noData}>No data for this day.</p>
  const meals = dayData.meals ?? {}

  return (
    <>
      {dayData.type === 'gym' && (
        <>
          <div className={styles.sectionLabel}>💪 WORKOUT</div>
          {(dayData.exercises ?? []).map((e: Exercise, i: number) => (
            <div key={i} className={styles.exerciseRow}>
              <span>{e.name}</span>
              <span className={styles.exerciseSets}>{e.sets} sets × {e.reps}</span>
            </div>
          ))}
        </>
      )}
      {dayData.type === 'rest' && (
        <>
          <div className={styles.sectionLabel}>🧘 REST ACTIVITY</div>
          <div className={styles.restText}>{dayData.activity ?? '–'}</div>
        </>
      )}
      {dayData.type === 'meal_prep' && (
        <>
          <div className={styles.sectionLabel}>📦 MEAL PREP</div>
          {(dayData.prep_tasks ?? []).map((t, i) => (
            <div key={i} className={styles.prepTask}>📦 {t}</div>
          ))}
        </>
      )}
      <div className={styles.sectionLabel}>🍽️ MEALS</div>
      {MEAL_TYPES.map(type => (
        <div key={type} className={styles.mealRow}>
          <span className={styles.mealType}>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          <span>{meals[type] ?? '–'}</span>
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 4: Create `PlansTab.module.css`**

```css
/* frontend/components/PlansTab/PlansTab.module.css */
.list  { display: flex; flex-direction: column; gap: 8px; }
.empty { color: var(--text-muted); font-size: 13px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.card:hover       { border-color: #333; }
.cardCurrent      { border-color: var(--accent); }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}
.title   { font-size: 14px; font-weight: 800; letter-spacing: 0.3px; }
.badge   {
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.5px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
}
.meta    { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.actions { display: flex; gap: 6px; flex-shrink: 0; }

.btn          { padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; letter-spacing: 0.5px; transition: opacity 0.15s; }
.btn:hover    { opacity: 0.8; }
.btnView      { background: var(--surface-raised); color: var(--text-muted); border: 1px solid var(--border); }
.btnEdit      { background: var(--surface-raised); color: var(--text-muted); border: 1px solid var(--border); }
.btnRestore   { background: var(--accent); color: #000; }
.btnDelete    { background: transparent; color: var(--danger); border: 1px solid var(--danger); }

.view    { border-top: 1px solid var(--border); padding: 16px; }

.statsBar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.statBox  { background: var(--surface-raised); border-radius: 8px; padding: 10px; text-align: center; }
.statVal  { font-size: 18px; font-weight: 800; color: var(--accent); }
.statLbl  { font-size: 9px; font-weight: 800; color: var(--text-dim); letter-spacing: 1.5px; margin-top: 2px; text-transform: uppercase; }

.dayTabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.dayTab  {
  padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 800;
  border: 1px solid var(--border); color: var(--text-muted); background: transparent;
  letter-spacing: 0.5px; transition: all 0.15s;
}
.dayTab:hover:not(.dayTabActive) { border-color: var(--accent); color: var(--accent); }
.dayTabActive { background: var(--accent); color: #000; border-color: var(--accent); }

.sectionLabel {
  font-size: 10px; font-weight: 800; color: var(--accent);
  text-transform: uppercase; letter-spacing: 1.5px; margin: 12px 0 6px;
}
.exerciseRow  { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.exerciseSets { font-size: 11px; color: var(--text-muted); }
.restText     { font-size: 13px; padding: 4px 0; }
.prepTask     { padding: 3px 0; font-size: 13px; }
.mealRow      { display: flex; padding: 4px 0; font-size: 13px; gap: 8px; }
.mealType     { font-size: 11px; color: var(--text-muted); width: 70px; flex-shrink: 0; }
.noData       { color: var(--text-muted); font-size: 13px; }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- components/PlansTab/__tests__/PlansTab.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/components/PlansTab/
git commit -m "feat: add PlansTab component with plan cards and expand view"
```

---

### Task 6: PlanModal component

**Files:**
- Create: `frontend/components/PlanModal/PlanModal.tsx`
- Create: `frontend/components/PlanModal/PlanModal.module.css`
- Create: `frontend/components/PlanModal/__tests__/PlanModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/PlanModal/__tests__/PlanModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import PlanModal from '../PlanModal'
import type { PlanFull } from '@/lib/types'

const mockFull: PlanFull = {
  id: 1,
  plan: {
    Mon: { type: 'gym', exercises: [{ name: 'Squat', sets: 4, reps: '8-10' }], meals: { breakfast: 'Oats', lunch: 'Chicken rice', dinner: 'Salmon', snack: 'Protein shake' } },
    Tue: { type: 'rest', activity: 'Walk', meals: { breakfast: 'Eggs', lunch: 'Salad', dinner: 'Pasta', snack: 'Fruit' } },
    Wed: { type: 'gym', exercises: [], meals: {} },
    Thu: { type: 'rest', activity: '', meals: {} },
    Fri: { type: 'gym', exercises: [], meals: {} },
    Sat: { type: 'rest', activity: '', meals: {} },
    Sun: { type: 'meal_prep', prep_tasks: ['Batch cook rice'], meals: {} },
  },
}

describe('PlanModal', () => {
  it('renders day tabs Mon through Sun', () => {
    render(<PlanModal full={mockFull} planId={1} onClose={jest.fn()} onSaved={jest.fn()} />)
    ;['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d =>
      expect(screen.getByText(d)).toBeInTheDocument()
    )
  })

  it('shows exercise inputs for gym day', () => {
    render(<PlanModal full={mockFull} planId={1} onClose={jest.fn()} onSaved={jest.fn()} />)
    expect(screen.getByDisplayValue('Squat')).toBeInTheDocument()
  })

  it('calls onClose when × button clicked', () => {
    const onClose = jest.fn()
    render(<PlanModal full={mockFull} planId={1} onClose={onClose} onSaved={jest.fn()} />)
    fireEvent.click(screen.getByText('×'))
    expect(onClose).toHaveBeenCalled()
  })

  it('switches to rest activity view when Tue tab clicked', () => {
    render(<PlanModal full={mockFull} planId={1} onClose={jest.fn()} onSaved={jest.fn()} />)
    fireEvent.click(screen.getByText('Tue'))
    expect(screen.getByDisplayValue('Walk')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- components/PlanModal/__tests__/PlanModal.test.tsx
```

Expected: FAIL — `Cannot find module '../PlanModal'`

- [ ] **Step 3: Create `PlanModal.tsx`**

```tsx
// frontend/components/PlanModal/PlanModal.tsx
'use client'
import { useState, useCallback } from 'react'
import type { PlanFull, WeekPlan, DayPlan } from '@/lib/types'
import { updatePlan } from '@/lib/api'
import styles from './PlanModal.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

interface Props {
  full: PlanFull
  planId: number
  onClose: () => void
  onSaved: () => void
}

export default function PlanModal({ full, planId, onClose, onSaved }: Props) {
  const [plan, setPlan] = useState<WeekPlan>(() => JSON.parse(JSON.stringify(full.plan)))
  const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>('Mon')
  const [saving, setSaving] = useState(false)

  const day = plan[activeDay] as DayPlan

  function updateDay(patch: Partial<DayPlan>) {
    setPlan(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], ...patch } }))
  }

  function updateMeal(type: string, value: string) {
    setPlan(prev => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], meals: { ...prev[activeDay].meals, [type]: value } },
    }))
  }

  function updateExercise(i: number, field: 'name' | 'sets' | 'reps', value: string) {
    const exercises = [...(day.exercises ?? [])]
    exercises[i] = { ...exercises[i], [field]: field === 'sets' ? parseInt(value) || 3 : value }
    updateDay({ exercises })
  }

  function addExercise() {
    updateDay({ exercises: [...(day.exercises ?? []), { name: '', sets: 3, reps: '10-12' }] })
  }

  function removeExercise(i: number) {
    const exercises = (day.exercises ?? []).filter((_, idx) => idx !== i)
    updateDay({ exercises })
  }

  function updatePrepTask(i: number, value: string) {
    const tasks = [...(day.prep_tasks ?? [])]
    tasks[i] = value
    updateDay({ prep_tasks: tasks })
  }

  function addPrepTask() {
    updateDay({ prep_tasks: [...(day.prep_tasks ?? []), ''] })
  }

  function removePrepTask(i: number) {
    updateDay({ prep_tasks: (day.prep_tasks ?? []).filter((_, idx) => idx !== i) })
  }

  async function handleSave() {
    setSaving(true)
    await updatePlan(planId, plan)
    setSaving(false)
    onSaved()
    onClose()
  }

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const meals = day?.meals ?? {}

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Edit Plan</h2>
            <p className={styles.modalSubtitle}>Edit exercises, meals, and caloric info for each day</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.dayTabs}>
          {DAYS.map(d => (
            <button
              key={d}
              className={`${styles.dayTab} ${d === activeDay ? styles.dayTabActive : ''}`}
              onClick={() => setActiveDay(d)}
            >{d}</button>
          ))}
        </div>

        <div className={styles.body}>
          {day?.type === 'gym' && (
            <div className={styles.fieldGroup}>
              <div className={styles.sectionLabel}>💪 EXERCISES</div>
              {(day.exercises ?? []).map((e, i) => (
                <div key={i} className={styles.fieldRow}>
                  <input className={`${styles.input} ${styles.inputName}`} value={e.name} placeholder="Exercise name"
                    onChange={ev => updateExercise(i, 'name', ev.target.value)} />
                  <input className={`${styles.input} ${styles.inputNum}`} value={String(e.sets)} placeholder="Sets"
                    onChange={ev => updateExercise(i, 'sets', ev.target.value)} />
                  <input className={`${styles.input} ${styles.inputNum}`} value={e.reps} placeholder="Reps"
                    onChange={ev => updateExercise(i, 'reps', ev.target.value)} />
                  <button className={styles.delBtn} onClick={() => removeExercise(i)}>×</button>
                </div>
              ))}
              <button className={`${styles.btn} ${styles.btnAdd}`} onClick={addExercise}>+ Add Exercise</button>
            </div>
          )}

          {day?.type === 'rest' && (
            <div className={styles.fieldGroup}>
              <div className={styles.sectionLabel}>🧘 REST ACTIVITY</div>
              <input className={`${styles.input} ${styles.inputWide}`} value={day.activity ?? ''}
                onChange={e => updateDay({ activity: e.target.value })} />
            </div>
          )}

          {day?.type === 'meal_prep' && (
            <div className={styles.fieldGroup}>
              <div className={styles.sectionLabel}>📦 MEAL PREP TASKS</div>
              {(day.prep_tasks ?? []).map((t, i) => (
                <div key={i} className={styles.fieldRow}>
                  <input className={`${styles.input} ${styles.inputName}`} value={t}
                    onChange={e => updatePrepTask(i, e.target.value)} />
                  <button className={styles.delBtn} onClick={() => removePrepTask(i)}>×</button>
                </div>
              ))}
              <button className={`${styles.btn} ${styles.btnAdd}`} onClick={addPrepTask}>+ Add Task</button>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <div className={styles.sectionLabel}>🍽️ MEALS</div>
            {MEAL_TYPES.map(type => (
              <div key={type} className={styles.fieldRow}>
                <span className={styles.mealLabel}>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <input className={`${styles.input} ${styles.inputName}`} value={meals[type] ?? ''}
                  onChange={e => updateMeal(type, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `PlanModal.module.css`**

```css
/* frontend/components/PlanModal/PlanModal.module.css */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  width: min(640px, 95vw); max-height: 85vh; display: flex; flex-direction: column;
}
.modalHeader {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 18px 20px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.modalTitle    { font-size: 14px; font-weight: 800; color: var(--accent); letter-spacing: 0.5px; }
.modalSubtitle { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.closeBtn      { background: none; border: none; color: var(--text-muted); font-size: 20px; line-height: 1; padding: 0 0 0 12px; }
.closeBtn:hover { color: var(--text); }

.dayTabs { display: flex; gap: 6px; padding: 12px 20px 0; flex-shrink: 0; flex-wrap: wrap; }
.dayTab  {
  padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
  border: 1px solid var(--border); color: var(--text-muted); background: transparent; transition: all 0.15s;
}
.dayTab:hover:not(.dayTabActive) { border-color: var(--accent); color: var(--accent); }
.dayTabActive { background: var(--accent); color: #000; border-color: var(--accent); }

.body    { padding: 12px 20px; overflow-y: auto; flex: 1; }
.footer  { padding: 12px 20px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-shrink: 0; }

.fieldGroup { margin-bottom: 16px; }
.sectionLabel {
  font-size: 10px; font-weight: 800; color: var(--accent); text-transform: uppercase;
  letter-spacing: 1.5px; margin-bottom: 8px;
}
.fieldRow   { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.mealLabel  { font-size: 11px; color: var(--text-muted); width: 75px; flex-shrink: 0; }

.input        { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; color: var(--text); font-size: 13px; outline: none; transition: border-color 0.15s; }
.input:focus  { border-color: var(--accent); }
.inputName    { flex: 1; }
.inputNum     { width: 70px; }
.inputWide    { width: 100%; }

.delBtn       { background: none; border: none; color: var(--danger); font-size: 16px; padding: 0 4px; line-height: 1; }
.delBtn:hover { opacity: 0.7; }

.btn          { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 800; border: none; letter-spacing: 0.5px; transition: opacity 0.15s; }
.btn:hover    { opacity: 0.8; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btnPrimary   { background: var(--accent); color: #000; }
.btnSecondary { background: var(--surface-raised); color: var(--text-muted); }
.btnAdd       { background: var(--surface-raised); color: var(--text-muted); border: 1px solid var(--border); width: 100%; margin-top: 4px; }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- components/PlanModal/__tests__/PlanModal.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/components/PlanModal/
git commit -m "feat: add PlanModal edit component"
```

---

### Task 7: NewPlanTab (wizard)

**Files:**
- Create: `frontend/components/NewPlanTab/NewPlanTab.tsx`
- Create: `frontend/components/NewPlanTab/NewPlanTab.module.css`
- Create: `frontend/components/NewPlanTab/__tests__/NewPlanTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/NewPlanTab/__tests__/NewPlanTab.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import NewPlanTab from '../NewPlanTab'
import type { Question, Profile } from '@/lib/types'

const questions: Question[] = [
  { key: 'goal', question: 'What is your goal?', why: 'Sets plan direction', type: 'single',
    options: [{ value: 'build_muscle', label: 'Build Muscle' }, { value: 'lose_weight', label: 'Lose Weight' }] },
  { key: 'allergies', question: 'Any allergies?', why: 'Personalises meals', type: 'text', placeholder: 'e.g. peanuts' },
]

const profile: Profile = {
  goal: '', gym_days: '', rest_days: '', meal_prep_day: '', fitness_level: '',
  equipment: '', dietary_preference: '', allergies: '', daily_calorie_target: 0, protein_target_g: 0,
}

describe('NewPlanTab', () => {
  it('renders first question', () => {
    render(<NewPlanTab questions={questions} profile={profile} onGenerated={jest.fn()} onToast={jest.fn()} />)
    expect(screen.getByText('What is your goal?')).toBeInTheDocument()
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
  })

  it('advances to next question on Next click', () => {
    render(<NewPlanTab questions={questions} profile={profile} onGenerated={jest.fn()} onToast={jest.fn()} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    expect(screen.getByText('Any allergies?')).toBeInTheDocument()
  })

  it('goes back when Back button clicked', () => {
    render(<NewPlanTab questions={questions} profile={profile} onGenerated={jest.fn()} onToast={jest.fn()} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByText('What is your goal?')).toBeInTheDocument()
  })

  it('shows summary after all questions', () => {
    render(<NewPlanTab questions={questions} profile={profile} onGenerated={jest.fn()} onToast={jest.fn()} />)
    fireEvent.click(screen.getByText('Build Muscle'))
    fireEvent.click(screen.getByText('Next →'))
    fireEvent.click(screen.getByText('Review →'))
    expect(screen.getByText('Review your answers')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- components/NewPlanTab/__tests__/NewPlanTab.test.tsx
```

Expected: FAIL — `Cannot find module '../NewPlanTab'`

- [ ] **Step 3: Create `NewPlanTab.tsx`**

```tsx
// frontend/components/NewPlanTab/NewPlanTab.tsx
'use client'
import { useState } from 'react'
import type { Question, Profile } from '@/lib/types'
import { generatePlan } from '@/lib/api'
import styles from './NewPlanTab.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Answers = Record<string, string | string[] | { calories: number; protein: number }>

function estimateTargets(goal: string, level: string): [number, number] {
  const t: Record<string, [number, number]> = {
    'lose_weight-beginner': [1600, 120], 'lose_weight-intermediate': [1800, 140], 'lose_weight-advanced': [2000, 160],
    'build_muscle-beginner': [2500, 160], 'build_muscle-intermediate': [2800, 180], 'build_muscle-advanced': [3200, 200],
    'maintain-beginner': [2000, 130], 'maintain-intermediate': [2200, 150], 'maintain-advanced': [2500, 160],
    'endurance-beginner': [2200, 140], 'endurance-intermediate': [2500, 160], 'endurance-advanced': [2800, 170],
  }
  return t[`${goal}-${level}`] ?? [2000, 150]
}

interface Props {
  questions: Question[]
  profile: Profile | null
  onGenerated: () => void
  onToast: (msg: string, type?: 'success' | '') => void
}

export default function NewPlanTab({ questions, profile, onGenerated, onToast }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(() => {
    if (!profile?.goal) return {}
    return {
      goal: profile.goal,
      gym_days: profile.gym_days ? profile.gym_days.split(',').map(d => d.trim()) : [],
      meal_prep_day: profile.meal_prep_day ?? '',
      fitness_level: profile.fitness_level ?? '',
      equipment: profile.equipment ? profile.equipment.split(',').map(e => e.trim()) : [],
      dietary_preference: profile.dietary_preference ?? 'none',
      allergies: profile.allergies ?? '',
      daily_targets: { calories: profile.daily_calorie_target, protein: profile.protein_target_g },
    }
  })
  const [generating, setGenerating] = useState(false)

  const total = questions.length

  function setAnswer(key: string, value: string | string[] | { calories: number; protein: number }) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleMulti(key: string, value: string) {
    const cur = (answers[key] as string[]) ?? []
    setAnswer(key, cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value])
  }

  function handleNext() {
    const q = questions[step]
    if (!q) return
    if (q.type === 'text') {
      const el = document.getElementById('wizard-text') as HTMLInputElement
      setAnswer(q.key, el?.value.trim() || 'none')
    } else if (q.type === 'targets') {
      const cal = parseInt((document.getElementById('wizard-cal') as HTMLInputElement)?.value) || 2000
      const prot = parseInt((document.getElementById('wizard-prot') as HTMLInputElement)?.value) || 150
      setAnswer(q.key, { calories: cal, protein: prot })
    }
    setStep(s => s + 1)
  }

  async function handleGenerate() {
    const a = answers
    const gymDays = Array.isArray(a.gym_days) ? a.gym_days as string[] : []
    const targets = a.daily_targets as { calories: number; protein: number } | undefined
    const p: Profile = {
      goal: (a.goal as string) || 'maintain',
      gym_days: gymDays.join(','),
      rest_days: DAYS.filter(d => !gymDays.includes(d)).join(','),
      meal_prep_day: (a.meal_prep_day as string) || 'Sun',
      fitness_level: (a.fitness_level as string) || 'beginner',
      equipment: Array.isArray(a.equipment) ? (a.equipment as string[]).join(',') : ((a.equipment as string) || 'bodyweight'),
      dietary_preference: (a.dietary_preference as string) || 'none',
      allergies: (a.allergies as string) || 'none',
      daily_calorie_target: targets?.calories || 2000,
      protein_target_g: targets?.protein || 150,
    }
    setGenerating(true)
    const res = await generatePlan(p)
    setGenerating(false)
    if (res.ok) {
      onToast('Plan generated!', 'success')
      setStep(0)
      setAnswers({})
      onGenerated()
    } else {
      onToast('Generation failed')
    }
  }

  if (step === total) {
    const a = answers
    const gymDays = Array.isArray(a.gym_days) ? (a.gym_days as string[]).join(', ') : '—'
    const equipment = Array.isArray(a.equipment) ? (a.equipment as string[]).join(', ') : '—'
    const targets = a.daily_targets as { calories: number; protein: number } | undefined
    const rows: [string, string][] = [
      ['Goal', ((a.goal as string) || '—').replace(/_/g, ' ')],
      ['Gym Days', gymDays || '—'],
      ['Meal Prep Day', (a.meal_prep_day as string) || '—'],
      ['Fitness Level', (a.fitness_level as string) || '—'],
      ['Equipment', equipment || '—'],
      ['Diet', (a.dietary_preference as string) || '—'],
      ['Allergies', (a.allergies as string) || 'none'],
      ['Calories Target', targets ? `${targets.calories} kcal` : '—'],
      ['Protein Target', targets ? `${targets.protein}g` : '—'],
    ]
    return (
      <div className={styles.wrap}>
        <div className={styles.progressHeader}>
          <div className={styles.stepLabel}>Review your answers</div>
          <div className={styles.track}><div className={styles.fill} style={{ width: '100%' }} /></div>
        </div>
        <div className={styles.card}>
          <ul className={styles.summaryList}>
            {rows.map(([k, v]) => (
              <li key={k} className={styles.summaryRow}>
                <span className={styles.summaryKey}>{k}</span>
                <span className={styles.summaryVal}>{v}</span>
              </li>
            ))}
          </ul>
          <button className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Plan ✨'}
          </button>
        </div>
        <div className={styles.nav}>
          <button className={`${styles.btn} ${styles.btnBack}`} onClick={() => setStep(s => s - 1)}>← Back</button>
        </div>
      </div>
    )
  }

  const q = questions[step]
  if (!q) return null
  const pct = Math.round(((step + 1) / (total + 1)) * 100)
  const isLast = step === total - 1
  const ans = answers[q.key]

  const [defCal, defProt] = q.type === 'targets'
    ? estimateTargets(answers.goal as string || 'maintain', answers.fitness_level as string || 'beginner')
    : [2000, 150]

  return (
    <div className={styles.wrap}>
      <div className={styles.progressHeader}>
        <div className={styles.stepLabel}>Question {step + 1} of {total}</div>
        <div className={styles.track}><div className={styles.fill} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className={styles.card}>
        <div className={styles.question}>{q.question}</div>
        <div className={styles.why}>{q.why}</div>

        {q.type === 'single' && (
          <div className={styles.choices}>
            {(q.options ?? []).map(opt => (
              <button key={opt.value}
                className={`${styles.choice} ${ans === opt.value ? styles.choiceSelected : ''}`}
                onClick={() => setAnswer(q.key, opt.value)}>{opt.label}</button>
            ))}
          </div>
        )}

        {q.type === 'multi' && (
          <div className={styles.choices}>
            {(q.options ?? []).map(opt => {
              const sel = Array.isArray(ans) && (ans as string[]).includes(opt.value)
              return (
                <button key={opt.value}
                  className={`${styles.choice} ${sel ? styles.choiceSelected : ''}`}
                  onClick={() => toggleMulti(q.key, opt.value)}>{opt.label}</button>
              )
            })}
          </div>
        )}

        {q.type === 'text' && (
          <input id="wizard-text" className={`${styles.input} ${styles.inputWide}`}
            defaultValue={(ans as string) ?? ''} placeholder={q.placeholder ?? ''} />
        )}

        {q.type === 'targets' && (
          <div className={styles.targetsRow}>
            <div>
              <div className={styles.fieldLabel}>Calories (kcal)</div>
              <input id="wizard-cal" className={`${styles.input} ${styles.inputWide}`} type="number"
                defaultValue={(ans as { calories: number })?.calories ?? defCal} />
            </div>
            <div>
              <div className={styles.fieldLabel}>Protein (g)</div>
              <input id="wizard-prot" className={`${styles.input} ${styles.inputWide}`} type="number"
                defaultValue={(ans as { protein: number })?.protein ?? defProt} />
            </div>
          </div>
        )}
      </div>
      <div className={styles.nav}>
        {step > 0 && <button className={`${styles.btn} ${styles.btnBack}`} onClick={() => setStep(s => s - 1)}>← Back</button>}
        <button className={`${styles.btn} ${styles.btnNext}`} onClick={handleNext}>{isLast ? 'Review →' : 'Next →'}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `NewPlanTab.module.css`**

```css
/* frontend/components/NewPlanTab/NewPlanTab.module.css */
.wrap { max-width: 560px; }

.progressHeader { margin-bottom: 16px; }
.stepLabel      { font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
.track          { background: var(--surface-raised); border-radius: 3px; height: 4px; overflow: hidden; }
.fill           { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s; }

.card     { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 12px; }
.question { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
.why      { font-size: 12px; color: var(--accent); font-style: italic; margin-bottom: 14px; }

.choices  { display: flex; flex-wrap: wrap; gap: 8px; }
.choice   {
  padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 700;
  background: var(--surface-raised); border: 1px solid var(--border);
  color: var(--text); transition: all 0.15s;
}
.choice:hover:not(.choiceSelected) { border-color: var(--accent); }
.choiceSelected { background: var(--accent); border-color: var(--accent); color: #000; }

.input       { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 13px; outline: none; transition: border-color 0.15s; }
.input:focus { border-color: var(--accent); }
.inputWide   { width: 100%; }
.fieldLabel  { font-size: 11px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
.targetsRow  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.nav     { display: flex; gap: 8px; }
.btn     { padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 800; border: none; letter-spacing: 0.5px; transition: opacity 0.15s; }
.btn:hover { opacity: 0.85; }
.btnNext { background: var(--accent); color: #000; flex: 1; }
.btnBack { background: var(--surface-raised); color: var(--text-muted); }

.summaryList { list-style: none; }
.summaryRow  { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.summaryKey  { color: var(--text-muted); }
.summaryVal  { font-weight: 700; }

.generateBtn {
  background: var(--accent); color: #000; border: none; border-radius: 8px;
  padding: 12px; width: 100%; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;
  margin-top: 14px; transition: opacity 0.15s;
}
.generateBtn:hover    { opacity: 0.85; }
.generateBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- components/NewPlanTab/__tests__/NewPlanTab.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/components/NewPlanTab/
git commit -m "feat: add NewPlanTab wizard component"
```

---

### Task 8: GymBotTab component

**Files:**
- Create: `frontend/components/GymBotTab/GymBotTab.tsx`
- Create: `frontend/components/GymBotTab/GymBotTab.module.css`
- Create: `frontend/components/GymBotTab/__tests__/GymBotTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/GymBotTab/__tests__/GymBotTab.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import GymBotTab from '../GymBotTab'

jest.mock('@/lib/api', () => ({
  postChat: jest.fn().mockResolvedValue({ message: 'Hello!', ready: false }),
  postChatGenerate: jest.fn().mockResolvedValue({ ok: true, plan: {} }),
}))

describe('GymBotTab', () => {
  it('renders chat header with GymBot title', () => {
    render(<GymBotTab profile={null} onGenerated={jest.fn()} onToast={jest.fn()} active={false} />)
    expect(screen.getByText('GymBot')).toBeInTheDocument()
  })

  it('renders message input and send button', () => {
    render(<GymBotTab profile={null} onGenerated={jest.fn()} onToast={jest.fn()} active={false} />)
    expect(screen.getByPlaceholderText(/message gymbot/i)).toBeInTheDocument()
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('shows New chat button', () => {
    render(<GymBotTab profile={null} onGenerated={jest.fn()} onToast={jest.fn()} active={false} />)
    expect(screen.getByText('New chat')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- components/GymBotTab/__tests__/GymBotTab.test.tsx
```

Expected: FAIL — `Cannot find module '../GymBotTab'`

- [ ] **Step 3: Create `GymBotTab.tsx`**

```tsx
// frontend/components/GymBotTab/GymBotTab.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import type { ChatMessage, Profile } from '@/lib/types'
import { postChat, postChatGenerate } from '@/lib/api'
import styles from './GymBotTab.module.css'

interface Props {
  profile: Profile | null
  onGenerated: () => void
  onToast: (msg: string, type?: 'success' | '') => void
  active: boolean
}

export default function GymBotTab({ profile, onGenerated, onToast, active }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const msgListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active && !initialized && !loading) {
      setInitialized(true)
      initChat()
    }
  }, [active])

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight
    }
  }, [messages, loading])

  async function initChat() {
    setLoading(true)
    const res = await postChat([], profile ?? {})
    setMessages([{ role: 'assistant', content: res.message }])
    setLoading(false)
  }

  async function send(text: string) {
    if (!text.trim() || loading || ready) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    const res = await postChat(next, profile ?? {})
    setMessages([...next, { role: 'assistant', content: res.message }])
    if (res.ready) setReady(true)
    setLoading(false)
  }

  async function generate() {
    setLoading(true)
    const res = await postChatGenerate(messages, profile ?? {})
    setLoading(false)
    if (res.ok) {
      onToast('Plan generated!', 'success')
      setMessages([])
      setReady(false)
      setInitialized(false)
      onGenerated()
    } else {
      onToast('Generation failed')
    }
  }

  function reset() {
    setMessages([])
    setReady(false)
    setLoading(false)
    setInitialized(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.avatar}>🤖</div>
        <div style={{ flex: 1 }}>
          <div className={styles.name}>GymBot</div>
          <div className={styles.status}>● Ready to build your plan</div>
        </div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={reset}>New chat</button>
      </div>

      <div className={styles.messages} ref={msgListRef}>
        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className={styles.botWrap}>
              <div className={styles.miniAvatar}>🤖</div>
              <div>
                <div className={styles.sender}>GymBot</div>
                <div className={styles.bubbleBot}>{m.content}</div>
              </div>
            </div>
          ) : (
            <div key={i} className={styles.userWrap}>
              <div>
                <div className={`${styles.sender} ${styles.senderRight}`}>You</div>
                <div className={styles.bubbleUser}>{m.content}</div>
              </div>
            </div>
          )
        )}

        {loading && (
          <div className={styles.botWrap}>
            <div className={styles.miniAvatar}>🤖</div>
            <div>
              <div className={styles.sender}>GymBot</div>
              <div className={`${styles.bubbleBot} ${styles.typing}`}>GymBot is thinking…</div>
            </div>
          </div>
        )}

        {ready && !loading && (
          <button className={styles.generateBtn} onClick={generate}>Generate my plan ✨</button>
        )}
      </div>

      <div className={styles.inputRow}>
        <input
          className={`${styles.input}`}
          placeholder="Message GymBot…"
          disabled={loading || ready}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const el = e.currentTarget
              send(el.value)
              el.value = ''
            }
          }}
        />
        <button
          className={styles.sendBtn}
          disabled={loading || ready}
          onClick={e => {
            const input = (e.currentTarget.previousSibling as HTMLInputElement)
            send(input.value)
            input.value = ''
          }}
        >↑</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `GymBotTab.module.css`**

```css
/* frontend/components/GymBotTab/GymBotTab.module.css */
.wrap {
  max-width: 600px;
  display: flex; flex-direction: column;
  height: 70vh; min-height: 400px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
}
.header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.avatar    { width: 38px; height: 38px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.name      { font-weight: 800; font-size: 14px; letter-spacing: 0.3px; }
.status    { font-size: 11px; color: var(--accent); margin-top: 2px; font-weight: 700; }

.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }

.botWrap  { display: flex; gap: 8px; align-items: flex-start; }
.userWrap { display: flex; justify-content: flex-end; }
.miniAvatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; margin-top: 2px; }
.sender      { font-size: 10px; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
.senderRight { text-align: right; }
.bubbleBot  { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 12px; border-top-left-radius: 3px; padding: 10px 14px; font-size: 13px; line-height: 1.5; max-width: 80%; }
.bubbleUser { background: #0f1f3d; border: 1px solid #1e3a6e; border-radius: 12px; border-top-right-radius: 3px; padding: 10px 14px; font-size: 13px; line-height: 1.5; max-width: 75%; }
.typing     { color: var(--text-muted); font-style: italic; }

.generateBtn {
  background: var(--accent); color: #000; border: none; padding: 10px 20px;
  border-radius: 8px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px;
  width: 100%; transition: opacity 0.15s;
}
.generateBtn:hover    { opacity: 0.85; }
.generateBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.inputRow { border-top: 1px solid var(--border); padding: 12px; display: flex; gap: 8px; align-items: center; flex-shrink: 0; background: var(--bg); }
.input    { flex: 1; background: var(--surface-raised); border: 1px solid var(--border); border-radius: 20px; padding: 9px 16px; color: var(--text); font-size: 13px; outline: none; transition: border-color 0.15s; }
.input:focus   { border-color: var(--accent); }
.input:disabled { opacity: 0.5; }
.sendBtn  { background: var(--accent); border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #000; font-weight: 800; flex-shrink: 0; transition: opacity 0.15s; }
.sendBtn:hover    { opacity: 0.85; }
.sendBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn          { padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 800; border: none; letter-spacing: 0.5px; }
.btnSecondary { background: var(--surface-raised); color: var(--text-muted); border: 1px solid var(--border); }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd frontend && npm test -- components/GymBotTab/__tests__/GymBotTab.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/components/GymBotTab/
git commit -m "feat: add GymBotTab chat component"
```

---

### Task 9: Root page — tabs shell

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/app/page.module.css`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/app/__tests__/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Page from '../page'

jest.mock('@/lib/api', () => ({
  listPlans: jest.fn().mockResolvedValue([]),
  getQuestions: jest.fn().mockResolvedValue([]),
  getProfile: jest.fn().mockResolvedValue({}),
  postChat: jest.fn().mockResolvedValue({ message: 'Hi', ready: false }),
}))

describe('Page', () => {
  it('renders three tab buttons', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByText(/saved plans/i)).toBeInTheDocument()
      expect(screen.getByText(/new plan/i)).toBeInTheDocument()
      expect(screen.getByText(/gymbot/i)).toBeInTheDocument()
    })
  })

  it('switches to New Plan tab on click', async () => {
    render(<Page />)
    await waitFor(() => screen.getByText(/new plan/i))
    fireEvent.click(screen.getByText(/new plan/i))
    expect(screen.getByText(/new plan/i).closest('button')).toHaveClass('tabActive')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- app/__tests__/page.test.tsx
```

Expected: FAIL — existing `page.tsx` doesn't have the expected structure

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
// frontend/app/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Plan, Question, Profile, PlanFull } from '@/lib/types'
import { listPlans, getQuestions, getProfile, getPlan } from '@/lib/api'
import PlansTab from '@/components/PlansTab/PlansTab'
import NewPlanTab from '@/components/NewPlanTab/NewPlanTab'
import GymBotTab from '@/components/GymBotTab/GymBotTab'
import PlanModal from '@/components/PlanModal/PlanModal'
import Toast from '@/components/Toast/Toast'
import styles from './page.module.css'

type Tab = 'plans' | 'new' | 'chat'

export default function Page() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('plans')
  const [modalPlanId, setModalPlanId] = useState<number | null>(null)
  const [modalFull, setModalFull] = useState<PlanFull | null>(null)
  const [toast, setToast] = useState({ message: '', type: '' as 'success' | '', visible: false })

  useEffect(() => {
    Promise.all([listPlans(), getQuestions(), getProfile()]).then(([p, q, prof]) => {
      setPlans(p)
      setQuestions(q)
      if (prof && 'goal' in prof) setProfile(prof as Profile)
    })
  }, [])

  const refreshPlans = useCallback(async () => {
    const p = await listPlans()
    setPlans(p)
  }, [])

  const showToast = useCallback((message: string, type: 'success' | '' = '') => {
    setToast({ message, type, visible: true })
  }, [])

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  async function openModal(id: number) {
    const full = await getPlan(id)
    setModalFull(full)
    setModalPlanId(id)
  }

  function closeModal() {
    setModalPlanId(null)
    setModalFull(null)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'plans', label: '📋 Saved Plans' },
    { id: 'new',   label: '✨ New Plan' },
    { id: 'chat',  label: '💬 GymBot' },
  ]

  return (
    <>
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {activeTab === 'plans' && (
        <PlansTab
          plans={plans}
          onRestore={() => { showToast('Plan restored as current week!', 'success'); refreshPlans() }}
          onDelete={() => { showToast('Plan deleted'); refreshPlans() }}
          onEdit={openModal}
        />
      )}

      {activeTab === 'new' && (
        <NewPlanTab
          questions={questions}
          profile={profile}
          onGenerated={() => { setActiveTab('plans'); refreshPlans() }}
          onToast={showToast}
        />
      )}

      {activeTab === 'chat' && (
        <GymBotTab
          profile={profile}
          onGenerated={() => { setActiveTab('plans'); refreshPlans() }}
          onToast={showToast}
          active={activeTab === 'chat'}
        />
      )}

      {modalPlanId !== null && modalFull !== null && (
        <PlanModal
          full={modalFull}
          planId={modalPlanId}
          onClose={closeModal}
          onSaved={() => { showToast('Changes saved!', 'success'); refreshPlans() }}
        />
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </>
  )
}
```

- [ ] **Step 4: Create `app/page.module.css`**

```css
/* frontend/app/page.module.css */
.tabs { display: flex; gap: 8px; margin-bottom: 24px; }
.tab  {
  padding: 8px 18px; border-radius: 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;
  border: 1px solid var(--border); color: var(--text-muted); background: transparent; transition: all 0.2s;
}
.tab:hover:not(.tabActive) { border-color: var(--accent); color: var(--accent); }
.tabActive { background: var(--accent); color: #000; border-color: var(--accent); }
```

- [ ] **Step 5: Delete the default Next.js home page content**

Open `frontend/app/page.tsx` — ensure it only contains the content written in Step 3 (no Next.js boilerplate imports).

- [ ] **Step 6: Run test to verify it passes**

```bash
cd frontend && npm test -- app/__tests__/page.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 7: Run all tests**

```bash
cd frontend && npm test
```

Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/ranel/Developer/claude-terminal
git add frontend/app/
git commit -m "feat: add root page with tabs shell wiring all components"
```

---

### Task 10: Verify local app and set up Vercel deployment

**Files:**
- No code changes — verification and deployment configuration

- [ ] **Step 1: Start FastAPI backend (in a separate terminal)**

```bash
cd /Users/ranel/Developer/claude-terminal
uvicorn server:app --reload --port 8000
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 2: Start Next.js dev server**

```bash
cd /Users/ranel/Developer/claude-terminal/frontend
npm run dev
```

Expected: `Local: http://localhost:3000`

- [ ] **Step 3: Smoke test in browser at http://localhost:3000**

Check each item:

- [ ] Saved Plans tab loads and shows plans (or empty state)
- [ ] New Plan tab shows first wizard question
- [ ] Wizard advances through all questions and shows summary
- [ ] Generate Plan button works (calls backend, switches to Plans tab)
- [ ] GymBot tab shows chat header and message input
- [ ] GymBot sends a message and receives a reply
- [ ] View ▾ button on a plan card expands the day view
- [ ] Edit button opens the PlanModal
- [ ] Save Changes in modal saves and closes
- [ ] Toast notification appears on save and generation

Stop both servers with Ctrl+C.

- [ ] **Step 4: Create Vercel project**

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the GitHub repo (`claude-terminal`)
3. In **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = `<your Railway backend URL>` (e.g. `https://planner-api.up.railway.app`)
5. Click **Deploy**

Expected: First deployment succeeds at `https://<project>.vercel.app`

- [ ] **Step 5: Verify production deployment**

Open `https://<project>.vercel.app` and repeat the smoke test items from Step 3 against the live Vercel URL + Railway backend.

- [ ] **Step 6: Confirm auto-deploy works**

```bash
cd /Users/ranel/Developer/claude-terminal
git commit --allow-empty -m "chore: verify Vercel auto-deploy"
git push origin main
```

Expected: New deployment triggered in Vercel dashboard within ~30 seconds.

- [ ] **Step 7: Final commit — add .env.local to .gitignore if not already**

```bash
cd /Users/ranel/Developer/claude-terminal
grep -q "frontend/.env.local" .gitignore || echo "frontend/.env.local" >> .gitignore
git add .gitignore
git diff --cached --quiet || git commit -m "chore: ensure frontend/.env.local is gitignored"
```
