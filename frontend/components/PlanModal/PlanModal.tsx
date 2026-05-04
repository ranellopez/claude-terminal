// frontend/components/PlanModal/PlanModal.tsx
'use client'
import { useState, useCallback, useRef } from 'react'
import type { PlanFull, WeekPlan, DayPlan, Exercise } from '@/lib/types'
import { updatePlan } from '@/lib/api'
import styles from './PlanModal.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type KeyedExercise = Exercise & { _key: number }

interface Props {
  full: PlanFull
  planId: number
  onClose: () => void
  onSaved: () => void
}

export default function PlanModal({ full, planId, onClose, onSaved }: Props) {
  const keyCounter = useRef(0)
  const [plan, setPlan] = useState<WeekPlan>(() => {
    const cloned: WeekPlan = JSON.parse(JSON.stringify(full.plan))
    for (const day of Object.values(cloned)) {
      if (day?.exercises) {
        day.exercises = day.exercises.map(e => ({ ...e, _key: keyCounter.current++ } as KeyedExercise))
      }
    }
    return cloned
  })
  const [activeDay, setActiveDay] = useState<(typeof DAYS)[number]>('Mon')
  const [saving, setSaving] = useState(false)

  const day = plan[activeDay] as DayPlan

  function updateDay(patch: Partial<DayPlan>) {
    setPlan(prev => ({ ...prev, [activeDay]: { ...prev[activeDay], ...patch } }))
  }

  function updateMeal(type: string, value: string) {
    setPlan(prev => ({
      ...prev,
      [activeDay]: { ...prev[activeDay], meals: { ...prev[activeDay]?.meals, [type]: value } },
    }))
  }

  function updateExercise(i: number, field: 'name' | 'sets' | 'reps', value: string) {
    const exercises = [...(day.exercises ?? [])]
    exercises[i] = { ...exercises[i], [field]: field === 'sets' ? parseInt(value) || 3 : value }
    updateDay({ exercises })
  }

  function addExercise() {
    updateDay({ exercises: [...(day.exercises ?? []), { name: '', sets: 3, reps: '10-12', _key: keyCounter.current++ } as KeyedExercise] })
  }

  function removeExercise(i: number) {
    updateDay({ exercises: (day.exercises ?? []).filter((_, idx) => idx !== i) })
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
    try {
      const clean: WeekPlan = {}
      for (const [k, day] of Object.entries(plan)) {
        clean[k as keyof typeof clean] = day
          ? { ...day, exercises: (day.exercises as KeyedExercise[] | undefined)?.map(({ _key: _k, ...e }) => e) }
          : day
      }
      await updatePlan(planId, clean)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
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
                <div key={(e as KeyedExercise)._key ?? i} className={styles.fieldRow}>
                  <input className={`${styles.input} ${styles.inputName}`} value={e.name} placeholder="Exercise name"
                    onChange={ev => updateExercise(i, 'name', ev.target.value)} />
                  <input className={`${styles.input} ${styles.inputNum}`} value={String(e.sets)} placeholder="Sets"
                    onChange={ev => updateExercise(i, 'sets', ev.target.value)} />
                  <input className={`${styles.input} ${styles.inputNum}`} value={e.reps} placeholder="Reps"
                    onChange={ev => updateExercise(i, 'reps', ev.target.value)} />
                  <button className={styles.delBtn} onClick={() => removeExercise(i)} aria-label="Remove exercise">✕</button>
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
                  <button className={styles.delBtn} onClick={() => removePrepTask(i)} aria-label="Remove task">✕</button>
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
