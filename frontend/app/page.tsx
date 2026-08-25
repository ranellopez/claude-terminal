'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Plan, Question, Profile, PlanFull } from '@/lib/types'
import { listPlans, getQuestions, getProfile, getPlan } from '@/lib/api'
import PlansTab from '@/components/PlansTab/PlansTab'
import NewPlanTab from '@/components/NewPlanTab/NewPlanTab'
import GymBotTab from '@/components/GymBotTab/GymBotTab'
import BronelTab from '@/components/BronelTab/BronelTab'
import PlanModal from '@/components/PlanModal/PlanModal'
import Toast from '@/components/Toast/Toast'
import styles from './page.module.css'

type Tab = 'plans' | 'new' | 'chat' | 'bronel'

const TABS: { id: Tab; label: string }[] = [
  { id: 'plans',  label: '📋 Saved Plans' },
  { id: 'new',    label: '✨ New Plan' },
  { id: 'chat',   label: '💬 GymBot' },
  { id: 'bronel', label: '🧠 Bronel' },
]

export default function Page() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('plans')
  const [modalPlanId, setModalPlanId] = useState<number | null>(null)
  const [modalFull, setModalFull] = useState<PlanFull | null>(null)
  const [toast, setToast] = useState({ message: '', type: '' as 'success' | '', visible: false })

  const showToast = useCallback((message: string, type: 'success' | '' = '') => {
    setToast({ message, type, visible: true })
  }, [])

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }))
  }, [])

  const refreshPlans = useCallback(async () => {
    try {
      const p = await listPlans()
      setPlans(p)
    } catch {
      showToast('Failed to load plans')
    }
  }, [showToast])

  useEffect(() => {
    Promise.all([listPlans(), getQuestions(), getProfile()])
      .then(([p, q, prof]) => {
        setPlans(p as Plan[])
        setQuestions(q as Question[])
        if (prof && 'goal' in prof) setProfile(prof as Profile)
      })
      .catch(() => showToast('Failed to load app data'))
  }, [showToast])

  const openModal = useCallback(async (id: number) => {
    try {
      const full = await getPlan(id)
      setModalFull(full)
      setModalPlanId(id)
    } catch {
      showToast('Could not load plan')
    }
  }, [showToast])

  const closeModal = useCallback(() => {
    setModalPlanId(null)
    setModalFull(null)
  }, [])

  const handleRestore = useCallback(() => {
    showToast('Plan restored as current week!', 'success')
    refreshPlans()
  }, [showToast, refreshPlans])

  const handleDelete = useCallback(() => {
    showToast('Plan deleted')
    refreshPlans()
  }, [showToast, refreshPlans])

  const handleGenerated = useCallback(() => {
    setActiveTab('plans')
    refreshPlans()
  }, [refreshPlans])

  const handleSaved = useCallback(() => {
    showToast('Changes saved!', 'success')
    refreshPlans()
  }, [showToast, refreshPlans])

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
          onRestore={handleRestore}
          onDelete={handleDelete}
          onEdit={openModal}
        />
      )}

      {activeTab === 'new' && (
        <NewPlanTab
          questions={questions}
          profile={profile}
          onGenerated={handleGenerated}
          onToast={showToast}
        />
      )}

      {activeTab === 'chat' && (
        <GymBotTab
          profile={profile}
          onGenerated={handleGenerated}
          onToast={showToast}
          active={activeTab === 'chat'}
        />
      )}

      {activeTab === 'bronel' && (
        <BronelTab
          onToast={showToast}
          active={activeTab === 'bronel'}
        />
      )}

      {modalPlanId !== null && modalFull !== null && (
        <PlanModal
          full={modalFull}
          planId={modalPlanId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
    </>
  )
}
