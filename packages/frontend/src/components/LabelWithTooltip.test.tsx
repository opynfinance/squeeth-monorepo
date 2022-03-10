import { render, screen } from '@testing-library/react'
import LabelWithTooltip from './LabelWithTooltip'

describe('LabelWithTooltip', () => {
  it('renders label text', () => {
    render(<LabelWithTooltip label="Test Label" />)

    expect(screen.getByText(/Test Label/i)).toBeInTheDocument()
  })

  it('does not render info icon when tooltip is not defined', () => {
    render(<LabelWithTooltip label="Test Label" />)

    expect(screen.queryByTestId('info-icon')).toBeNull()
  })

  it('renders info icon and tooltip when tooltip is defined', () => {
    render(<LabelWithTooltip label="Test Label" tooltip="Custom Tooltip" />)

    expect(screen.getByTestId('info-icon')).toBeInTheDocument()
    expect(screen.getByTitle('Custom Tooltip')).toBeInTheDocument()
  })
})
