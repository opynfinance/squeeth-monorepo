import { render, screen } from '@testing-library/react'
import LabelWithTooltip from './LabelWithTooltip'

describe('LabelWithTooltip', () => {
  it('renders label text', () => {
    render(<LabelWithTooltip label="Test Label" />)

    expect(screen.getByText(/Test Label/i)).toBeInTheDocument()
  })
})
