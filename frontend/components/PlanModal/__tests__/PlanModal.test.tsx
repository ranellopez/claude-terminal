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

jest.mock('@/lib/api', () => ({
  updatePlan: jest.fn().mockResolvedValue({ ok: true }),
}))

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
