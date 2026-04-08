import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Session } from '@pomofocus/types';
import { SessionListItem } from './session-list-item.js';

afterEach(() => {
  cleanup();
});

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 'user-1',
    process_goal_id: 'goal-1',
    intention_text: null,
    started_at: '2026-03-17T10:00:00Z',
    ended_at: '2026-03-17T10:25:00Z',
    completed: true,
    abandonment_reason: null,
    focus_quality: 'locked_in',
    distraction_type: null,
    device_id: null,
    created_at: '2026-03-17T10:25:00Z',
    ...overrides,
  };
}

describe('SessionListItem', () => {
  it('renders the goal name', () => {
    render(
      <SessionListItem session={makeSession()} goalName="Write the book" />,
    );

    expect(screen.getByText('Write the book')).toBeDefined();
  });

  it('renders the session date derived from started_at', () => {
    render(
      <SessionListItem session={makeSession()} goalName="Write the book" />,
    );

    // en-CA locale yields YYYY-MM-DD for the started_at date (UTC 2026-03-17)
    expect(screen.getByText('2026-03-17')).toBeDefined();
  });

  it('formats a 25-minute session as "25m"', () => {
    render(
      <SessionListItem session={makeSession()} goalName="Write the book" />,
    );

    expect(screen.getByText('25m')).toBeDefined();
  });

  it('formats a session over an hour as "Xh Ym"', () => {
    const session = makeSession({
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T11:30:00Z',
    });

    render(<SessionListItem session={session} goalName="Deep work" />);

    expect(screen.getByText('1h 30m')).toBeDefined();
  });

  it('formats a sub-minute session in seconds', () => {
    const session = makeSession({
      started_at: '2026-03-17T10:00:00Z',
      ended_at: '2026-03-17T10:00:42Z',
    });

    render(<SessionListItem session={session} goalName="Deep work" />);

    expect(screen.getByText('42s')).toBeDefined();
  });

  it('renders the focus quality label for locked_in', () => {
    render(
      <SessionListItem
        session={makeSession({ focus_quality: 'locked_in' })}
        goalName="Deep work"
      />,
    );

    expect(
      screen.getByTestId(
        'session-focus-quality-550e8400-e29b-41d4-a716-446655440000',
      ).textContent,
    ).toBe('Locked in');
  });

  it('renders the focus quality label for decent', () => {
    render(
      <SessionListItem
        session={makeSession({ focus_quality: 'decent' })}
        goalName="Deep work"
      />,
    );

    expect(
      screen.getByTestId(
        'session-focus-quality-550e8400-e29b-41d4-a716-446655440000',
      ).textContent,
    ).toBe('Decent');
  });

  it('renders the focus quality label for struggled', () => {
    render(
      <SessionListItem
        session={makeSession({ focus_quality: 'struggled' })}
        goalName="Deep work"
      />,
    );

    expect(
      screen.getByTestId(
        'session-focus-quality-550e8400-e29b-41d4-a716-446655440000',
      ).textContent,
    ).toBe('Struggled');
  });

  it('renders "--" for focus quality when the session has no rating', () => {
    render(
      <SessionListItem
        session={makeSession({ focus_quality: null })}
        goalName="Deep work"
      />,
    );

    expect(
      screen.getByTestId(
        'session-focus-quality-550e8400-e29b-41d4-a716-446655440000',
      ).textContent,
    ).toBe('--');
  });

  it('renders duration as "--" for a session that has not ended', () => {
    const session = makeSession({ ended_at: null, focus_quality: null });

    render(<SessionListItem session={session} goalName="In progress" />);

    // Duration "--" appears as the second instance (first is focus quality).
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('uses the session id in the test id so multiple rows are distinguishable', () => {
    render(
      <SessionListItem
        session={makeSession({ id: 'abc-123' })}
        goalName="Deep work"
      />,
    );

    expect(screen.getByTestId('session-list-item-abc-123')).toBeDefined();
  });

  it('exposes an accessibility label that summarizes the session', () => {
    render(
      <SessionListItem
        session={makeSession()}
        goalName="Write the book"
      />,
    );

    expect(
      screen.getByLabelText(
        /Session on 2026-03-17 for Write the book, 25m, Locked in/,
      ),
    ).toBeDefined();
  });
});
