import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GoalPicker, type GoalPickerItem } from './goal-picker.js';

afterEach(() => {
  cleanup();
});

const goalA: GoalPickerItem = {
  id: 'goal-a',
  title: 'Write the book',
  description: '30 minutes of deep writing each morning',
};

const goalB: GoalPickerItem = {
  id: 'goal-b',
  title: 'Learn Rust',
};

const goalC: GoalPickerItem = {
  id: 'goal-c',
  title: 'Ship the BLE firmware',
  description: 'Nanopb session encoding + flash outbox',
};

describe('GoalPicker', () => {
  it('renders every goal by title', () => {
    render(
      <GoalPicker
        goals={[goalA, goalB, goalC]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText('Write the book')).toBeDefined();
    expect(screen.getByText('Learn Rust')).toBeDefined();
    expect(screen.getByText('Ship the BLE firmware')).toBeDefined();
  });

  it('renders descriptions when provided', () => {
    render(
      <GoalPicker
        goals={[goalA, goalB]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByText('30 minutes of deep writing each morning'),
    ).toBeDefined();
  });

  it('omits the description element when description is missing', () => {
    render(
      <GoalPicker
        goals={[goalB]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryByText(/minutes of deep writing/)).toBeNull();
  });

  it('marks exactly the selected goal with a filled indicator', () => {
    render(
      <GoalPicker
        goals={[goalA, goalB, goalC]}
        selectedId="goal-b"
        onSelect={() => undefined}
      />,
    );

    // Filled circle (●) indicates selection; hollow circle (○) indicates unselected.
    const filledIndicators = screen.getAllByText('\u25CF');
    const hollowIndicators = screen.getAllByText('\u25CB');

    expect(filledIndicators).toHaveLength(1);
    expect(hollowIndicators).toHaveLength(2);
  });

  it('reports none selected when selectedId is null', () => {
    render(
      <GoalPicker
        goals={[goalA, goalB]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );

    // No filled indicators when nothing is selected.
    const filledIndicators = screen.queryAllByText('\u25CF');
    const hollowIndicators = screen.getAllByText('\u25CB');

    expect(filledIndicators).toHaveLength(0);
    expect(hollowIndicators).toHaveLength(2);
  });

  it('fires onSelect with the goal id when a row is pressed', () => {
    const onSelect = vi.fn<(goalId: string) => void>();

    render(
      <GoalPicker
        goals={[goalA, goalB, goalC]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByLabelText('Ship the BLE firmware'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('goal-c');
  });

  it('fires onSelect on every press (enables re-selection/change)', () => {
    const onSelect = vi.fn<(goalId: string) => void>();

    render(
      <GoalPicker
        goals={[goalA, goalB]}
        selectedId="goal-a"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByLabelText('Learn Rust'));
    fireEvent.click(screen.getByLabelText('Write the book'));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, 'goal-b');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'goal-a');
  });

  it('renders nothing when goals list is empty', () => {
    render(
      <GoalPicker
        goals={[]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
