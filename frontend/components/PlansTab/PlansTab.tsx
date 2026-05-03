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
                <DayContent dayData={(full.plan as Record<string, DayPlan | undefined>)[day]} />
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
