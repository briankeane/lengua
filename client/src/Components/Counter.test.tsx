import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import Counter from './Counter';

describe('Counter', () => {
  it('renders with initial count of 0', () => {
    render(<Counter />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('count is 0');
  });

  it('increments count when clicked', () => {
    render(<Counter />);
    const button = screen.getByRole('button');

    // Click once
    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 1');

    // Click again
    fireEvent.click(button);
    expect(button).toHaveTextContent('count is 2');
  });
});
