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
