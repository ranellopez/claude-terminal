import { render, screen } from '@testing-library/react'
import Toast from '../Toast'

describe('Toast', () => {
  it('is not visible when visible=false', () => {
    const { container } = render(<Toast message="Hi" visible={false} onHide={jest.fn()} />)
    expect(container.firstChild).not.toHaveClass('show')
  })

  it('renders message text when visible', () => {
    render(<Toast message="Plan saved!" visible={true} onHide={jest.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Plan saved!')
  })

  it('applies success modifier when type=success', () => {
    render(<Toast message="Done" type="success" visible={true} onHide={jest.fn()} />)
    expect(screen.getByRole('status').className).toContain('success')
  })
})
