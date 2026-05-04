import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Page from '../page'

jest.mock('@/lib/api', () => ({
  listPlans: jest.fn().mockResolvedValue([]),
  getQuestions: jest.fn().mockResolvedValue([]),
  getProfile: jest.fn().mockResolvedValue({}),
  getPlan: jest.fn().mockResolvedValue({ id: 1, plan: {} }),
  postChat: jest.fn().mockResolvedValue({ message: 'Hi', ready: false }),
  postChatGenerate: jest.fn().mockResolvedValue({ ok: true, plan: {} }),
  restorePlan: jest.fn().mockResolvedValue({ ok: true }),
  deletePlan: jest.fn().mockResolvedValue({ ok: true }),
}))

describe('Page', () => {
  it('renders three tab buttons', async () => {
    render(<Page />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved plans/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new plan/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gymbot/i })).toBeInTheDocument()
    })
  })

  it('shows Plans tab content by default', async () => {
    render(<Page />)
    await waitFor(() => expect(screen.getByText(/no saved plans yet/i)).toBeInTheDocument())
  })

  it('switches to New Plan tab on click', async () => {
    render(<Page />)
    await waitFor(() => screen.getByRole('button', { name: /new plan/i }))
    fireEvent.click(screen.getByRole('button', { name: /new plan/i }))
    // No plans data needed — just verify tab is active (plans tab content gone)
    expect(screen.queryByText(/no saved plans yet/i)).not.toBeInTheDocument()
  })
})
