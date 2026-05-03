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
      setPlans(p as Plan[])
      setQuestions(q as Question[])
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
