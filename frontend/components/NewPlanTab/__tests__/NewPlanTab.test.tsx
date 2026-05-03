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
