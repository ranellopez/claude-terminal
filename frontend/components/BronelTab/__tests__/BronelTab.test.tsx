// frontend/components/BronelTab/__tests__/BronelTab.test.tsx
import { render, screen } from '@testing-library/react'
import BronelTab from '../BronelTab'

jest.mock('@/lib/api', () => ({
  postBronelChat: jest.fn().mockResolvedValue({ message: 'Hey Ranel, what are we tackling today?' }),
  listChats: jest.fn().mockResolvedValue([]),
  createChat: jest.fn().mockResolvedValue({ id: 1, title: 'Chat', created_at: '2026-08-25T00:00:00Z' }),
  getChat: jest.fn(),
  updateChat: jest.fn().mockResolvedValue({ ok: true }),
  deleteChat: jest.fn().mockResolvedValue({ ok: true }),
}))

describe('BronelTab', () => {
  it('renders chat header with Bronel title', () => {
    render(<BronelTab onToast={jest.fn()} active={false} />)
    expect(screen.getByText('Bronel')).toBeInTheDocument()
  })

  it('renders message input and send button', () => {
    render(<BronelTab onToast={jest.fn()} active={false} />)
    expect(screen.getByPlaceholderText(/message bronel/i)).toBeInTheDocument()
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  it('shows New chat button', () => {
    render(<BronelTab onToast={jest.fn()} active={false} />)
    expect(screen.getByText('+ New chat')).toBeInTheDocument()
  })
})
