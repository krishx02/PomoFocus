import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ProcessGoal } from '@pomofocus/core';
import { GoalSelector } from './goal-selector.js';

function makeGoal(overrides: Partial<ProcessGoal> = {}): ProcessGoal {
  return {
    id: 'goal-1',
    longTermGoalId: 'lt-1',
    userId: 'user-1',
    title: 'Study calculus',
    targetSessionsPerDay: 3,
    recurrence: 'daily',
    status: 'active',
    sortOrder: 0,
    createdAt: '2026-03-17T10:00:00Z',
    updatedAt: '2026-03-17T10:00:00Z',
    ...overrides,
  };
}

describe('GoalSelector', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a list of process goals by title', () => {
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-1', title: 'Study calculus' }),
      makeGoal({ id: 'goal-2', title: 'Write essay' }),
      makeGoal({ id: 'goal-3', title: 'Practice piano' }),
    ];

    render(
      <GoalSelector goals={goals} selectedGoalId={null} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Study calculus')).toBeDefined();
    expect(screen.getByText('Write essay')).toBeDefined();
    expect(screen.getByText('Practice piano')).toBeDefined();
  });

  it('renders an empty state when no goals are provided', () => {
    render(
      <GoalSelector goals={[]} selectedGoalId={null} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('No goals yet')).toBeDefined();
  });

  it('calls onSelect with the goal id when a goal is pressed', () => {
    const onSelect = vi.fn();
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-1', title: 'Study calculus' }),
      makeGoal({ id: 'goal-2', title: 'Write essay' }),
    ];

    render(
      <GoalSelector goals={goals} selectedGoalId={null} onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Write essay' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('goal-2');
  });

  it('marks only the selected goal as selected (radio-style, exactly one)', () => {
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-1', title: 'Study calculus' }),
      makeGoal({ id: 'goal-2', title: 'Write essay' }),
      makeGoal({ id: 'goal-3', title: 'Practice piano' }),
    ];

    render(
      <GoalSelector
        goals={goals}
        selectedGoalId="goal-2"
        onSelect={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio');
    const selectedRadios = radios.filter(
      (el) => el.getAttribute('aria-checked') === 'true',
    );

    expect(selectedRadios).toHaveLength(1);
    expect(selectedRadios[0]?.getAttribute('aria-label')).toBe('Write essay');
  });

  it('renders no selected radio when selectedGoalId is null', () => {
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-1', title: 'Study calculus' }),
      makeGoal({ id: 'goal-2', title: 'Write essay' }),
    ];

    render(
      <GoalSelector goals={goals} selectedGoalId={null} onSelect={vi.fn()} />,
    );

    const radios = screen.getAllByRole('radio');
    const selectedRadios = radios.filter(
      (el) => el.getAttribute('aria-checked') === 'true',
    );

    expect(selectedRadios).toHaveLength(0);
  });

  it('visually highlights the selected goal with different text styling', () => {
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-1', title: 'Study calculus' }),
      makeGoal({ id: 'goal-2', title: 'Write essay' }),
    ];

    const { rerender } = render(
      <GoalSelector goals={goals} selectedGoalId="goal-1" onSelect={vi.fn()} />,
    );

    const selectedRadio = screen.getByRole('radio', { name: 'Study calculus' });
    expect(selectedRadio.getAttribute('aria-checked')).toBe('true');

    rerender(
      <GoalSelector goals={goals} selectedGoalId="goal-2" onSelect={vi.fn()} />,
    );

    const newSelectedRadio = screen.getByRole('radio', { name: 'Write essay' });
    expect(newSelectedRadio.getAttribute('aria-checked')).toBe('true');

    const previouslySelected = screen.getByRole('radio', { name: 'Study calculus' });
    expect(previouslySelected.getAttribute('aria-checked')).toBe('false');
  });

  it('assigns a testID for each goal option', () => {
    const goals: readonly ProcessGoal[] = [
      makeGoal({ id: 'goal-abc', title: 'Study calculus' }),
    ];

    render(
      <GoalSelector goals={goals} selectedGoalId={null} onSelect={vi.fn()} />,
    );

    expect(screen.getByTestId('goal-option-goal-abc')).toBeDefined();
  });
});
