import { render, screen } from '@testing-library/react'
import { Disclaimer } from './Disclaimer'

describe('Disclaimer', () => {
  it('states that predictions are not a diagnosis', () => {
    render(<Disclaimer />)
    expect(screen.getByText(/not a medical\s+diagnosis/i)).toBeInTheDocument()
  })
})
