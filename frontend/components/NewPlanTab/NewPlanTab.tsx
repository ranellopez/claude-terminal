// frontend/components/NewPlanTab/NewPlanTab.tsx
'use client'
import { useState, useRef } from 'react'
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
    if (!profile?.goal) return {} as Answers
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
  const textRef = useRef<HTMLInputElement>(null)
  const calRef = useRef<HTMLInputElement>(null)
  const protRef = useRef<HTMLInputElement>(null)

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
      setAnswer(q.key, textRef.current?.value.trim() || 'none')
    } else if (q.type === 'targets') {
      setAnswer(q.key, {
        calories: parseInt(calRef.current?.value ?? '') || 2000,
        protein: parseInt(protRef.current?.value ?? '') || 150,
      })
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
    try {
      const res = await generatePlan(p)
      if (res.ok) {
        onToast('Plan generated!', 'success')
        setStep(0)
        setAnswers({})
        onGenerated()
      } else {
        onToast('Generation failed')
      }
    } catch {
      onToast('Generation failed')
    } finally {
      setGenerating(false)
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
          <input ref={textRef} className={`${styles.input} ${styles.inputWide}`}
            defaultValue={(ans as string) ?? ''} placeholder={q.placeholder ?? ''} />
        )}

        {q.type === 'targets' && (
          <div className={styles.targetsRow}>
            <div>
              <div className={styles.fieldLabel}>Calories (kcal)</div>
              <input ref={calRef} className={`${styles.input} ${styles.inputWide}`} type="number"
                defaultValue={(ans as { calories: number })?.calories ?? defCal} />
            </div>
            <div>
              <div className={styles.fieldLabel}>Protein (g)</div>
              <input ref={protRef} className={`${styles.input} ${styles.inputWide}`} type="number"
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
