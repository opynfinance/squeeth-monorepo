import { render, screen } from '@testing-library/react'
import YourVaults from './YourVaults'
import * as useYourVaults from '../../hooks/useYourVaults'

describe('YourVaults', () => {
  const mockedVaults = [
    {
      id: '172',
      shortAmount: '2800000000000000000',
      collateralAmount: '69000000000000000000',
    },
  ]

  const setup = async (response: any) => {
    jest.spyOn(useYourVaults, 'default').mockReturnValue(response)

    render(<YourVaults />)
  }

  it('renders loading text while API is loading', async () => {
    await setup({ loading: true })

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
  })

  it('renders error message when there is a error', async () => {
    await setup({
      error: { message: 'Something went wrong!' },
    })

    expect(screen.getByText(/Something went wrong!/i)).toBeInTheDocument()
  })

  it('renders short amount and collateral amount eth correctly', async () => {
    await setup({
      data: { vaults: mockedVaults },
    })

    expect(screen.getByText(/69\.0000/i)).toBeInTheDocument()
    expect(screen.getByText(/2\.8000/i)).toBeInTheDocument()
  })

  it('renders link to the vault detail page', async () => {
    await setup({
      data: { vaults: mockedVaults },
    })

    expect(screen.getByRole('link')).toHaveAttribute('href', '/vault/172')
  })
})
