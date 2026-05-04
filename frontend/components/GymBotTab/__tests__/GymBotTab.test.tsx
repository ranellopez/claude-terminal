// frontend/components/GymBotTab/__tests__/GymBotTab.test.tsx
import { render, screen } from '@testing-library/react'
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
